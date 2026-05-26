# PIXEL-LEGACY-002 — first-come-first-served gateway (supersedes -001)

**Status:** DONE — 2026-05-02
**Branch:** `claude/alpha-testing-ui-prep-0ZxB1`
**Authority:** Kevin B. Hartley, CEO — OmniQuest Media Inc. (CEO instruction 2026-05-02)
**Commit prefix:** `FIZ: + GOV:`
**Supersedes:** [`PIXEL-LEGACY-001.md`](PIXEL-LEGACY-001.md)

---

## Why

CEO directive 2026-05-02 collapsed the model: _"It's not really an application
process. It's a first come first served. There will be an automatic gateway
shut down of the pixel membership."_

The v1 application/review workflow (DRAFT → APPLIED → REVIEWED → GRANTED/DENIED,
portfolio entries, proof statement, operator review with RBAC) is removed. The
new model:

- The first **3,500** creators completing onboarding receive `PIXEL_LEGACY` automatically. No form, no opt-in, no review.
- Marketing cap is **3,000** (UI seat-meter clamps here). Actual gateway closes at 3,500. The 500-seat buffer is internal/operational and never surfaced.
- After 3,500 onboardings, all new creators stay `STANDARD` (the default).
- The /creator/pixel-legacy page becomes a **status display**, not a form.

This collapse also structurally resolves 6 of the 10 outstanding Copilot
review comments on PR #395 by removing the surfaces that had the issues.

## Schema deltas

```
DROP TABLE pixel_legacy_applications
DROP TYPE  PixelLegacyApplicationStatus
ALTER TABLE pixel_legacy_seat_allocations
  DROP COLUMN application_id           — not referenced under FCFS
  ALTER COLUMN rule_applied_id SET DEFAULT 'PIXEL_LEGACY_v2'
                                        — existing rows retain v1 annotation
```

`Creator.creator_type / pixel_legacy_granted_at / lifetime_cyrano_membership`
are **kept** (set when the seat is granted). The `pixel_legacy_seat_allocations`
table is kept and remains append-only via the migration trigger from -001.

Migration: `prisma/migrations/20260502000000_pixel_legacy_002_fcfs_gateway/migration.sql`. Idempotent (`DROP IF EXISTS`).

## Service surface

`services/creator-onboarding/src/pixel-legacy.service.ts`:

- `tryGrantSeatOnOnboarding(params)` — automatic seat allocation under a
  Postgres advisory lock. **Idempotent on `creator_id`** — re-completion of
  onboarding for an existing seat-holder returns the existing seat without
  rewriting. Gateway-closed path returns `{ granted: false, gateway_closed: true }`
  silently — no event, no error, no application-style denial.
- `getSeatMeter()` — marketing-clamped public view: `{ seats_taken: min(actual, 3000), seats_total: 3000, seats_remaining, cap_reached, gateway_open }`. The `gateway_open` flag tells the UI whether new onboardings can still receive a seat (i.e. actual < 3,500). It can be `true` even when `cap_reached` is `true` (the buffer is open but the marketing meter has already saturated).
- `getCreatorStatus(creator_id)` — drives the status page. Returns `{ is_pixel_legacy, seat_number, granted_at_utc, lifetime_cyrano }`. Throws `CREATOR_NOT_FOUND` if the creator does not exist.
- `isPixelLegacy(creator_id)` — kept for downstream consumers (payout, Cyrano).

`applyForPixelLegacy`, `reviewApplication`, `buildApplicationView` from -001
are **removed**. The DTO file `dto/pixel-legacy.dto.ts` is rewritten from
scratch (application DTOs gone, status DTOs added).

## Wiring

`CreatorOnboardingService.complete()` now calls
`PixelLegacyService.tryGrantSeatOnOnboarding(...)` after the onboarding row
flips to `COMPLETE`. Any failure in the gateway path is logged and
swallowed — onboarding completion never blocks on Pixel Legacy. Worst case:
a creator finishes onboarding as `STANDARD` even though they were eligible.
That is preferable to blocking onboarding entirely on a transient seat-cap
race or DB hiccup.

## NATS

- **Removed:** `pixel_legacy.application.submitted`, `pixel_legacy.application.denied`.
- **Kept:** `pixel_legacy.seat.granted`.
- **New:** `pixel_legacy.gateway.closed` — fires once, when seat 3,500 is allocated. Useful for ops dashboards and the moment when the marketing team gets the "all seats claimed" notification.

Both surviving topics emit `actor_id`, `actor_role`, `correlation_id`,
`reason_code`, `rule_applied_id` so `AuditBridgeService` can be wired to
them in a future directive (`PIXEL-LEGACY-004` follow-up — adding a
`PIXEL_LEGACY_GRANT` event type to `ImmutableAuditEventType`).

