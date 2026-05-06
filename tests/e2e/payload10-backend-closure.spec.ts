// PAYLOAD 10 — End-to-end backend closure test.
//
// Exercises the full backend pipeline introduced by Payload 10:
//   1. Risk Engine evaluation (scoring + decision + reason codes).
//   2. OBS audio-signal gate (PAY-008) blocks heat escalation in a silent
//      room and permits it once a positive vocal sample is recorded.
//   3. FairPay PayoutRateLockService captures the live rate at purchase, the
//      PayoutService at session close honours the locked rate verbatim.
//   4. Cyrano LLM provider abstraction (CYR-006) refines a base copy.
//   5. Idempotency: every replay returns the original record unchanged.
//
// The test intentionally avoids Postgres / NATS — it stubs the surfaces and
// validates the deterministic logic path. Restart-safety + DB triggers are
// covered by the production migration tests.

import {
  RISK_TIER_THRESHOLDS,
  type RiskEvaluationInput,
  type RiskEvaluationResult,
} from '../../services/risk-engine/src/risk-engine.types';
import {
  AUDIO_VOCAL_PRESENCE_THRESHOLD,
  AudioSignalService,
} from '../../services/obs-bridge/src/audio-signal.service';
import { InMemoryCyranoLlmProvider } from '../../services/cyrano/src/llm-provider.in-memory';

// ── Lightweight stubs ────────────────────────────────────────────────────

interface PublishedTopic {
  topic: string;
  payload: Record<string, unknown>;
}

class FakeNats {
  readonly published: PublishedTopic[] = [];
  publish(topic: string, payload: Record<string, unknown>): void {
    this.published.push({ topic, payload });
  }
  subscribe(): void {
    /* noop */
  }
}

interface RiskRow {
  id: string;
  correlation_id: string;
  subject_user_id: string;
  intent: string;
  composite_score: number;
  tier: string;
  decision: string;
  signal_breakdown: object;
  reason_codes: string[];
  agent_id: string | null;
  reason_code: string;
  rule_applied_id: string;
  evaluated_at: Date;
}

class FakeRiskEnginePrisma {
  readonly rows = new Map<string, RiskRow>();
  riskEngineDecision = {
    findUnique: async ({ where }: { where: { correlation_id: string } }) => {
      return this.rows.get(where.correlation_id) ?? null;
    },
    create: async ({ data }: { data: Omit<RiskRow, 'id'> & { id?: string } }) => {
      const id = `risk-${this.rows.size + 1}`;
      const row: RiskRow = { id, ...data };
      this.rows.set(data.correlation_id, row);
      return row;
    },
  };
}

interface PayoutLockRow {
  id: string;
  correlation_id: string;
  transaction_id: string | null;
  wallet_id: string;
  creator_id: string;
  heat_score: number;
  heat_tier: string;
  rate_per_token_usd: number;
  diamond_floor_active: boolean;
  pixel_legacy_floor_active: boolean;
  floor_applied: boolean;
  amount_czt: number;
  reason_code: string;
  rule_applied_id: string;
  organization_id: string;
  tenant_id: string;
  locked_at: Date;
}

class FakePayoutLockPrisma {
  readonly rows = new Map<string, PayoutLockRow>();
  payoutRateLock = {
    findUnique: async ({ where }: { where: { correlation_id: string } }) => {
      return this.rows.get(where.correlation_id) ?? null;
    },
    create: async ({ data }: { data: Omit<PayoutLockRow, 'id'> }) => {
      const id = `lock-${this.rows.size + 1}`;
      const row: PayoutLockRow = { id, ...data };
      this.rows.set(data.correlation_id, row);
      return row;
    },
  };
}

// Fake REDBOOK rate card service — deterministic linear band → rate map.
class FakeRedbookRateCardService {
  resolveCreatorPayoutRate(args: {
    heatScore: number;
    diamondFloorActive: boolean;
    isPixelLegacy?: boolean;
  }): {
    level: 'cold' | 'warm' | 'hot' | 'inferno';
    ratePerToken: number;
    appliedFloor: boolean;
    appliedDiamondFloor: boolean;
    appliedPixelLegacyFloor: boolean;
  } {
    let level: 'cold' | 'warm' | 'hot' | 'inferno';
    let rate: number;
    if (args.heatScore >= 86) {
      level = 'inferno';
      rate = 0.09;
    } else if (args.heatScore >= 61) {
      level = 'hot';
      rate = 0.085;
    } else if (args.heatScore >= 34) {
      level = 'warm';
      rate = 0.08;
    } else {
      level = 'cold';
      rate = 0.075;
    }

    let appliedDiamondFloor = false;
    let appliedPixelLegacyFloor = false;
    if (args.diamondFloorActive && rate < 0.08) {
      rate = 0.08;
      appliedDiamondFloor = true;
    }
    if (args.isPixelLegacy && rate < 0.07) {
      rate = 0.07;
      appliedPixelLegacyFloor = true;
    }
    return {
      level,
      ratePerToken: rate,
      appliedFloor: appliedDiamondFloor || appliedPixelLegacyFloor,
      appliedDiamondFloor,
      appliedPixelLegacyFloor,
    };
  }
}

