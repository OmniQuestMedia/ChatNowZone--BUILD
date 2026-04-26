# services/velocityzone

VelocityZone™ — time-window payout boost engine.

## Responsibility

- Admin UI creates `VelocityZoneEvent` windows (stored in `velocityzone_events` table).
- On every tip: payout engine calls `VelocityZoneService.resolveVelocityZoneRate()` with the
  current FFS score (0–100) and tip timestamp.
- If a window is active, the FFS score is linearly interpolated to a payout rate
  between `rate_floor_usd` and `rate_ceil_usd` (governance-bounded by `GovernanceConfig`).
- Rate is locked at tip-processing time and emitted on `velocityzone.rate.locked` NATS topic.

## NATS Topics Published

| Topic | Description |
|---|---|
| `velocityzone.event.active` | New event window created |
| `velocityzone.event.ended`  | Event window deactivated |
| `velocityzone.rate.locked`  | Rate resolved for a specific tip |

## FIZ Scope

This service is **FIZ-scoped**. All commits touching payout rate resolution require
`REASON:`, `IMPACT:`, and `CORRELATION_ID:` in the commit message.

## Environment

See `.env.example` for required variables.
