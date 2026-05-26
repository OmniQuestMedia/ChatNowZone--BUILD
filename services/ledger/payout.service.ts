// FIZ: PAYLOAD-001 — Payout / Flicker n'Flame Scoring (FFS) stub
// Settles a creator session at close: reads session CZT, resolves the
// FFS payout rate, and credits the creator wallet's `bonus` bucket
// with the computed USD-equivalent payout recorded in CZT.
// Full FFS engine is in services/ffs/; this module provides the
// deterministic plumbing those consumers will call into.
//
// PIXEL-LEGACY-003 — accepts isPixelLegacy on the input and forwards it
// to the rate-card resolver so the $0.07 Pixel Legacy floor protects
// Pixel Legacy creators when the live rate would otherwise drop below.

import type { LedgerService } from './ledger.service';
import type { HeatLevel, LedgerBucket } from './types';
import type { RedbookRateCardService } from './redbook-rate-card.service';
import type { PayoutRateLockService, PayoutRateLockResult } from './payout-rate-lock.service';

export interface SessionCloseInput {
  sessionId: string; // correlation_id root
  creatorWalletId: string;
  grossCzt: number; // total CZT earned this session (integer)
  heatScore: number; // 0–100 — from FFS scorer
  diamondFloorActive: boolean; // true when creator has Diamond floor guarantee
  isPixelLegacy?: boolean; // true when creator is PIXEL_LEGACY type — applies the $0.07 floor
  /**
   * PAY-006 — optional reference to a captured PayoutRateLock. When present
   * the locked rate is honoured verbatim (no re-resolution from live FFS).
   * The `heatScore` argument is still used to populate the metadata block.
   */
  rateLockCorrelationId?: string;
}

export interface SessionPayoutResult {
  ledgerBucket: LedgerBucket; // always 'bonus' for creator payouts
  heatLevel: HeatLevel;
  ratePerToken: number;
  payoutUsd: number; // for reporting
  payoutCzt: number; // what was credited to the wallet
  appliedFloor: boolean; // any floor was raised above live
  appliedDiamondFloor: boolean; // Diamond floor specifically
  appliedPixelLegacyFloor: boolean; // Pixel Legacy floor specifically
  correlationId: string;
}

export class PayoutService {
  constructor(
    private readonly ledger: LedgerService,
    private readonly rateCards: RedbookRateCardService,
    /**
     * Optional rate-lock service (PAY-006). When supplied, the payout flow
     * prefers the locked rate over re-resolving from live FFS so the rate
     * captured at purchase wins.
     */
    private readonly rateLock?: PayoutRateLockService,
  ) {}

  /**
   * Idempotent on `sessionId`: settles the creator share of a session into
   * the creator wallet's bonus bucket. FFS payout rate is resolved once at
   * close-time and persisted in the ledger metadata for later audit. When a
   * `rateLockCorrelationId` is supplied the locked rate is honoured —
   * recomputation is refused per PAY-006.
   */
  async settleSessionClose(input: SessionCloseInput): Promise<SessionPayoutResult> {
    if (!Number.isInteger(input.grossCzt) || input.grossCzt < 0) {
      throw new Error(`grossCzt must be a non-negative integer (got ${input.grossCzt})`);
    }
    if (input.heatScore < 0 || input.heatScore > 100) {
      throw new Error(`heatScore must be 0–100 (got ${input.heatScore})`);
    }

    const lock: PayoutRateLockResult | null =
      input.rateLockCorrelationId && this.rateLock
        ? await this.rateLock.findByCorrelationId(input.rateLockCorrelationId)
        : null;

    const rate = lock
      ? {
          level: lock.heatTier.toLowerCase() as HeatLevel,
          ratePerToken: lock.ratePerTokenUsd,
          appliedFloor: lock.floorApplied,
          // PAY-006 audit invariant — the lock's `*Applied` fields carry
          // "this floor actually raised the live rate" semantics, distinct
          // from "eligible". PayoutService writes the applied flags to the
          // ledger metadata so settlement reconciliation matches reality.
          appliedDiamondFloor: lock.diamondFloorApplied,
          appliedPixelLegacyFloor: lock.pixelLegacyFloorApplied,
        }
      : this.rateCards.resolveCreatorPayoutRate({
          heatScore: input.heatScore,
          diamondFloorActive: input.diamondFloorActive,
          isPixelLegacy: input.isPixelLegacy,
        });

    // Payout USD is grossCzt * ratePerToken; but we credit the creator wallet
    // in CZT, not USD. The CZT figure is identical to grossCzt (platform fee
    // is handled at guest purchase time via REDBOOK margin, not here).
    const correlationId = `PAYOUT:${input.sessionId}`;
    const payoutCzt = input.grossCzt;
    const payoutUsd = payoutCzt * rate.ratePerToken;

    if (payoutCzt > 0) {
      await this.ledger.credit({
        walletId: input.creatorWalletId,
        bucket: 'bonus',
        amount: payoutCzt,
        correlationId,
        reasonCode: 'PAYOUT',
        metadata: {
          session_id: input.sessionId,
          ffs_score: input.heatScore,
          heat_level: rate.level,
          rate_per_token: rate.ratePerToken,
          applied_diamond_floor: rate.appliedDiamondFloor,
          applied_pixel_legacy_floor: rate.appliedPixelLegacyFloor,
          is_pixel_legacy: input.isPixelLegacy ?? false,
          payout_usd: payoutUsd,
          // PAY-006 — emit the lock id so audit jobs can join back to
          // payout_rate_locks and verify the locked rate was honoured.
          payout_rate_lock_id: lock?.id ?? null,
          payout_rate_lock_correlation_id: lock?.correlationId ?? null,
          rate_source: lock ? 'PAYOUT_RATE_LOCK' : 'LIVE_FFS_RESOLUTION',
        },
      });
    }

    return {
      ledgerBucket: 'bonus',
      heatLevel: rate.level,
      ratePerToken: rate.ratePerToken,
      payoutUsd,
      payoutCzt,
      appliedFloor: rate.appliedFloor,
      appliedDiamondFloor: rate.appliedDiamondFloor,
      appliedPixelLegacyFloor: rate.appliedPixelLegacyFloor,
      correlationId,
    };
  }
}
