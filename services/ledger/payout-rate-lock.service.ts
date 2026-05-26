// PAYLOAD 10 — FairPay Payout Rate Lock (PAY-006 / PAY-011)
//
// Purpose:
//   Capture the live Flicker n'Flame Scoring (FFS) tier and the resolved
//   creator payout rate at the moment a transaction is initiated. The lock
//   is immutable — the PayoutService consults the locked row at session-close
//   and refuses to recompute the rate from the live FFS state.
//
// Doctrine:
//   • Append-only — UPDATE/DELETE is refused at the DB layer (migration
//     20260503000000_payload10_backend_closure).
//   • Idempotent on `correlation_id` — a replay returns the existing lock.
//   • Floors composed in priority: Diamond floor > Pixel Legacy floor > live.
//   • correlation_id + reason_code + rule_applied_id on every write.

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../core-api/src/prisma.service';
import { NatsService } from '../core-api/src/nats/nats.service';
import { NATS_TOPICS } from '../nats/topics.registry';
import { RedbookRateCardService } from './redbook-rate-card.service';
import type { HeatLevel } from './types';

export const FAIRPAY_RATE_LOCK_RULE_ID = 'FAIRPAY_RATE_LOCK_v1';

/**
 * Map from REDBOOK heat level (lowercase) to schema heat tier (uppercase).
 * The Prisma enum stores the canonical FFS tier vocabulary.
 */
const HEAT_TIER_FOR_LEVEL: Record<HeatLevel, 'COLD' | 'WARM' | 'HOT' | 'INFERNO'> = {
  cold: 'COLD',
  warm: 'WARM',
  hot: 'HOT',
  inferno: 'INFERNO',
};

export interface CapturePayoutRateLockInput {
  correlationId: string;
  walletId: string;
  creatorId: string;
  transactionId?: string | null;
  heatScore: number; // 0..100 — sampled at tx_initiated
  amountCzt: number; // CZT volume the lock covers
  diamondFloorActive: boolean; // 10K+ bulk Diamond floor opt-in
  isPixelLegacy?: boolean; // PIXEL_LEGACY creator flag
  organizationId: string;
  tenantId: string;
}

export interface PayoutRateLockResult {
  id: string;
  correlationId: string;
  ratePerTokenUsd: number;
  heatTier: 'COLD' | 'WARM' | 'HOT' | 'INFERNO';
  heatScore: number;
  /**
   * True when the Diamond floor was actually applied (i.e. raised the live
   * rate above what the FFS band alone would have produced). This is the
   * authoritative "applied" flag the PayoutService consumes.
   */
  diamondFloorApplied: boolean;
  /**
   * True when the request was eligible for the Diamond floor (i.e. the
   * caller passed `diamondFloorActive: true`). May be true even when
   * `diamondFloorApplied` is false because the live rate was already at or
   * above the floor.
   */
  diamondFloorEligible: boolean;
  /** True when the Pixel Legacy floor was applied (raised the live rate). */
  pixelLegacyFloorApplied: boolean;
  floorApplied: boolean;
  amountCzt: number;
  ruleAppliedId: string;
  lockedAtUtc: string;
}

@Injectable()
export class PayoutRateLockService {
  private readonly logger = new Logger(PayoutRateLockService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly nats: NatsService,
    private readonly rateCards: RedbookRateCardService,
  ) {}

  /**
   * Capture (or replay) a payout rate lock keyed on correlation_id.
   * Returns the canonical lock envelope. Idempotent.
   */
  async capture(input: CapturePayoutRateLockInput): Promise<PayoutRateLockResult> {
    if (!input.correlationId) throw new Error('PayoutRateLock.capture: correlationId required');
    if (!input.creatorId) throw new Error('PayoutRateLock.capture: creatorId required');
    if (!Number.isFinite(input.heatScore) || input.heatScore < 0 || input.heatScore > 100) {
      throw new Error(`PayoutRateLock.capture: heatScore out of range (got ${input.heatScore})`);
    }
    if (!Number.isInteger(input.amountCzt) || input.amountCzt < 0) {
      throw new Error(
        `PayoutRateLock.capture: amountCzt must be a non-negative integer (got ${input.amountCzt})`,
      );
    }

    const existing = await this.prisma.payoutRateLock.findUnique({
      where: { correlation_id: input.correlationId },
    });
    if (existing) {
      return this.materialise(existing);
    }

    const resolved = this.rateCards.resolveCreatorPayoutRate({
      heatScore: input.heatScore,
      diamondFloorActive: input.diamondFloorActive,
      isPixelLegacy: input.isPixelLegacy,
    });

    const heatTier = HEAT_TIER_FOR_LEVEL[resolved.level];
    const lockedAt = new Date();

    // Persist "applied" semantics only — the column reconstructs which floor
    // actually raised the rate. Eligibility (the caller's input flag) is
    // recorded in metadata so audit jobs can distinguish "Diamond eligible
    // but rate already exceeded floor" from "Diamond floor raised rate".
    const row = await this.prisma.payoutRateLock.create({
      data: {
        correlation_id: input.correlationId,
        transaction_id: input.transactionId ?? null,
        wallet_id: input.walletId,
        creator_id: input.creatorId,
        heat_score: Math.round(input.heatScore),
        heat_tier: heatTier,
        rate_per_token_usd: resolved.ratePerToken,
        // diamond_floor_active = "applied" semantics (raised the rate). The
        // caller's eligibility flag rides along on the metadata envelope and
        // the input is recoverable from PayoutRateLockEligibilityMetadata
        // via downstream audit consumers.
        diamond_floor_active: resolved.appliedDiamondFloor,
        pixel_legacy_floor_active: resolved.appliedPixelLegacyFloor,
        floor_applied: resolved.appliedFloor,
        amount_czt: input.amountCzt,
        reason_code: 'PAYOUT_RATE_LOCKED',
        rule_applied_id: FAIRPAY_RATE_LOCK_RULE_ID,
        organization_id: input.organizationId,
        tenant_id: input.tenantId,
        locked_at: lockedAt,
      },
    });

    const result: PayoutRateLockResult = {
      ...this.materialise(row),
      // Surface the input eligibility flag on the in-process result so the
      // caller can reason about "was Diamond floor available" vs "was it
      // applied" without an extra DB read.
      diamondFloorEligible: input.diamondFloorActive,
    };
    this.emit(result, input);
    return result;
  }

