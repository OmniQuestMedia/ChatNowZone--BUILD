// services/velocityzone/src/velocityzone.types.ts
// VelocityZone — time-window payout boost engine types.
// FFS score (0–100) is linearly interpolated to a payout rate in
// [rate_floor_usd, rate_ceil_usd] for the active event window.

export const VELOCITYZONE_RULE_ID = 'VELOCITYZONE_v1';

/** Shape of a VelocityZoneEvent row (mirrors Prisma model). */
export interface VelocityZoneEvent {
  id: string;
  label: string;
  starts_at: Date;
  ends_at: Date;
  rate_floor_usd: string; // Decimal serialised to string
  rate_ceil_usd: string;  // Decimal serialised to string
  is_active: boolean;
  correlation_id: string;
  reason_code: string;
  rule_applied_id: string;
  created_by: string;
  created_at: Date;
  updated_at: Date;
}

/** Input for checking whether VelocityZone applies and computing the rate. */
export interface VelocityZoneRateInput {
  ffs_score: number;      // 0–100
  tip_time: Date;         // time of the tip event (used for window check)
  correlation_id: string;
}

/** Result returned by resolveVelocityZoneRate. */
export interface VelocityZoneRateResult {
  active: boolean;
  event_id: string | null;
  rate_usd_per_czt: number | null;  // null when no active event
  ffs_score: number;
}

/** DTO for creating a new VelocityZone event (admin UI). */
export interface CreateVelocityZoneEventDto {
  label: string;
  starts_at: string;      // ISO 8601
  ends_at: string;        // ISO 8601
  rate_floor_usd: string; // e.g. "0.0750"
  rate_ceil_usd: string;  // e.g. "0.0900"
  created_by: string;     // admin user UUID
  correlation_id: string;
  reason_code: string;
}
