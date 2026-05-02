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

// ─── Core Surface 02 — Creator Cyrano Control Panel extensions ───────────────

/**
 * CyranoSessionSummary — a compact status card shown at the top of the
 * /creator/control command pane. Summarises the active Cyrano™ session state
 * so the creator can see persona, latency, and suggestion count at a glance.
 */
export interface CyranoSessionSummary {
  creator_id: string;
  session_id: string | null;
  active_persona_display_name: string | null;
  suggestion_count: number;
  latency_last_observed_ms: number | null;
  latency_sla_ms: number;
  latency_within_sla: boolean;
  tier_context: FfsTier;
  generated_at_utc: string;
}

/**
 * Diamond Concierge handoff CTA card — rendered only when the FFS tier
 * reaches INFERNO. Prompts the creator to initiate a high-value handoff
 * to an OQMI Diamond Concierge operator.
 */
export interface DiamondHandoffCta {
  session_id: string;
  ffs_score: number;
  ffs_tier: 'INFERNO'; // only emitted at INFERNO
  estimated_volume_tokens: number | null; // derived from session velocity
  floor_rate_usd: number; // $0.077
  ceiling_rate_usd: number; // $0.090
  handoff_quote_url: string; // deep-link to /admin/diamond?action=handoff&session={id}
  reason_code: 'INFERNO_HANDOFF_ELIGIBLE';
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

// ─── PIXEL-LEGACY-002: first-come-first-served gateway view ─────────────────
// Supersedes the v1 application/review contract. Pixel Legacy is granted
// automatically when a creator completes onboarding while the gateway is
// open; there is no apply form, no portfolio, no proof statement, no operator
// review. The /creator/pixel-legacy page becomes a status display.

/** Public seat-availability meter — UI-displayed value clamped at the
 *  marketing cap (3,000). The actual gateway closes at 3,500 (internal). */
export interface PixelLegacySeatMeter {
  /** Marketing-clamped count: min(actual_grants, MARKETING_SEAT_CAP). */
  seats_taken: number;
  /** Marketing cap — canonical value is 3,000. */
  seats_total: number;
  /** Derived: seats_total − seats_taken. */
  seats_remaining: number;
  /** True when seats_taken >= seats_total (i.e. UI shows "100%"). */
  cap_reached: boolean;
  /** True iff new onboardings can still receive a Pixel Legacy seat. May
   *  remain true even after cap_reached, while the internal 500-seat buffer
   *  drains from MARKETING_SEAT_CAP up to SEAT_CAP. */
  gateway_open: boolean;
}

/** Benefits summary shown alongside the status. */
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
 * Top-level view model for /creator/pixel-legacy — status display, not a form.
 * Consumed by renderPixelLegacyPage. The page renders three layouts based on
 * is_pixel_legacy + gateway_open:
 *   - is_pixel_legacy === true                  → "You are Pixel Legacy creator #N"
 *   - is_pixel_legacy === false && gateway_open  → "You are Standard. Pixel Legacy is filled / not (yet) yours."
 *   - is_pixel_legacy === false && !gateway_open → "Pixel Legacy seats are filled."
 */
export interface PixelLegacyStatusView {
  creator_id: string;
  display_name: string;
  /** True iff this creator currently holds a Pixel Legacy seat. */
  is_pixel_legacy: boolean;
  /** 1..3500 when granted; null otherwise. */
  seat_number: number | null;
  /** ISO-8601 timestamp of grant; null when not granted. */
  granted_at_utc: string | null;
  /** Live seat-availability meter (clamped at marketing cap). */
  seat_meter: PixelLegacySeatMeter;
  /** Static benefits — same values regardless of grant state, surfaced for
   *  comparison in the "What you'd get" panel of the unfilled view. */
  benefits: PixelLegacyBenefits;
  /** True iff is_pixel_legacy — signals the renderer to unlock the Cyrano
   *  panel CTA. */
  cyrano_panel_unlocked: boolean;
  /** ISO-8601 timestamp when this view was generated. */
  generated_at_utc: string;
  rule_applied_id: string;
}
