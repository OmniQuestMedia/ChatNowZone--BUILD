# PIXEL-LEGACY-003 — wire $0.07 Pixel Legacy payout floor into FairPay calculation

**Status:** DONE — 2026-05-02
**Branch:** `claude/alpha-testing-ui-prep-0ZxB1`
**Authority:** Kevin B. Hartley, CEO — OmniQuest Media Inc.
**Commit prefix:** `FIZ:`
**Depends on:** [`PIXEL-LEGACY-002.md`](PIXEL-LEGACY-002.md) (FCFS gateway, `creator.creator_type` + `pixel_legacy_seat_allocations`)

---

## Why

`PIXEL_LEGACY.PAYOUT_FLOOR_USD = 0.07` was added to `governance.config.ts` in PIXEL-LEGACY-001 and retained through -002, but **no caller honored it**. Until this directive, every Pixel Legacy creator was paid the same as a Standard creator — the differentiator the program was built around had no operational substance for the ~3,500 lifetime seat-holders.

## Spec

- Pixel Legacy creators are paid in the band **$0.07–$0.09 per CZT earned**.
- The $0.07 floor protects against any payout path that would otherwise drop below it.
- The $0.09 ceiling matches `RATE_INFERNO`; Pixel Legacy creators do not earn above it (they share the same FFS heat-band ceiling as Standard).

## Implementation

### `services/ledger/redbook-rate-card.service.ts`

`resolveCreatorPayoutRate` now accepts `isPixelLegacy?: boolean` and applies a third floor in the composition:

```
1. Live FFS heat rate (cold $0.075 .. inferno $0.090)
2. Diamond floor ($0.080) — when diamondFloorActive
3. Pixel Legacy floor ($0.07) — when isPixelLegacy
```

Highest applicable floor wins. The return shape gains explicit `appliedDiamondFloor` and `appliedPixelLegacyFloor` booleans so audit metadata can differentiate which floor produced the rate.

### `services/ledger/payout.service.ts`

`SessionCloseInput` accepts `isPixelLegacy?: boolean`. The flag is forwarded to the rate-card resolver and persisted in ledger entry metadata:

```ts
metadata: {
  ...,
  applied_diamond_floor: <bool>,
  applied_pixel_legacy_floor: <bool>,
  is_pixel_legacy: <bool>,
  ...
}
```

## Defensive vs operational

Under the current heat-band rate matrix (cold $0.075 → inferno $0.090), the Pixel Legacy floor at $0.07 **never triggers** — every live rate is already above it. The floor is wired here defensively so any future sub-$0.075 payout path automatically protects Pixel Legacy creators:

- Tease bundle rates ($0.065 rack per `docs/DOMAIN_GLOSSARY.md`) flowing through `resolveCreatorPayoutRate`
- Special promotional rate cuts
- Future heat-band re-tuning that drops the cold rate

The floor's presence in code is the right operational guarantee even if today's matrix never invokes it.

## Tests

`tests/integration/redbook-rate-card.spec.ts` — new `Pixel Legacy floor` describe block:

- Pixel Legacy at heat 0 returns live cold rate ($0.075), not floor — proves `live < floor` comparison, not `always-floor`
- Pixel Legacy at heat 95 returns live inferno rate ($0.090) — proves no floor over-application at high heat
- Diamond floor + Pixel Legacy floor compose correctly: when both active and live is below both, Diamond ($0.080) wins because Pixel Legacy then sees rate already above its $0.07 floor
- Constant smoke test: `PIXEL_LEGACY.PAYOUT_FLOOR_USD === 0.07` and `PAYOUT_CEILING_USD === 0.09`. Catches accidental governance-config edits.

## Caller impact

The new `isPixelLegacy` parameter is **optional** (`?: boolean`). Existing callers of `resolveCreatorPayoutRate` and `settleSessionClose` work unchanged — the flag defaults to `false` (Standard creator behavior). New callers wishing to honor Pixel Legacy pass `isPixelLegacy: true`.

The recommended caller pattern at session close:

```ts
const isPixelLegacy = await pixelLegacyService.isPixelLegacy(creatorId);
await payoutService.settleSessionClose({
  ...,
  isPixelLegacy,
});
```

`PixelLegacyService.isPixelLegacy(creatorId)` was added in PIXEL-LEGACY-002 specifically for this lookup.

## Out of scope

- Wiring `isPixelLegacy` into the actual `settleSessionClose` call sites. `PayoutService.settleSessionClose` has no production callers today (it is a "PAYLOAD-001 stub" per the file header). When the FFS engine wires session-close through this service in a future directive, the caller will pull `isPixelLegacy` from `PixelLegacyService.isPixelLegacy()` and pass it through.
- `BatchPayoutService` aggregation. That surface is studio-period batch totalling, not per-session rate resolution. If batch payouts ever apply a per-creator floor adjustment, that will be a separate directive.
- Tease bundle creator-payout rate adjustment. The Tease Regular bundle's `creator_payout_per_token` ($0.075–$0.082) is set at guest-purchase time, not at session-close. If those rates ever drop below $0.075 the floor will protect Pixel Legacy creators automatically through `resolveCreatorPayoutRate`; no schema change required.