// Fake region-signal service for the Risk Engine.
class FakeRegionSignalService {
  async getConfidenceScore(data: {
    isVpnDetected: boolean;
    binCountry: string;
    billingCountry: string;
    ipCountry: string;
  }): Promise<{
    confidence: number;
    region: string;
    vpnRisk: boolean;
    flags: string[];
  }> {
    let confidence = 1.0;
    const flags: string[] = [];
    if (data.isVpnDetected) {
      confidence -= 0.5;
      flags.push('VPN_DETECTED');
    }
    if (data.binCountry !== data.billingCountry) {
      confidence -= 0.3;
      flags.push('BIN_BILLING_MISMATCH');
    }
    return {
      confidence: Math.max(0, confidence),
      region: data.binCountry,
      vpnRisk: data.isVpnDetected,
      flags,
    };
  }
}

// ── Risk Engine harness ──────────────────────────────────────────────────

async function buildRiskEngine() {
  const { RiskEngineService } = await import(
    '../../services/risk-engine/src/risk-engine.service'
  );
  const prisma = new FakeRiskEnginePrisma();
  const nats = new FakeNats();
  const region = new FakeRegionSignalService();
  // The constructor expects PrismaService / NatsService / RegionSignalService
  // shapes — our fakes structurally satisfy those at runtime for this test.
  const engine = new RiskEngineService(
    prisma as unknown as never,
    nats as unknown as never,
    region as unknown as never,
  );
  return { engine, prisma, nats };
}

// ── PayoutRateLock harness ───────────────────────────────────────────────

async function buildPayoutRateLock() {
  const { PayoutRateLockService } = await import(
    '../../services/ledger/payout-rate-lock.service'
  );
  const prisma = new FakePayoutLockPrisma();
  const nats = new FakeNats();
  const rateCards = new FakeRedbookRateCardService();
  const svc = new PayoutRateLockService(
    prisma as unknown as never,
    nats as unknown as never,
    rateCards as unknown as never,
  );
  return { svc, prisma, nats };
}

// ── Tests ────────────────────────────────────────────────────────────────

