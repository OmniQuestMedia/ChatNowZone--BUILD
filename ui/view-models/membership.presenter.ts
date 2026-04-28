// Screen 04 — MembershipPresenter: builds MembershipLifecycleView for /vip/membership.
// Pure TypeScript — no NestJS or service-layer imports. Governance constants are
// injected via MembershipGovernanceSnapshot so the presenter can be unit-tested
// without importing the service bootstrap graph.

import type {
  FfsHeatPoint,
  MembershipGovernanceSnapshot,
  MembershipLifecycleStatus,
  MembershipLifecycleView,
  ThreeFifthsExitOfferCard,
  TokenBridgeOfferCard,
  TopUpCztSummary,
  VipTier,
} from '../types/membership-lifecycle-contracts';
import type { WalletBucket } from '../types/public-wallet-contracts';

export const MEMBERSHIP_PRESENTER_RULE_ID = 'MEMBERSHIP_LIFECYCLE_UI_v1';

// ─── Default governance snapshot ──────────────────────────────────────────
// Mirrors RECOVERY_ENGINE + MEMBERSHIP in governance.config.ts.
// Production callers MUST pass a live snapshot; these defaults allow the
// presenter to be tested without pulling in the service bootstrap graph.
export const DEFAULT_MEMBERSHIP_GOVERNANCE: MembershipGovernanceSnapshot = {
  expiry_warning_hours: 48,
  token_bridge_bonus_pct_int: 20,       // 20% — RECOVERY_ENGINE.TOKEN_BRIDGE_BONUS_PCT
  token_bridge_restriction_hours: 24,
  token_bridge_waiver_limit_per_year: 1,
  three_fifths_refund_pct_int: 60,      // 60% — RECOVERY_ENGINE.THREE_FIFTHS_REFUND_PCT
  three_fifths_lock_hours: 24,
  stipend_czt: {
    VIP: 0,
    VIP_SILVER: 100,
    VIP_GOLD: 175,
    VIP_PLATINUM: 250,
    VIP_DIAMOND: 500,
  },
} as const;

// ─── Input shapes ──────────────────────────────────────────────────────────

export interface WalletBucketInput {
  bucket: WalletBucket;
  balance_tokens: bigint;
  spend_priority: number;
}

export interface FfsHeatPointInput {
  captured_at_utc: string;
  score: number;
  tier: FfsHeatPoint['tier'];
}

export interface MembershipPresenterInputs {
  membership_id: string;
  user_id: string;
  tier: VipTier;
  active_since_utc: string;
  /**
   * Expiry timestamp. Pass null only for the free VIP tier (permanent).
   * Paid tiers always carry an expiry.
   */
  expires_at_utc: string | null;
  /** True when a NATS EXPIRY_WARNING event has been received. */
  nats_warning_received: boolean;
  /**
   * Remaining paid balance in tokens (used to compute Three-Fifths refund).
   * Pass null if this is the free VIP tier (no paid block).
   */
  remaining_paid_balance_tokens: bigint | null;
  /**
   * Original purchase price in USD cents (used for Three-Fifths refund estimate).
   * Pass null if no paid block exists.
   */
  original_purchase_usd_cents: bigint | null;
  /** True when this member has already used a Token Bridge waiver this year. */
  token_bridge_waiver_used_this_year: boolean;
  /** Three-bucket wallet balances. */
  wallet_buckets: WalletBucketInput[];
  /** FFS heat history — latest-first; presenter clips to 24 points. */
  ffs_heat_history: FfsHeatPointInput[];
  /** Override for "now" — used in tests to produce deterministic output. */
  now_utc?: Date;
  /** Governance snapshot — defaults to DEFAULT_MEMBERSHIP_GOVERNANCE in tests. */
  governance?: MembershipGovernanceSnapshot;
}

// ─── Presenter class ───────────────────────────────────────────────────────

export class MembershipPresenter {
  private readonly RULE_ID = MEMBERSHIP_PRESENTER_RULE_ID;

