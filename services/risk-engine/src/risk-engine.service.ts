// PAYLOAD 10 — Risk Engine (D002) production service.
// Composite risk evaluator. Region + behavioural + Diamond Concierge intake
// signals are combined into a deterministic composite score (0..100), tier,
// and decision. Every evaluation persists an append-only RiskEngineDecision
// row and emits both a topic-class NATS event and an immutable audit envelope.
//
// Doctrine:
//   • Deterministic — same inputs always produce same composite score.
//   • Append-only — UPDATE/DELETE on risk_engine_decisions is refused at
//     the DB layer (migration 20260503000000).
//   • correlation_id + reason_code + rule_applied_id on every write.
//   • No PII logged — only ids, scores, tiers, decisions.
//   • Pre-processor for GateGuard + Integration Hub. Callers attach the
//     RiskEvaluationResult to the GuardedLedgerRequest envelope.

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../core-api/src/prisma.service';
import { NatsService } from '../../core-api/src/nats/nats.service';
import { NATS_TOPICS } from '../../nats/topics.registry';
import { RegionSignalService } from './region-signal.service';
import {
  RISK_ENGINE_RULE_ID,
  RISK_TIER_THRESHOLDS,
  type RegionSignals,
  type RiskDecision,
  type RiskEvaluationInput,
  type RiskEvaluationResult,
  type RiskTier,
  type SignalBreakdown,
} from './risk-engine.types';

@Injectable()
export class RiskEngineService {
  private readonly logger = new Logger(RiskEngineService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly nats: NatsService,
    private readonly regionSignal: RegionSignalService,
  ) {}

  /**
   * Evaluate a transaction or Diamond Concierge intake.
   *
   * Returns a deterministic, fully-attributed RiskEvaluationResult and
   * persists a RiskEngineDecision row keyed on `correlationId`. Idempotent —
   * a replay returns the existing decision instead of re-scoring.
   */
  async evaluate(input: RiskEvaluationInput): Promise<RiskEvaluationResult> {
    if (!input.correlationId) {
      throw new Error('RiskEngine.evaluate: correlationId is required');
    }
    if (!input.subjectUserId) {
      throw new Error('RiskEngine.evaluate: subjectUserId is required');
    }

    // Idempotency — a re-evaluation with the same correlation_id returns the
    // prior persisted decision so callers never get a divergent score.
    const existing = await this.prisma.riskEngineDecision.findUnique({
      where: { correlation_id: input.correlationId },
    });
    if (existing) {
      return this.materialise(existing);
    }

    // Region — invoke the existing pure helper. Defensive defaults: missing
    // region data scores 0 (low risk) so the engine never falsely escalates
    // when telemetry is incomplete.
    const regionScore = await this.scoreRegion(input.region);

    // Behavioural — bounded contributions per signal, summed and clamped.
    const behaviouralResult = this.scoreBehavioural(input);

    // Diamond Concierge intake — flag set drives the most aggressive bumps.
    const diamondResult = this.scoreDiamondConcierge(input);

    const compositeRaw =
      regionScore.score + behaviouralResult.score + diamondResult.score;
    const compositeScore = Math.max(0, Math.min(100, Math.round(compositeRaw)));
    const tier = this.tierForScore(compositeScore);
    const decision = this.decisionForTier(tier, input);
    const reasonCodes = this.collectReasonCodes(
      regionScore,
      behaviouralResult,
      diamondResult,
    );

    const breakdown: SignalBreakdown = {
      region: regionScore.score,
      behavioural: behaviouralResult.score,
      diamond: diamondResult.score,
      contributions: {
        ...regionScore.contributions,
        ...behaviouralResult.contributions,
        ...diamondResult.contributions,
      },
    };

    const evaluatedAt = new Date();

    let persistedId: string | null = null;
    try {
      const row = await this.prisma.riskEngineDecision.create({
        data: {
          correlation_id: input.correlationId,
          subject_user_id: input.subjectUserId,
          intent: input.intent,
          composite_score: compositeScore,
          tier,
          signal_breakdown: breakdown as unknown as object,
          decision,
          reason_codes: reasonCodes as unknown as object,
          agent_id: input.diamond?.agentId ?? null,
          reason_code: this.primaryReasonCode(reasonCodes, tier),
          rule_applied_id: RISK_ENGINE_RULE_ID,
          evaluated_at: evaluatedAt,
        },
      });
      persistedId = row.id;
    } catch (err) {
      this.logger.warn('RiskEngine.evaluate: persistence failed', {
        correlation_id: input.correlationId,
        error: String(err),
      });
    }

    const result: RiskEvaluationResult = {
      id: persistedId,
      correlationId: input.correlationId,
      compositeScore,
      tier,
      decision,
      reasonCodes,
      signalBreakdown: breakdown,
      ruleAppliedId: RISK_ENGINE_RULE_ID,
      evaluatedAtUtc: evaluatedAt.toISOString(),
    };

    this.emit(result, input);
    return result;
  }

