# PIXEL-LEGACY-001 — Pixel Legacy creator type, 3,500 seat cap, $0.07 payout floor

**Status:** SUPERSEDED — 2026-05-02 by [`PIXEL-LEGACY-002.md`](PIXEL-LEGACY-002.md). The application/review workflow described below was replaced by a first-come-first-served gateway. The schema, service, controller, and UI page that this directive shipped have been substantially rewritten. This file is retained for audit history; do not implement against it.

**Original status:** DONE — 2026-04-28
**Branch:** `claude/alpha-testing-ui-prep-0ZxB1`
**Authority:** Kevin B. Hartley, CEO — OmniQuest Media Inc. (CEO instruction 2026-04-28)
**Commit prefix:** `FIZ: + GOV:` (touches creator schema + payout floor; governance doctrine; Cyrano lifetime flag)

---

## Why

PR #391 shipped the Pixel Legacy onboarding UI (`ui/app/creator/pixel-legacy/page.ts`) and presenter contract (`ui/types/creator-panel-contracts.ts` lines 130–214), but no backing schema or service existed. The UI binds against `PixelLegacyApplicationView` with no source of data — a real backend gap.

This directive closes that gap, end-to-end.

## Spec (from prior CEO turns)

- First **3,500** creator profiles created carry the `PIXEL_LEGACY` type. Cap is **lifetime**.
- Pixel Legacy creators are paid **$0.07–$0.09 per token earned** (until further notice). $0.09 ceiling matches `RATE_INFERNO`; the $0.07 **floor is the differentiator** vs `STANDARD` creators (whose floor is `RATE_COLD = $0.075` and can drop to $0.065 during Tease bundles).
- Pixel Legacy creators carry a **lifetime Cyrano membership flag**, honoured by the Cyrano access-policy resolver when `CYRANO-ACCESS-POLICY-001` lands.
- After the 3,500 cap, all creators are `STANDARD`.
- `PIXEL_LEGACY_SIGNING_BONUS` is a separate Month 4 bonus — flagged here, **trigger logic deferred** to a follow-up directive.

## Schema deltas

```
enum CreatorType                        { STANDARD, PIXEL_LEGACY }
enum PixelLegacyApplicationStatus       { DRAFT, APPLIED, REVIEWED, GRANTED, DENIED }

creators
  + creator_type                CreatorType  NOT NULL DEFAULT STANDARD
  + pixel_legacy_granted_at     TIMESTAMPTZ
  + lifetime_cyrano_membership  BOOLEAN      NOT NULL DEFAULT FALSE

NEW pixel_legacy_applications     — one per creator, lifecycle DRAFT→DENIED|GRANTED
NEW pixel_legacy_seat_allocations — append-only audit trail of seat assignments
                                    (UPDATE/DELETE blocked by trigger)
```

Migration: `prisma/migrations/20260428140000_pixel_legacy_001/migration.sql`. Every new table carries `correlation_id` + `reason_code` + `rule_applied_id` + `organization_id` + `tenant_id` per Canonical Corpus L0.

## Service surface

`services/creator-onboarding/src/pixel-legacy.service.ts`:

- `applyForPixelLegacy(dto)` — creator-initiated apply / re-submit. Bounds: ≤ 20 portfolio entries, ≤ 2000-char proof statement, ≤ 100-char display_name. Pre-checks `creator_id` exists and surfaces `CREATOR_NOT_FOUND` rather than letting Prisma raise a raw foreign-key error.
- `reviewApplication(dto)` — operator GRANT / DENY. Role check routed through canonical `RbacGuard.check()` against permission `pixel_legacy:seat:allocate` (required role: `COMPLIANCE`+). DENY requires `denial_reason_code`. GRANT runs the seat-allocation transaction.
- `buildApplicationView(creatorId)` — full `PixelLegacyApplicationView` shape consumed directly by `ui/app/creator/pixel-legacy/page.ts`. Returns synthetic `DRAFT` view for first-time visits with no application row.
- `getSeatMeter()` — `{ seats_taken, seats_total: 3500, seats_remaining, cap_reached }`. Drives the UI's seat-availability bar.
- `getApplication(creatorId)` — load raw application DTO.
- `isPixelLegacy(creatorId)` — fast lookup used by the payout calculator and the Cyrano resolver.

