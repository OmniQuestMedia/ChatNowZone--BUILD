// WO-003 — Room-Heat Engine: DTOs (request validation shapes)
// All fields are typed; callers provide primitives — no class-validator
// decorators used (consistent with the rest of the codebase style).

import type {
  LeaderboardCategory,
  FfsInput,
} from '../types/ffs.types';

// ── Ingest DTO ────────────────────────────────────────────────────────────────
// Mirrors FfsInput exactly but expressed as a plain class so NestJS
// can deserialise the JSON body.
export class IngestFfsDto implements FfsInput {
  session_id!: string;
  creator_id!: string;
  captured_at_utc!: string;

  // Financial / Social Engagement
  tips_in_session!: number;
  tips_per_min!: number;
  avg_tip_tokens!: number;
  chat_velocity_per_min!: number;
  heart_reactions_per_min!: number;
  private_spy_count!: number;
  dwell_minutes!: number;

  // Biometric
  heart_rate_bpm!: number;
  heart_rate_baseline_bpm!: number;
  eye_tracking_score!: number;
  facial_excitement_score!: number;

  // Content / Behavioral
  skin_exposure_score!: number;
  motion_score!: number;
  audio_vocal_ratio!: number;

  // Momentum
  heat_trend_5min!: number;
  hot_streak_ticks!: number;

  // Dual Flame
  is_dual_flame!: boolean;
  dual_flame_partner_score?: number;
}

// ── Leaderboard query DTO ─────────────────────────────────────────────────────
export class LeaderboardQueryDto {
  category?: LeaderboardCategory;
}

// ── Tip event DTO (for adaptive learning trigger) ─────────────────────────────
export class TipEventDto {
  session_id!: string;
  creator_id!: string;
  /** CZT tokens tipped — used to record adaptive signal strength. */
  tokens!: number;
  /** Full heat input frame captured at tip moment. */
  heat_context!: FfsInput;
}
