# 01 — Presenter Contracts (Alpha-Frozen)

**Status:** ALPHA-FROZEN 2026-04-28
**Bind target for wireframes.**
**Source files:** `ui/types/*.ts`

Presenters are the canonical screen-data shapes — pure TypeScript types
with no runtime imports from the service layer. Wireframes bind to the
field names and shapes here; the backend is free to refactor behind
them.

---

## Frozen presenter files

| File | Surface(s) | Key interfaces |
|------|-----------|----------------|
| `ui/types/admin-diamond-contracts.ts` | `/admin/diamond` Diamond Concierge Command Center, `/admin/recovery` CS Recovery Command Center | `DiamondLiquidityView`, `DiamondVelocityRow`, `RecoveryStageTag`, `DiamondKpiCard`, audit-chain row |
| `ui/types/creator-control-contracts.ts` | `/creator/control` CreatorControl.Zone, `/creator/cyrano-panel` Cyrano L1 whisper feed | `FfsTier` (`COLD`\|`WARM`\|`HOT`\|`INFERNO`), `CyranoCategory` (8 categories), Broadcast Timing Copilot, Session Monitoring, persona switcher, payout indicator |
| `ui/types/creator-panel-contracts.ts` | Creator dashboard surfaces beyond the live-control surface | Earnings, payout history, persona library |
| `ui/types/gamification-contracts.ts` | Game UIs (dice, slot machine, wheel of fortune) | Game session, outcome, payout shape |
| `ui/types/public-wallet-contracts.ts` | `/wallet`, `/tokens`, `/diamond/purchase` | Three-bucket display, REDBOOK rate-card view, volume + velocity quote, $0.077 platform-floor flag |

---

## How to read a presenter contract

Each file uses three layers:

1. **Enums and string-literal unions** — exhaustive sets the UI must handle. e.g. `FfsTier = 'COLD' | 'WARM' | 'HOT' | 'INFERNO'`. A wireframe must show a state for every member.
2. **Row / card / view interfaces** — composable units that wireframes render. e.g. `DiamondVelocityRow`, `DiamondKpiCard`. Each interface lists every field with a comment when meaning isn't obvious from the name.
3. **Top-level view interfaces** — the full payload for one screen. e.g. `DiamondLiquidityView`. This is what the page builder's render plan resolves to.

---

## What a wireframe must respect

- **Every field** in a presenter has a render slot. If a field is not displayed, justify why in the wireframe annotation.
- **Every enum member** has a state. Don't design only the happy path.
- **`bigint as string`** — token amounts and USD cents are serialized as strings to avoid JS number precision loss. Wireframes must respect locale + precision rules in `ui/config/theme.ts`.
- **`reason_code: string`** — every business-action card carries a `reason_code`; treat it as the lookup key into the reason-code catalog (§04) for user-facing copy.
- **`correlation_id: string`** — appears on every audit-relevant row. Wireframes need a copy-to-clipboard affordance on operator surfaces.
- **`generated_at_utc: string`** — every snapshot view carries one. Wireframes must show "as of HH:MM:SS UTC" so operators don't act on stale data.
- **`test_id` + ARIA labels** — every interactive node must have both per `ui/config/accessibility.ts`.

---

## What a wireframe must NOT do

- **Invent fields** that don't exist on the presenter. If the field isn't there, the data isn't there.
- **Combine two presenter views** into one screen unless that screen has its own page builder in `ui/app/`. Combinations require a presenter-contract change via `UI:` directive.
- **Strip fields marked `// safety:` or `// compliance:`**. Those are non-removable per governance.

---

## Extending a presenter (post-Alpha process)

1. Open a `UI:` directive describing the field, the surface, and the business reason.
2. Add the field to the presenter as `?:` (optional) so existing bindings are non-breaking.
3. Update the page builder render plan to consume it.
4. Update the wireframe annotation to claim the new slot.
5. After two clean ship-gate runs, the field is promoted to required.

---

## Open contract gaps (will close before Alpha cutover)

| Gap | Owner | Tracking |
|-----|-------|----------|
| Cyrano L2 standalone — tier-graduated access policy contract | `services/core-api/src/cyrano/cyrano-auth.types.ts` | Directive `CYRANO-ACCESS-POLICY-001` (in flight) |
| Pixel Legacy creator type contract | `ui/types/creator-panel-contracts.ts` | Directive `PIXEL-LEGACY-001` (in flight) |
| Admin Cyrano access-policy editor presenter | New file `ui/types/admin-cyrano-contracts.ts` | Pulled in by `CYRANO-ACCESS-POLICY-001` |
| Admin Pixel Legacy seat-cap presenter | New file `ui/types/admin-pixel-legacy-contracts.ts` | Pulled in by `PIXEL-LEGACY-001` |
| Public guest landing + sign-in/up | New file `ui/types/public-onboarding-contracts.ts` | Will be authored alongside Next.js app bootstrap |

These five files are the only presenter additions planned for Alpha.
Anything beyond these is post-Alpha scope.
