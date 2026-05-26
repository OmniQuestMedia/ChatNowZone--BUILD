// services/creator-onboarding/src/dto/pixel-legacy.dto.ts
// PIXEL-LEGACY-002 — request/response shapes for the FCFS gateway.
//
// Maps onto ui/types/creator-panel-contracts.ts PixelLegacyStatusView so
// the page builder at ui/app/creator/pixel-legacy/page.ts binds 1:1.

import type { PixelLegacySeatAllocation } from '@prisma/client';

/** Public seat-meter response. seats_taken is clamped at MARKETING_SEAT_CAP
 *  (3,000) regardless of how many actual grants exist (up to SEAT_CAP =
 *  3,500). The gateway_open flag tells the UI whether new onboardings can
 *  still receive a Pixel Legacy seat. */
export interface PixelLegacySeatMeterPublic {
  seats_taken: number;
  seats_total: number;
  seats_remaining: number;
  cap_reached: boolean;
  gateway_open: boolean;
  rule_applied_id: string;
}

/** Per-creator status response — replaces the v1 application view. */
export interface PixelLegacyCreatorStatusPublic {
  creator_id: string;
  is_pixel_legacy: boolean;
  /** 1..3500 when granted; null otherwise. */
  seat_number: number | null;
  /** ISO-8601 timestamp; null when not granted. */
  granted_at_utc: string | null;
  /** Mirrors the lifetime_cyrano_membership flag on the Creator row. */
  lifetime_cyrano: boolean;
  rule_applied_id: string;
  generated_at_utc: string;
}

export interface PixelLegacySeatAllocationPublic {
  seat_number: number;
  creator_id: string;
  granted_by: string;
  granted_at_utc: string;
  correlation_id: string;
  rule_applied_id: string;
}

export function toSeatAllocationPublic(
  row: PixelLegacySeatAllocation,
): PixelLegacySeatAllocationPublic {
  return {
    seat_number: row.seat_number,
    creator_id: row.creator_id,
    granted_by: row.granted_by,
    granted_at_utc: row.granted_at_utc.toISOString(),
    correlation_id: row.correlation_id,
    rule_applied_id: row.rule_applied_id,
  };
}
