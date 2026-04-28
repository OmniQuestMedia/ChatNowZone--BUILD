// Screen 04 — VIP Membership Lifecycle UI contracts for /vip/membership.
// Presenter binding: MembershipView (active → expiring → expired → recovered).
// Source of truth: MEMBERSHIP_LIFECYCLE_POLICY.md v1.0, RECOVERY_ENGINE in
// services/core-api/src/config/governance.config.ts, and the state machine in
// docs/ux/03-state-machines.md §3–4.

import type { FfsTier } from './creator-control-contracts';
import type { WalletBucket } from './public-wallet-contracts';

/** Canonical lifecycle states a paid VIP tier block can be in. */
export type MembershipLifecycleStatus = 'ACTIVE' | 'EXPIRING' | 'EXPIRED' | 'RECOVERED';

/**
 * Canonical VIP tier values (sub-tiers only — this view is not shown to GUEST).
 * Matches the MembershipTier enum in MEMBERSHIP_LIFECYCLE_POLICY.md §1.
 */
export type VipTier = 'VIP' | 'VIP_SILVER' | 'VIP_GOLD' | 'VIP_PLATINUM' | 'VIP_DIAMOND';

/** Human-readable display label for each VIP tier. */
export const VIP_TIER_LABEL: Record<VipTier, string> = {
  VIP: 'VIP',
  VIP_SILVER: 'VIP Silver',
  VIP_GOLD: 'VIP Gold',
  VIP_PLATINUM: 'VIP Platinum',
  VIP_DIAMOND: 'VIP Diamond',
} as const;

// ─── Recovery offer shapes ─────────────────────────────────────────────────

/** Token Bridge offer card (Pillar 1 recovery — bonus CZT, no cash refund). */
export interface TokenBridgeOfferCard {
  /** Bonus percentage awarded on bridged balance. RECOVERY_ENGINE.TOKEN_BRIDGE_BONUS_PCT = 0.20 */
  bonus_pct: number;
  /** Bonus token amount expressed as a string (bigint precision). */
  bonus_tokens: string;
  /** Hours during which the bridged tokens are restricted. */
  restriction_window_hours: number;
  /** Waiver eligibility flag — true when the guest qualifies for the one-per-year waiver. */
  waiver_eligible: boolean;
  rule_applied_id: 'REDBOOK_RECOVERY_v1';
}

/** Three-Fifths Exit offer card (Pillar 2 recovery — partial cash refund, policy-gated). */
export interface ThreeFifthsExitOfferCard {
  /** Refund percentage. RECOVERY_ENGINE.THREE_FIFTHS_REFUND_PCT = 0.60 */
  refund_pct: number;
  /** Post-refund lock period in hours. RECOVERY_ENGINE.THREE_FIFTHS_LOCK_HOURS = 24 */
  lock_hours: number;
  /** True when CEO override is required before the exit can be processed. */
  policy_gated: boolean;
  /** Estimated refund amount in USD cents (bigint as string). */
  estimated_refund_usd_cents: string;
  rule_applied_id: 'REDBOOK_RECOVERY_v1';
}

/** Top-up CZT offer — presents the current three-bucket wallet state for top-up context. */
export interface TopUpCztSummary {
  /** Per-bucket balances in spend-priority order. */
  buckets: ReadonlyArray<{
    bucket: WalletBucket;
    /** Balance in tokens, bigint as string. */
    balance_tokens: string;
    spend_priority: number;
  }>;
  /** Total token balance across all buckets (bigint as string). */
  total_tokens: string;
  /** Monthly CZT stipend for this tier, shown as context for top-up decision. */
  tier_stipend_czt: number;
}

// ─── FFS heat history sparkline ───────────────────────────────────────────

/** One data point on the FFS heat history sparkline. */
export interface FfsHeatPoint {
  /** ISO-8601 timestamp of the observation. */
  captured_at_utc: string;
  /** FFS score 0–100. */
  score: number;
  /** Heat tier at the time of observation. */
  tier: FfsTier;
}

// ─── Top-level view ────────────────────────────────────────────────────────

// ─── Governance snapshot injected by the presenter ────────────────────────

/**
 * Subset of governance constants required by MembershipPresenter.
 * Mirrors RECOVERY_ENGINE + MEMBERSHIP.STIPEND_CZT in governance.config.ts.
 */
export interface MembershipGovernanceSnapshot {
  /** Hours before expiry when the EXPIRY_WARNING banner fires. Default: 48. */
  expiry_warning_hours: number;
  /** Token Bridge bonus percentage. RECOVERY_ENGINE.TOKEN_BRIDGE_BONUS_PCT. */
  token_bridge_bonus_pct: number;
  /** Hours the bridged tokens are restricted post-bridge. */
  token_bridge_restriction_hours: number;
  /** Max waivers per guest per 365-day window. RECOVERY_ENGINE.TOKEN_BRIDGE_WAIVER_LIMIT. */
  token_bridge_waiver_limit_per_year: number;
  /** Three-Fifths refund percentage. RECOVERY_ENGINE.THREE_FIFTHS_REFUND_PCT. */
  three_fifths_refund_pct: number;
  /** Lock hours after Three-Fifths Exit. RECOVERY_ENGINE.THREE_FIFTHS_LOCK_HOURS. */
  three_fifths_lock_hours: number;
  /** Monthly CZT stipend per VIP sub-tier. MEMBERSHIP.STIPEND_CZT. */
  stipend_czt: Record<VipTier, number>;
}

// ─── Top-level view ────────────────────────────────────────────────────────

/**
 * Aggregate view model for /vip/membership — the Membership Lifecycle View.
 * Consumed by renderMembershipPage; built by MembershipPresenter.buildView().
 */
export interface MembershipLifecycleView {
  membership_id: string;
  user_id: string;

  /** Canonical tier. All five VIP sub-tiers are supported by this view. */
  tier: VipTier;

  /** Current lifecycle phase. Drives banner copy and recovery option visibility. */
  status: MembershipLifecycleStatus;

  /** ISO-8601 timestamp when this tier block became active. */
  active_since_utc: string;

  /**
   * ISO-8601 expiry timestamp.
   * Null only for the free VIP tier (permanent once earned per policy §3.2).
   */
  expires_at_utc: string | null;

  /**
   * Hours remaining until expiry at view-generation time.
   * Null when expires_at_utc is null or status is EXPIRED / RECOVERED.
   */
  hours_until_expiry: number | null;

  /**
   * True when a NATS EXPIRY_WARNING event has been received for this membership.
   * Used by the renderer to show the NATS-driven warning banner.
   */
  nats_warning_received: boolean;

  /**
   * Token Bridge offer — present when status is EXPIRING or EXPIRED.
   * Null in ACTIVE / RECOVERED states.
   */
  token_bridge_offer: TokenBridgeOfferCard | null;

  /**
   * Three-Fifths Exit offer — present when status is EXPIRING or EXPIRED
   * and the tier has a paid balance to refund. Null otherwise.
   * Free VIP tier: always null (no paid balance).
   */
  three_fifths_exit_offer: ThreeFifthsExitOfferCard | null;

  /**
   * Top-up CZT summary — always present so the guest can see their
   * wallet state relative to renewal cost.
   */
  top_up_summary: TopUpCztSummary;

  /**
   * FFS heat history for the sparkline component (latest-first, max 24 points).
   * Empty array when no session history exists for this user.
   */
  ffs_heat_history: FfsHeatPoint[];

  /** ISO-8601 timestamp when this view was generated. */
  generated_at_utc: string;

  rule_applied_id: string;
}