  buildView(inputs: MembershipPresenterInputs): MembershipLifecycleView {
    const now = inputs.now_utc ?? new Date();
    const gov = inputs.governance ?? DEFAULT_MEMBERSHIP_GOVERNANCE;

    const hours_until_expiry = this.resolveHoursUntilExpiry(inputs.expires_at_utc, now);
    const status = this.resolveStatus(
      inputs.nats_warning_received,
      hours_until_expiry,
      inputs.expires_at_utc,
      now,
    );

    const token_bridge_offer = this.buildTokenBridgeOffer(
      status,
      inputs.remaining_paid_balance_tokens,
      inputs.token_bridge_waiver_used_this_year,
      gov,
    );

    const three_fifths_exit_offer = this.buildThreeFifthsExitOffer(
      status,
      inputs.tier,
      inputs.remaining_paid_balance_tokens,
      inputs.original_purchase_usd_cents,
      gov,
    );

    const top_up_summary = this.buildTopUpSummary(inputs.wallet_buckets, inputs.tier, gov);

    const ffs_heat_history: FfsHeatPoint[] = inputs.ffs_heat_history.slice(0, 24).map((p) => ({
      captured_at_utc: p.captured_at_utc,
      score: p.score,
      tier: p.tier,
    }));

    return {
      membership_id: inputs.membership_id,
      user_id: inputs.user_id,
      tier: inputs.tier,
      status,
      active_since_utc: inputs.active_since_utc,
      expires_at_utc: inputs.expires_at_utc,
      hours_until_expiry,
      nats_warning_received: inputs.nats_warning_received,
      token_bridge_offer,
      three_fifths_exit_offer,
      top_up_summary,
      ffs_heat_history,
      generated_at_utc: now.toISOString(),
      rule_applied_id: this.RULE_ID,
    };
  }

  // ── Private helpers ────────────────────────────────────────────────────

  private resolveHoursUntilExpiry(expires_at_utc: string | null, now: Date): number | null {
    if (!expires_at_utc) return null;
    const expiryMs = new Date(expires_at_utc).getTime();
    const diffMs = expiryMs - now.getTime();
    if (diffMs <= 0) return null; // already expired
    return Math.round((diffMs / (60 * 60 * 1000)) * 10) / 10;
  }

  private resolveStatus(
    nats_warning_received: boolean,
    hours_until_expiry: number | null,
    expires_at_utc: string | null,
    now: Date,
  ): MembershipLifecycleStatus {
    if (!expires_at_utc) return 'ACTIVE'; // free VIP — permanent
    const expired = new Date(expires_at_utc).getTime() <= now.getTime();
    if (expired) return 'EXPIRED';
    // EXPIRING: within the 48-hour window OR NATS warning received.
    if (nats_warning_received || (hours_until_expiry !== null && hours_until_expiry <= 48)) {
      return 'EXPIRING';
    }
    return 'ACTIVE';
  }

  private buildTokenBridgeOffer(
    status: MembershipLifecycleStatus,
    remaining_tokens: bigint | null,
    waiver_used: boolean,
    gov: MembershipGovernanceSnapshot,
  ): TokenBridgeOfferCard | null {
    if (status !== 'EXPIRING' && status !== 'EXPIRED') return null;
    if (remaining_tokens === null || remaining_tokens <= 0n) return null;

    const bonus_tokens = (
      (remaining_tokens * BigInt(gov.token_bridge_bonus_pct_int)) /
      100n
    ).toString();

    return {
      bonus_pct: gov.token_bridge_bonus_pct_int / 100,
      bonus_tokens,
      restriction_window_hours: gov.token_bridge_restriction_hours,
      waiver_eligible: !waiver_used,
      rule_applied_id: 'REDBOOK_RECOVERY_v1',
    };
  }

  private buildThreeFifthsExitOffer(
    status: MembershipLifecycleStatus,
    tier: VipTier,
    remaining_tokens: bigint | null,
    original_purchase_usd_cents: bigint | null,
    gov: MembershipGovernanceSnapshot,
  ): ThreeFifthsExitOfferCard | null {
    // Free VIP has no paid block — no refund possible.
    if (tier === 'VIP') return null;
    if (status !== 'EXPIRING' && status !== 'EXPIRED') return null;
    if (remaining_tokens === null || original_purchase_usd_cents === null) return null;

    // Refund estimate: refund_pct of original purchase price in USD cents.
    const refund_cents = (
      (original_purchase_usd_cents * BigInt(gov.three_fifths_refund_pct_int)) /
      100n
    ).toString();

    return {
      refund_pct: gov.three_fifths_refund_pct_int / 100,
      lock_hours: gov.three_fifths_lock_hours,
      // Three-Fifths Exit always requires a policy gate per FIZ-002-REVISION.
      policy_gated: true,
      estimated_refund_usd_cents: refund_cents,
      rule_applied_id: 'REDBOOK_RECOVERY_v1',
    };
  }

  private buildTopUpSummary(
    wallet_buckets: WalletBucketInput[],
    tier: VipTier,
    gov: MembershipGovernanceSnapshot,
  ): TopUpCztSummary {
    const sorted = [...wallet_buckets].sort((a, b) => a.spend_priority - b.spend_priority);
    let total = 0n;
    const buckets = sorted.map((b) => {
      total += b.balance_tokens;
      return {
        bucket: b.bucket,
        balance_tokens: b.balance_tokens.toString(),
        spend_priority: b.spend_priority,
      };
    });
    return {
      buckets,
      total_tokens: total.toString(),
      tier_stipend_czt: gov.stipend_czt[tier],
    };
  }
}