## Concurrency invariant

The 3,500-seat cap is enforced inside a single Prisma `$transaction` guarded by a Postgres advisory lock (`PIXEL_LEGACY.SEAT_ALLOCATION_ADVISORY_LOCK_KEY = 4242004500`). Two concurrent grants serialize through the lock; whichever side observes `seats_taken >= 3500` flips its application to `DENIED` with `denial_reason_code = 'PIXEL_LEGACY_SEAT_CAP_REACHED'`. The append-only trigger on `pixel_legacy_seat_allocations` is the second line of defence — manual `UPDATE` / `DELETE` against the table fails with a clear error.

## NATS publish ordering

Domain events are collected inside the transaction and published only **after** the transaction commits successfully. A rollback never broadcasts a ghost `pixel_legacy.seat.granted` or `pixel_legacy.application.denied` event to subscribers — NATS subscribers and the database stay in lock-step.

## Auth posture (interim)

`reviewer_id` and `caller_role` on the review endpoint are accepted from the request body. The service routes the role check through the canonical `RbacGuard` against permission `pixel_legacy:seat:allocate` (added to `PERMISSION_MATRIX`), unifying with the rest of the codebase's role-rank logic. Body-supplied identity matches the existing pattern in `studio.controller` and `creator-onboarding.controller`. Once the platform auth middleware lands and attaches a verified user to the request, both fields will come from `req.user` and the body fields will be removed. Tracked under `PIXEL-LEGACY-006` alongside the step-up auth modal flow.

## Audit + NATS

New topics in `services/nats/topics.registry.ts`:

- `pixel_legacy.application.submitted`
- `pixel_legacy.application.denied`
- `pixel_legacy.seat.granted`

`AuditBridgeService` mappings are **not** added in this directive — the immutable-audit `ImmutableAuditEventType` enum has no exact fit (`RED_BOOK_ESCALATION` is the closest but semantically wrong). The append-only `pixel_legacy_seat_allocations` table + structured logs + NATS events are the audit trail at this stage. A follow-up `GOV:` directive will add a `PIXEL_LEGACY_GRANT` event type and bridge it.

## Payout integration (this directive does NOT change)

The $0.07 floor lives in `governance.config.ts` as `PIXEL_LEGACY.PAYOUT_FLOOR_USD`. Wiring the floor into the actual payout calculation is **not** done here — the existing payout engine is untouched in this directive. A follow-up `FIZ:` directive will plumb `isPixelLegacy(creatorId)` into `FairPayService.calculatePayoutPerCZT(...)` so that `max(PAYOUT_FLOOR_USD, ffsRate)` is applied for Pixel Legacy creators. Out of scope here to keep the schema-and-service-surface change reviewable independently.

## RBAC step-up

The endpoint inventory in `docs/ux/02-endpoint-inventory.md` lists `pixel_legacy:seat:allocate` as a step-up trigger. This directive enforces the role-check in service-level (`COMPLIANCE` | `ADMIN` only). Wiring the full step-up auth modal flow is a follow-up — the role-check is the first defence.

## Tests

- `services/creator-onboarding/src/pixel-legacy.service.spec.ts` — unit coverage for validation guards and review-path state-machine enforcement.
- Concurrency-safe seat allocation is **not** unit-tested — advisory-lock + transaction semantics need a real Postgres. Follow-up: `tests/integration/pixel-legacy-seat-cap.spec.ts`.

## Open follow-ups (tracked)

| ID               | Scope                                                                                                                 |
| ---------------- | --------------------------------------------------------------------------------------------------------------------- |
| PIXEL-LEGACY-002 | Wire `PIXEL_LEGACY.PAYOUT_FLOOR_USD` into `FairPayService` payout calculation                                         |
| PIXEL-LEGACY-003 | Month-4 `PIXEL_LEGACY_SIGNING_BONUS` trigger job                                                                      |
| PIXEL-LEGACY-004 | `PIXEL_LEGACY_GRANT` event type in `ImmutableAuditEventType` + AuditBridgeService mapping                             |
| PIXEL-LEGACY-005 | Integration test: concurrent seat allocation (10 races, 1 winner — verifies advisory-lock invariant on real Postgres) |
| PIXEL-LEGACY-006 | Step-up auth modal flow on `/admin/pixel-legacy` review action                                                        |