  /** Public read helper for downstream services / audit dashboards. */
  async findByCorrelationId(
    correlationId: string,
  ): Promise<RiskEvaluationResult | null> {
    const row = await this.prisma.riskEngineDecision.findUnique({
      where: { correlation_id: correlationId },
    });
    return row ? this.materialise(row) : null;
  }

  // ─── Scoring internals ────────────────────────────────────────────────────

  private async scoreRegion(region?: RegionSignals): Promise<{
    score: number;
    contributions: Record<string, number>;
  }> {
    if (!region) {
      return { score: 0, contributions: {} };
    }
    const r = await this.regionSignal.getConfidenceScore(region);
    // Confidence 1.0 → 0 risk. Confidence 0.0 → 35 risk pts.
    const score = Math.round((1 - Math.max(0, Math.min(1, r.confidence))) * 35);
    const contributions: Record<string, number> = {
      region_confidence: r.confidence,
      region_vpn_penalty: r.vpnRisk ? 1 : 0,
    };
    for (const flag of r.flags) {
      contributions[`region_flag_${flag}`] = 1;
    }
    return { score, contributions };
  }

  private scoreBehavioural(input: RiskEvaluationInput): {
    score: number;
    contributions: Record<string, number>;
    reasons: string[];
  } {
    const beh = input.behavioural;
    const contributions: Record<string, number> = {};
    const reasons: string[] = [];
    if (!beh) {
      return { score: 0, contributions, reasons };
    }

    let score = 0;

    // Spend velocity — $500/24h baseline; > $2,000 = +15.
    if (beh.spendVelocity24hUsd > 2_000) {
      score += 15;
      contributions.beh_spend_velocity_high = 1;
      reasons.push('SPEND_VELOCITY_HIGH');
    } else if (beh.spendVelocity24hUsd > 500) {
      score += 5;
      contributions.beh_spend_velocity_med = 1;
    }

    // Dispute history — every prior dispute is +6, capped at +18.
    const disputeHit = Math.min(3, Math.max(0, beh.prevDisputeCount)) * 6;
    if (disputeHit > 0) {
      score += disputeHit;
      contributions.beh_dispute_count = beh.prevDisputeCount;
      if (disputeHit >= 12) reasons.push('DISPUTE_HISTORY_HIGH');
    }

    // Failed auths — sustained failures imply card-testing.
    if (beh.failedAuthCount24h >= 5) {
      score += 12;
      contributions.beh_failed_auth_burst = 1;
      reasons.push('FAILED_AUTH_BURST');
    } else if (beh.failedAuthCount24h >= 2) {
      score += 4;
      contributions.beh_failed_auth_some = 1;
    }

    // New account — < 7 days tenure adds risk.
    if (beh.accountTenureDays < 7) {
      score += 8;
      contributions.beh_new_account = 1;
      reasons.push('NEW_ACCOUNT');
    } else if (beh.accountTenureDays < 30) {
      score += 3;
      contributions.beh_recent_account = 1;
    }

    // Long silence in active session paired with a spend = welfare flag.
    if (beh.silenceSecondsInSession >= 120) {
      score += 4;
      contributions.beh_long_silence = 1;
    }

    // High-heat burst paired with no prior tip = monetisation pressure.
    if (beh.highHeatBurstFlag) {
      score += 6;
      contributions.beh_high_heat_burst = 1;
      reasons.push('HEAT_BURST');
    }

    return { score, contributions, reasons };
  }

  private scoreDiamondConcierge(input: RiskEvaluationInput): {
    score: number;
    contributions: Record<string, number>;
    reasons: string[];
  } {
    const dia = input.diamond;
    const reasons: string[] = [];
    const contributions: Record<string, number> = {};
    if (!dia) {
      return { score: 0, contributions, reasons };
    }

    let score = 0;

    // Coercion + duress are the most serious flags — either alone is enough to
    // push into the CRITICAL band (≥ 85). Both raise the contribution to 90 so
    // a single flag forces ESCALATE regardless of other signals.
    if (dia.coercionFlag) {
      score += 90;
      contributions.dia_coercion = 1;
      reasons.push('CONCIERGE_COERCION');
    }
    if (dia.duressFlag) {
      score += 90;
      contributions.dia_duress = 1;
      reasons.push('CONCIERGE_DURESS');
    }

    // Intoxication / belligerence push into RED band but stop short of CRITICAL.
    if (dia.intoxicationFlag) {
      score += 25;
      contributions.dia_intoxication = 1;
      reasons.push('CONCIERGE_INTOXICATION');
    }
    if (dia.belligerenceFlag) {
      score += 18;
      contributions.dia_belligerence = 1;
      reasons.push('CONCIERGE_BELLIGERENCE');
    }

    return { score, contributions, reasons };
  }