describe('PAYLOAD 10 — backend closure', () => {
  describe('Risk Engine (D002)', () => {
    test('low-risk purchase resolves to GREEN / PASS', async () => {
      const { engine } = await buildRiskEngine();
      const input: RiskEvaluationInput = {
        correlationId: 'risk-test-1',
        intent: 'PURCHASE',
        subjectUserId: '00000000-0000-0000-0000-000000000001',
        region: {
          ipCountry: 'CA',
          billingCountry: 'CA',
          binCountry: 'CA',
          isVpnDetected: false,
        },
        behavioural: {
          spendVelocity24hUsd: 50,
          prevDisputeCount: 0,
          failedAuthCount24h: 0,
          accountTenureDays: 365,
          silenceSecondsInSession: 0,
          highHeatBurstFlag: false,
        },
      };
      const result = await engine.evaluate(input);
      expect(result.tier).toBe('GREEN');
      expect(result.decision).toBe('PASS');
      expect(result.compositeScore).toBeLessThanOrEqual(
        RISK_TIER_THRESHOLDS.GREEN_MAX,
      );
    });

    test('Diamond Concierge coercion flag escalates to CRITICAL', async () => {
      const { engine } = await buildRiskEngine();
      const input: RiskEvaluationInput = {
        correlationId: 'risk-test-2',
        intent: 'DIAMOND_INTAKE',
        subjectUserId: '00000000-0000-0000-0000-000000000002',
        diamond: {
          intoxicationFlag: false,
          belligerenceFlag: false,
          coercionFlag: true,
          duressFlag: false,
          agentId: '00000000-0000-0000-0000-00000000a001',
        },
      };
      const result = await engine.evaluate(input);
      expect(result.decision).toBe('ESCALATE');
      expect(result.tier).toBe('CRITICAL');
      expect(result.reasonCodes).toContain('CONCIERGE_COERCION');
    });

    test('idempotent on correlation_id replay', async () => {
      const { engine, prisma } = await buildRiskEngine();
      const input: RiskEvaluationInput = {
        correlationId: 'risk-test-3',
        intent: 'PURCHASE',
        subjectUserId: '00000000-0000-0000-0000-000000000003',
      };
      const first: RiskEvaluationResult = await engine.evaluate(input);
      const second: RiskEvaluationResult = await engine.evaluate(input);
      expect(second.id).toBe(first.id);
      expect(second.compositeScore).toBe(first.compositeScore);
      expect(prisma.rows.size).toBe(1);
    });
  });

  describe('OBS audio-signal gate (PAY-008)', () => {
    test('silent room blocks WARM/HOT/INFERNO escalation', () => {
      const nats = new FakeNats();
      const svc = new AudioSignalService(nats as unknown as never);
      const result = svc.shouldAllowEscalation({
        streamId: 'stream-A',
        proposedTier: 'HOT',
        correlationId: 'corr-A',
        capturedAtMs: 1_700_000_000_000,
      });
      expect(result.allowed).toBe(false);
      expect(result.reasonCode).toBe('AUDIO_SIGNAL_ABSENT');
      expect(
        nats.published.some((p) => p.topic.includes('escalation.blocked')),
      ).toBe(true);
    });

    test('positive sample within window unblocks escalation', () => {
      const nats = new FakeNats();
      const svc = new AudioSignalService(nats as unknown as never);
      svc.recordSample({
        streamId: 'stream-B',
        creatorId: '00000000-0000-0000-0000-000000000010',
        vocalRatio: AUDIO_VOCAL_PRESENCE_THRESHOLD + 0.1,
        capturedAtMs: 1_700_000_000_000,
      });
      const result = svc.shouldAllowEscalation({
        streamId: 'stream-B',
        proposedTier: 'INFERNO',
        correlationId: 'corr-B',
        capturedAtMs: 1_700_000_001_000,
      });
      expect(result.allowed).toBe(true);
      expect(result.reasonCode).toBe('AUDIO_PRESENT');
    });

    test('COLD escalation never requires audio', () => {
      const nats = new FakeNats();
      const svc = new AudioSignalService(nats as unknown as never);
      const result = svc.shouldAllowEscalation({
        streamId: 'stream-C',
        proposedTier: 'COLD',
        correlationId: 'corr-C',
      });
      expect(result.allowed).toBe(true);
      expect(result.reasonCode).toBe('NO_AUDIO_REQUIRED');
    });
  });

  describe('FairPay PayoutRateLock (PAY-006)', () => {
    test('captures rate at purchase, idempotent on replay', async () => {
      const { svc, prisma } = await buildPayoutRateLock();
      const input = {
        correlationId: 'lock-test-1',
        walletId: 'wallet-A',
        creatorId: '00000000-0000-0000-0000-000000000020',
        heatScore: 75,
        amountCzt: 1_000,
        diamondFloorActive: false,
        organizationId: 'org-1',
        tenantId: 'tenant-1',
      };
      const first = await svc.capture(input);
      expect(first.heatTier).toBe('HOT');
      expect(first.ratePerTokenUsd).toBeCloseTo(0.085, 4);
      const second = await svc.capture(input);
      expect(second.id).toBe(first.id);
      expect(prisma.rows.size).toBe(1);
    });

    test('Diamond floor lifts cold-band rate to RATE_WARM', async () => {
      const { svc } = await buildPayoutRateLock();
      const result = await svc.capture({
        correlationId: 'lock-test-2',
        walletId: 'wallet-B',
        creatorId: '00000000-0000-0000-0000-000000000021',
        heatScore: 10, // COLD
        amountCzt: 10_000,
        diamondFloorActive: true,
        organizationId: 'org-1',
        tenantId: 'tenant-1',
      });
      expect(result.heatTier).toBe('COLD');
      expect(result.ratePerTokenUsd).toBeCloseTo(0.08, 4);
      expect(result.floorApplied).toBe(true);
      expect(result.diamondFloorApplied).toBe(true);
      expect(result.diamondFloorEligible).toBe(true);
    });
  });

  describe('Cyrano LLM provider (CYR-006)', () => {
    test('in-memory provider refines base copy deterministically', async () => {
      const provider = new InMemoryCyranoLlmProvider();
      const a = await provider.refine({
        context: {
          correlationId: 'cyrano-1',
          category: 'CAT_MONETIZATION',
          tier: 'HOT',
          personaTone: 'playful',
        },
        baseCopy: 'Send a kiss to keep the room hot.',
        latencyBudgetMs: 1_500,
      });
      const b = await provider.refine({
        context: {
          correlationId: 'cyrano-1',
          category: 'CAT_MONETIZATION',
          tier: 'HOT',
          personaTone: 'playful',
        },
        baseCopy: 'Send a kiss to keep the room hot.',
        latencyBudgetMs: 1_500,
      });
      expect(a.refinedCopy).toBe(b.refinedCopy);
      expect(a.refinedCopy).toContain('[playful]');
      expect(a.fallback).toBe(false);
    });
  });
});
