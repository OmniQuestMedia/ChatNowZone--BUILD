// apps/chatnow-zone/lib/pixel-legacy-presenter.ts
// Builds a PixelLegacyStatusView from the core API responses. The Next.js
// route fetches /api/pixel-legacy/:creator_id (creator status) and
// /api/pixel-legacy/seat-meter, then this presenter composes them with the
// static benefits values into the shape ui/app/creator/pixel-legacy/page.ts
// expects.
//
// The static benefits values mirror governance.config.ts PIXEL_LEGACY but
// are duplicated here as constants — the Next.js app does not import the
// service-side config (keeps bundle deps minimal). If the canonical values
// change, update both sites.

import type { PixelLegacyStatusView } from '@cnz/ui/types/creator-panel-contracts';

interface CreatorStatusResponse {
  creator_id: string;
  is_pixel_legacy: boolean;
  seat_number: number | null;
  granted_at_utc: string | null;
  lifetime_cyrano: boolean;
  rule_applied_id: string;
  generated_at_utc: string;
}

interface SeatMeterResponse {
  seats_taken: number;
  seats_total: number;
  seats_remaining: number;
  cap_reached: boolean;
  gateway_open: boolean;
  rule_applied_id: string;
}

const PIXEL_LEGACY_BENEFITS = {
  payout_range_min_usd: 0.07,
  payout_range_max_usd: 0.09,
  lifetime_cyrano: true,
  signing_bonus_month: 4,
  badge_label: 'Pixel Legacy',
} as const;

export function buildPixelLegacyStatusView(params: {
  creator_id: string;
  status: CreatorStatusResponse;
  seat_meter: SeatMeterResponse;
  display_name?: string;
}): PixelLegacyStatusView {
  const { creator_id, status, seat_meter, display_name } = params;
  return {
    creator_id,
    display_name: display_name ?? creator_id,
    is_pixel_legacy: status.is_pixel_legacy,
    seat_number: status.seat_number,
    granted_at_utc: status.granted_at_utc,
    seat_meter: {
      seats_taken: seat_meter.seats_taken,
      seats_total: seat_meter.seats_total,
      seats_remaining: seat_meter.seats_remaining,
      cap_reached: seat_meter.cap_reached,
      gateway_open: seat_meter.gateway_open,
    },
    benefits: PIXEL_LEGACY_BENEFITS,
    cyrano_panel_unlocked: status.is_pixel_legacy,
    generated_at_utc: status.generated_at_utc,
    rule_applied_id: status.rule_applied_id,
  };
}

export async function fetchPixelLegacyStatus(params: {
  creatorId: string;
  apiBase: string;
}): Promise<{ status: CreatorStatusResponse; seat_meter: SeatMeterResponse }> {
  const { creatorId, apiBase } = params;
  const [statusRes, meterRes] = await Promise.all([
    fetch(`${apiBase}/pixel-legacy/${encodeURIComponent(creatorId)}`, { cache: 'no-store' }),
    fetch(`${apiBase}/pixel-legacy/seat-meter`, { cache: 'no-store' }),
  ]);
  if (!statusRes.ok) {
    throw new Error(
      `pixel-legacy status fetch failed: ${statusRes.status} ${statusRes.statusText}`,
    );
  }
  if (!meterRes.ok) {
    throw new Error(
      `pixel-legacy seat-meter fetch failed: ${meterRes.status} ${meterRes.statusText}`,
    );
  }
  const status = (await statusRes.json()) as CreatorStatusResponse;
  const seat_meter = (await meterRes.json()) as SeatMeterResponse;
  return { status, seat_meter };
}