  private tierForScore(score: number): RiskTier {
    if (score >= RISK_TIER_THRESHOLDS.RED_MAX + 1) return 'CRITICAL';
    if (score >= RISK_TIER_THRESHOLDS.AMBER_MAX + 1) return 'RED';
    if (score >= RISK_TIER_THRESHOLDS.GREEN_MAX + 1) return 'AMBER';
    return 'GREEN';
  }

  private decisionForTier(
    tier: RiskTier,
    input: RiskEvaluationInput,
  ): RiskDecision {
    if (tier === 'CRITICAL') return 'ESCALATE';
    if (tier === 'RED') return 'BLOCK';
    if (tier === 'AMBER') return 'REVIEW';
    // GREEN — Diamond intake always at least REVIEW so the agent has a
    // formal disposition row attached to every concierge call.
    if (input.intent === 'DIAMOND_INTAKE') return 'REVIEW';
    return 'PASS';
  }

  private collectReasonCodes(
    region: { contributions: Record<string, number> },
    beh: { reasons: string[] },
    dia: { reasons: string[] },
  ): string[] {
    const out: string[] = [];
    if (region.contributions['region_vpn_penalty']) out.push('REGION_VPN');
    if (region.contributions['region_flag_BIN_BILLING_MISMATCH']) {
      out.push('REGION_BIN_MISMATCH');
    }
    out.push(...beh.reasons);
    out.push(...dia.reasons);
    return out.slice(0, 5);
  }

  private primaryReasonCode(reasonCodes: readonly string[], tier: RiskTier): string {
    if (reasonCodes.length > 0) return reasonCodes[0];
    return `RISK_${tier}`;
  }

  // ─── Emission & materialisation ───────────────────────────────────────────

  private emit(result: RiskEvaluationResult, input: RiskEvaluationInput): void {
    const topic =
      result.decision === 'PASS'
        ? NATS_TOPICS.RISK_ENGINE_DECISION_PASS
        : result.decision === 'REVIEW'
        ? NATS_TOPICS.RISK_ENGINE_DECISION_REVIEW
        : result.decision === 'BLOCK'
        ? NATS_TOPICS.RISK_ENGINE_DECISION_BLOCK
        : NATS_TOPICS.RISK_ENGINE_DECISION_ESCALATE;

    this.nats.publish(topic, {
      correlation_id: result.correlationId,
      subject_user_id: input.subjectUserId,
      intent: input.intent,
      composite_score: result.compositeScore,
      tier: result.tier,
      decision: result.decision,
      reason_codes: result.reasonCodes,
      rule_applied_id: result.ruleAppliedId,
      evaluated_at_utc: result.evaluatedAtUtc,
    });

    // Immutable audit envelope — non-PII summary only.
    this.nats.publish(NATS_TOPICS.AUDIT_IMMUTABLE_RISK_ENGINE, {
      correlation_id: result.correlationId,
      subject_user_id: input.subjectUserId,
      intent: input.intent,
      composite_score: result.compositeScore,
      tier: result.tier,
      decision: result.decision,
      reason_codes: result.reasonCodes,
      agent_id: input.diamond?.agentId ?? null,
      rule_applied_id: result.ruleAppliedId,
      evaluated_at_utc: result.evaluatedAtUtc,
    });
  }

  private materialise(row: {
    id: string;
    correlation_id: string;
    composite_score: number;
    tier: string;
    decision: string;
    reason_codes: unknown;
    signal_breakdown: unknown;
    rule_applied_id: string;
    evaluated_at: Date;
  }): RiskEvaluationResult {
    const reasonCodes = Array.isArray(row.reason_codes)
      ? (row.reason_codes as string[])
      : [];
    const breakdown = (row.signal_breakdown as SignalBreakdown) ?? {
      region: 0,
      behavioural: 0,
      diamond: 0,
      contributions: {},
    };
    return {
      id: row.id,
      correlationId: row.correlation_id,
      compositeScore: row.composite_score,
      tier: row.tier as RiskTier,
      decision: row.decision as RiskDecision,
      reasonCodes,
      signalBreakdown: breakdown,
      ruleAppliedId: row.rule_applied_id,
      evaluatedAtUtc: row.evaluated_at.toISOString(),
    };
  }
}
