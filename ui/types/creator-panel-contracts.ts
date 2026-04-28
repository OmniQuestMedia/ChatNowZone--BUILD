// PAYLOAD 7 — Creator-facing UI contracts for /creator/control (Command Center).
// Extends the Payload-5 creator-control-contracts.ts with view-model shapes
// specific to the CreatorControl command pane: FFS (Flicker n'Flame Scoring) meter, Cyrano panel,
// broadcast timing copilot, persona switcher, payout rate indicator.

import type {
  FfsTier,
  HeatMeterFrame,
  PriceNudgeCard,
  BroadcastWindowRow,
  CyranoPanelSuggestion,
} from './creator-control-contracts';

/** Payout rate indicator — live creator revenue per token. */
export interface PayoutRateIndicator {
  creator_id: string;
  tier_context: FfsTier;
  current_rate_per_token_usd: number;
  redbook_floor_per_token_usd: number; // 0.075
  redbook_ceiling_per_token_usd: number; // 0.090
  scaling_pct_applied: number; // 0, 5, or 10 (HOT / INFERNO)
  captured_at_utc: string;
  reason_code: 'PAYOUT_SCALING_APPLIED';
}

/** Flicker n'Flame Scoring (FFS) meter (visual gauge). */
export interface FfsMeter {
  session_id: string;
  tier: FfsTier;
  score: number; // 0..100
  components: {
    tipper_pressure: number; // 0..40
    velocity: number; // 0..40
    vip_presence: number; // 0..20
  };
  tier_min: number; // inclusive lower bound for current tier
  tier_max: number; // exclusive upper bound
  captured_at_utc: string;
}

/** Cyrano whisper panel with heat-weighted suggestions. */
export interface CyranoWhisperPanel {
  creator_id: string;
  session_id: string | null;
  active_persona_id: string | null;
  personas_available: Array<{
    persona_id: string;
    display_name: string;
    tone: string;
    style_notes: string;
    active: boolean;
  }>;
  suggestions: CyranoPanelSuggestion[];
  latency_sla_ms: number;
  latency_last_observed_ms: number | null;
  generated_at_utc: string;
}

/** Broadcast Timing Copilot dashboard table. */
export interface BroadcastTimingDashboard {
  creator_id: string;
  windows: BroadcastWindowRow[];
  generated_at_utc: string;
  reason_code: 'BROADCAST_TIMING_COPILOT';
}

/** Live session monitoring panel (suggestion card + current nudge). */
export interface SessionMonitoringPanel {
  creator_id: string;
  active_session_id: string | null;
  latest_heat: HeatMeterFrame | null;
  latest_nudge: PriceNudgeCard | null;
  generated_at_utc: string;
}

/** Aggregate dashboard payload for /creator/control. */
export interface CreatorCommandCenterView {
  creator_id: string;
  display_name: string;
  obs_ready: boolean;
  chat_aggregator_ready: boolean;
  heat_meter: FfsMeter | null;
  session_monitoring: SessionMonitoringPanel;
  broadcast_timing: BroadcastTimingDashboard;
  cyrano_panel: CyranoWhisperPanel;
  payout_rate: PayoutRateIndicator;
  generated_at_utc: string;
  rule_applied_id: string;
}

// ─── Screen 05 — Pixel Legacy Application contracts ────────────────────────
// Source of truth: PIXEL-LEGACY-001 directive, docs/ux/03-state-machines.md §10,
// docs/ux/05-tier-entitlements.md §Creator types.

/**
 * Lifecycle status of a creator's Pixel Legacy application.
 * Matches the state machine in docs/ux/03-state-machines.md §10.
 */
export type PixelLegacyApplicationStatus = 'DRAFT' | 'APPLIED' | 'REVIEWED' | 'GRANTED' | 'DENIED';

/** Seat availability meter — 3,500 lifetime cap. */
export interface PixelLegacySeatMeter {
  /** Number of seats already granted. */
  seats_taken: number;
  /** Platform cap — canonical value is 3,500. */
  seats_total: number;
  /** Derived: seats_total − seats_taken. */
  seats_remaining: number;
  /** True when seats_taken >= seats_total. */
  cap_reached: boolean;
}

/**
 * One portfolio / proof-of-work entry submitted with the application.
 * Creators provide at least one entry (required by the application form).
 */
export interface PixelLegacyPortfolioEntry {
  entry_id: string;
  /** Creator-provided label, e.g. "My Twitch channel". */
  label: string;
  /** Public URL pointing to the creator's portfolio or social presence. */
  url: string;
}

/** Benefits summary shown to the applicant before and after grant. */
export interface PixelLegacyBenefits {
  /** Minimum per-token payout in USD ($0.07 floor for Pixel Legacy). */
  payout_range_min_usd: number;
  /** Maximum per-token payout in USD ($0.09 ceiling — RATE_INFERNO). */
  payout_range_max_usd: number;
  /** True — Pixel Legacy creators carry a lifetime Cyrano membership flag. */
  lifetime_cyrano: boolean;
  /** The month at which the Pixel Legacy Signing Bonus is triggered (month 4). */
  signing_bonus_month: number;
  /** Display badge label rendered on the creator's profile. */
  badge_label: 'Pixel Legacy';
}

/**
 * Top-level view model for /creator/pixel-legacy — the Pixel Legacy Onboarding page.
 * Consumed by renderPixelLegacyPage; built by PixelLegacyPresenter.buildView().
 */
export interface PixelLegacyApplicationView {
  /**
   * Stable application identifier assigned on first submission.
   * Null when status is DRAFT (application not yet submitted).
   */
  application_id: string | null;
  creator_id: string;
  display_name: string;
  /** Current application lifecycle state. */
  status: PixelLegacyApplicationStatus;
  /** Live seat-availability meter (refreshed at view-generation time). */
  seat_meter: PixelLegacySeatMeter;
  /** Portfolio / proof-of-work entries provided by the creator. */
  portfolio_entries: PixelLegacyPortfolioEntry[];
  /** Free-text proof statement supplied by the creator in the form. */
  proof_statement: string;
  /** ISO-8601 timestamp of submission. Null when status is DRAFT. */
  submitted_at_utc: string | null;
  /** ISO-8601 timestamp when the review decision was recorded. Null until reviewed. */
  reviewed_at_utc: string | null;
  /**
   * Platform reason code for denial. Only populated on DENIED status.
   * Maps to the reason-code catalog in docs/ux/04-reason-code-catalog.md.
   */
  denial_reason_code: string | null;
  /** Benefits preview — shown pre-grant to explain what the creator receives. */
  benefits: PixelLegacyBenefits;
  /**
   * True once GRANTED — signals the renderer to unlock the creator's Cyrano panel CTA.
   * Always false until status = GRANTED.
   */
  cyrano_panel_unlocked: boolean;
  /** ISO-8601 timestamp when this view was generated. */
  generated_at_utc: string;
  rule_applied_id: string;
}