## Controller

```
GET  /pixel-legacy/seat-meter         public seat-availability snapshot
GET  /pixel-legacy/:creator_id        creator's Pixel Legacy status
```

`POST /pixel-legacy/apply` and `POST /pixel-legacy/review` are removed.
The remaining endpoints are read-only — no destructive mutations.

## RBAC

The `pixel_legacy:seat:allocate` permission added in -001 is **removed**.
There is no operator-level seat-allocation surface under FCFS, so the
permission would be dead code.

## UI / presenter contract

`ui/types/creator-panel-contracts.ts` — `PixelLegacyApplicationView` /
`PixelLegacyApplicationStatus` / `PixelLegacyPortfolioEntry` are **replaced
by** the trimmer `PixelLegacyStatusView` shape: creator id + display name +
is_pixel_legacy + seat_number + granted_at_utc + seat_meter + benefits +
cyrano_panel_unlocked. The `PixelLegacySeatMeter` shape gains a `gateway_open`
boolean.

`ui/app/creator/pixel-legacy/page.ts` — collapsed from a 462-line application
form (status tracker + seat meter + portfolio editor + proof statement +
post-grant panel) to a ~280-line status display with three branches:

- **GRANTED** — "Welcome, Pixel Legacy creator. You are #N." + benefits + Cyrano CTA.
- **GATEWAY_OPEN, not granted** — "Onboarding is still open. Complete your onboarding to claim a seat." + benefits preview + seat-availability meter.
- **GATEWAY_CLOSED, not granted** — "Pixel Legacy seats are filled. You are a Standard creator." + benefits panel for context.

## How this resolves the outstanding -001 review comments

| -001 Comment                                               | Resolution under -002                                                                                                               |
| ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Apply path missing creator existence check                 | Apply path removed                                                                                                                  |
| Apply event publishes pre-upsert ID (race)                 | Apply path removed                                                                                                                  |
| Apply terminal-state guard race                            | Apply path removed                                                                                                                  |
| Review state-check race                                    | Review path removed                                                                                                                 |
| Cap-reached should fall back to STANDARD                   | Native — gateway-closed path returns silently and creator stays STANDARD by default                                                 |
| `REVIEWED` enum value never written                        | Enum removed entirely                                                                                                               |
| Review endpoint trusts body `reviewer_id` / `caller_role`  | Review endpoint removed                                                                                                             |
| `RbacGuard.check()` vs canonical `RbacService.authorize()` | No RBAC-gated mutation under FCFS                                                                                                   |
| Step-up mapping missing for `pixel_legacy:seat:allocate`   | Permission removed                                                                                                                  |
| `getViewByCreator` PII enumeration                         | Status payload is much less sensitive (just `is_pixel_legacy` + seat number); auth tightening is still tracked but no longer urgent |

## Tests

`services/creator-onboarding/src/pixel-legacy.service.spec.ts` — rewritten:

- Happy-path grant: seat created + creator mirrored + post-commit publish.
- Last-seat (3,499 → 3,500): emits `PIXEL_LEGACY_GATEWAY_CLOSED`.
- Gateway-closed: silent fall-through to STANDARD, no event.
- Idempotent replay: existing seat returned unchanged, no event.
- Seat-meter clamping at marketing cap when actual is in the (3,000–3,500] buffer.
- `getCreatorStatus` shape for granted, ungranted, and not-found.

Real-Postgres concurrency coverage (10 races → 1 winner under the advisory
lock) is still tracked as a follow-up — that test needs a live DB.

## Out of scope (intentionally)

- **Payout floor wiring** — `PIXEL_LEGACY.PAYOUT_FLOOR_USD = 0.07` lives in `governance.config.ts`. Plumbing it into `FairPayService.calculatePayoutPerCZT()` is a separate `FIZ:` directive (was tracked as `PIXEL-LEGACY-002` under the v1 numbering; renumber to `PIXEL-LEGACY-003`).
- **Month-4 signing bonus trigger** — `PIXEL_LEGACY_SIGNING_BONUS` reason code already exists; trigger job is its own follow-up (`PIXEL-LEGACY-004` under renumbering).
- **`PIXEL_LEGACY_GRANT` immutable-audit event type** — bridge mapping deferred (`PIXEL-LEGACY-005`).
- **Auth tightening on `/pixel-legacy/:creator_id`** — wider-repo work (still `PIXEL-LEGACY-006`).
- **Real-Postgres concurrency integration test** — `PIXEL-LEGACY-007`.