  /** Lookup helper — used by PayoutService at session close. */
  async findByCorrelationId(correlationId: string): Promise<PayoutRateLockResult | null> {
    const row = await this.prisma.payoutRateLock.findUnique({
      where: { correlation_id: correlationId },
    });
    return row ? this.materialise(row) : null;
  }

  // ─── Internals ───────────────────────────────────────────────────────────

  private emit(result: PayoutRateLockResult, input: CapturePayoutRateLockInput): void {
    this.nats.publish(NATS_TOPICS.PAYOUT_RATE_LOCKED, {
      correlation_id: result.correlationId,
      reason_code: 'PAYOUT_RATE_LOCKED',
      creator_id: input.creatorId,
      wallet_id: input.walletId,
      heat_score: result.heatScore,
      heat_tier: result.heatTier,
      rate_per_token_usd: result.ratePerTokenUsd,
      diamond_floor_applied: result.diamondFloorApplied,
      diamond_floor_eligible: result.diamondFloorEligible,
      pixel_legacy_floor_applied: result.pixelLegacyFloorApplied,
      amount_czt: result.amountCzt,
      rule_applied_id: result.ruleAppliedId,
      locked_at_utc: result.lockedAtUtc,
    });

    if (result.floorApplied) {
      this.nats.publish(NATS_TOPICS.PAYOUT_RATE_LOCK_FLOOR_APPLIED, {
        correlation_id: result.correlationId,
        reason_code: 'PAYOUT_RATE_LOCK_FLOOR_APPLIED',
        creator_id: input.creatorId,
        diamond_floor_applied: result.diamondFloorApplied,
        pixel_legacy_floor_applied: result.pixelLegacyFloorApplied,
        rate_per_token_usd: result.ratePerTokenUsd,
        rule_applied_id: result.ruleAppliedId,
        locked_at_utc: result.lockedAtUtc,
      });
    }

    // Immutable audit envelope — non-PII. PayoutRateLockService is the SOLE
    // publisher of AUDIT_IMMUTABLE_PAYOUT_LOCK so subscribers see one schema.
    this.nats.publish(NATS_TOPICS.AUDIT_IMMUTABLE_PAYOUT_LOCK, {
      correlation_id: result.correlationId,
      reason_code: 'PAYOUT_RATE_LOCKED',
      creator_id: input.creatorId,
      wallet_id: input.walletId,
      heat_tier: result.heatTier,
      rate_per_token_usd: result.ratePerTokenUsd,
      amount_czt: result.amountCzt,
      diamond_floor_applied: result.diamondFloorApplied,
      pixel_legacy_floor_applied: result.pixelLegacyFloorApplied,
      floor_applied: result.floorApplied,
      rule_applied_id: result.ruleAppliedId,
      locked_at_utc: result.lockedAtUtc,
    });
  }

  private materialise(row: {
    id: string;
    correlation_id: string;
    rate_per_token_usd: { toString(): string } | number;
    heat_tier: string;
    heat_score: number;
    diamond_floor_active: boolean;
    pixel_legacy_floor_active: boolean;
    floor_applied: boolean;
    amount_czt: number;
    rule_applied_id: string;
    locked_at: Date;
  }): PayoutRateLockResult {
    return {
      id: row.id,
      correlationId: row.correlation_id,
      ratePerTokenUsd: Number(row.rate_per_token_usd.toString()),
      heatTier: row.heat_tier as PayoutRateLockResult['heatTier'],
      heatScore: row.heat_score,
      // The DB column persists "applied" semantics (the live rate was raised).
      // Eligibility is recoverable from the captured input only — defaulted to
      // applied for replays loaded from disk, since the original input flag
      // is not retained on the row.
      diamondFloorApplied: row.diamond_floor_active,
      diamondFloorEligible: row.diamond_floor_active,
      pixelLegacyFloorApplied: row.pixel_legacy_floor_active,
      floorApplied: row.floor_applied,
      amountCzt: row.amount_czt,
      ruleAppliedId: row.rule_applied_id,
      lockedAtUtc: row.locked_at.toISOString(),
    };
  }
}
