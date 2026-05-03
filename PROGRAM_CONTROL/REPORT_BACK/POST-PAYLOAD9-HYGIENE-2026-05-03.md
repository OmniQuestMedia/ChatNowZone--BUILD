# Report-Back — Post-Payload-9 Hygiene + Wave H Gap Closure

**Date:** 2026-05-03
**Branch:** `claude/post-payload9-hygiene-YCgdU`
**Authority:** Kevin B. Hartley, CEO — OmniQuest Media Inc.
**Directive(s):** `CNZ-WORK-001` (Waves B–H scoped) + standing post-Payload-9 hygiene
**Correlation IDs:**

- `LEGAL-HOLDS-APPEND-ONLY-TRIGGER-20260503`
- (Legacy reference) `LEGAL-HOLD-CORRELATION-ID-MIGRATION-20260428`

---

## 1. Inventory & audit (start-of-run)

| Gate             | Before                                                                                                                                                                                                                   | After                                          |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------- |
| `yarn ship-gate` | GREEN (19/19)                                                                                                                                                                                                            | GREEN (19/19)                                  |
| `yarn typecheck` | RED — syntax error in `services/ffs/src/ffs.service.ts` (unclosed SenSync `if` block) + `tsconfig` deprecations + Prisma client missing (`yarn install` had not been run) + `ZoneAccessService` rejected `CYRANO_LAYER2` | GREEN                                          |
| `yarn lint`      | RED — `_dropped` destructured binding rejected (eslint config did not honour `_` prefix on bindings)                                                                                                                     | GREEN                                          |
| `yarn test`      | RED — 3 suites failing (`cyrano-layer4-enterprise.spec.ts`, `pixel-legacy.service.spec.ts`, `ui-presenters.spec.ts`)                                                                                                     | GREEN — **612 tests passing across 54 suites** |

Root causes were **stale tests** (constructor signatures had drifted) and a
**stray brace omission** in the FFS service. None were canonical-invariant
violations.

---

## 2. Core fixes (priority)

### 2.1 `legal_holds` append-only trigger — Wave H §7 closure

- **Schema audit:** `correlation_id VARCHAR(64) NOT NULL` was already
  present on `LegalHold` (added 2026-04-28 by migration
  `20260428130000_legal_hold_correlation_id`). The remaining gap was at
  the **Postgres tier**: there was no DB-level guard against UPDATE on
  arbitrary columns or DELETE.
- **Migration added:**
  `prisma/migrations/20260503000000_legal_holds_append_only_trigger/migration.sql`
  installs `legal_holds_guard_mutation()` and its BEFORE UPDATE OR
  DELETE trigger:
  - DELETE always rejected.
  - UPDATE rejected when the row is already lifted.
  - UPDATE rejected unless the diff is restricted to
    `(lifted_by, lifted_at_utc)`.
  - Lift transition requires both `lifted_by` and `lifted_at_utc` to be
    NOT NULL.
- **Init bootstrap:** mirrored into `infra/postgres/init-ledger.sql` so
  fresh containers come up with the trigger pre-installed (idempotent
  `CREATE TABLE IF NOT EXISTS` + `DROP TRIGGER IF EXISTS`).
- **Ship-gate:** FIZ-1 list now includes `legal_holds`
  (`PROGRAM_CONTROL/ship-gate-verifier.ts`). All 19 checks remain
  GREEN.
- **Service-tier coverage:** new `tests/integration/legal-hold-correlation-id.spec.ts`
  (3 tests) verifies that:
  1. `applyHold` persists `correlation_id` on the row and emits it on
     `compliance.legal_hold.applied`.
  2. `liftHold` emits both `correlation_id_apply` and
     `correlation_id_lift` on `compliance.legal_hold.lifted` and only
     mutates the lift fields.
  3. Non-`COMPLIANCE` callers are rejected with `LEGAL_HOLD_UNAUTHORIZED`.

Mandatory commit metadata (this work):

- **REASON:** OQMI Coding Doctrine v2.0 §5.2 / Canonical Corpus §7 —
  every compliance write must be append-only at the Postgres tier, not
  only at the service tier.
- **IMPACT:** DELETE on `legal_holds` is now impossible; UPDATE is
  restricted to the single permitted lift transition. No existing data
  is modified.
- **CORRELATION_ID:** `LEGAL-HOLDS-APPEND-ONLY-TRIGGER-20260503`
- **RULE_APPLIED_ID:** `LEGAL_HOLD_v1`

### 2.2 Risk Engine hardening (D002 scaffold v1)

- Rewrote `services/risk-engine/src/region-signal.service.ts` to be
  **deterministic** (no clocks, no randomness in result), **NATS-driven**
  (publishes `risk.region_signal.emitted`), and **GateGuard-pre-processed**
  (consumes `correlationId` from the request envelope).
- Added the canonical reason-code vocabulary
  (`TRUSTED | IP_LOCATION_MISMATCH | BIN_BILLING_MISMATCH | VPN_DETECTED |
MULTIPLE_RISK_FLAGS`).
- Frozen penalty constants exported as `REGION_SIGNAL_PENALTIES`.
- Added `RISK_REGION_SIGNAL_EMITTED` to `services/nats/topics.registry.ts`.
- Coverage: `tests/integration/risk-region-signal.spec.ts` (4 tests).

### 2.3 OBS Broadcast Kernel hardening (D004 scaffold v1)

- Threaded `correlation_id` end-to-end through
  `OBSBridgeService.acceptConnection / endStream / regenerateStreamKey`.
  Every accepted/ended/rotated event now carries `correlation_id +
reason_code + rule_applied_id` so the immutable audit chain can pair
  start/stop transitions.
- `endStream` upgraded to a `StreamLifecycleInput` shape (object arg)
  matching `acceptConnection`, returning the resolved `correlation_id`.
- Coverage: `tests/integration/obs-bridge-correlation-id.spec.ts`
  (4 tests).

### 2.4 Toolchain hygiene

- `tsconfig.json` — added `"ignoreDeprecations": "5.0"` so `node`
  module-resolution + `baseUrl` continue to work under TS 5.9.3
  without the deprecation FAIL.
- `.eslintrc.js` — extended `no-unused-vars` to honour the `_` prefix
  on regular bindings, destructured array slots, and rest siblings
  (matches the conventions already used in the FFS service for
  intentional drops).
- `services/ffs/src/ffs.service.ts` — closed the unclosed
  `if (input.sensync_bpm !== undefined) { … }` block; SenSync presence
  boost and the consent-gated `sensync_boost_points` boost are now
  evaluated independently as the comment doctrine intended.
- `services/core-api/src/zone-access/zone-access.service.ts` —
  `hasActiveShowZonePass` short-circuits for non-override zones (e.g.
  `CYRANO_LAYER2`) without a DB round-trip, eliminating the Prisma
  enum / governance enum mismatch.

---

## 3. Tests

- New: 11 integration tests across 3 files (legal-hold, region-signal,
  obs-bridge).
- Repaired: 3 stale specs (cyrano-layer4-enterprise, pixel-legacy,
  ui-presenters).
- **Suite total:** 612 tests across 54 suites — all passing.
- Ship-gate, lint, typecheck, and test all GREEN.

---

## 4. Documentation updates

- `OQMI_SYSTEM_STATE.md`
  - Updated snapshot date + branch of record (2026-05-03).
  - Wave H §7 entry flipped from open to CLOSED with the new
    correlation_id.
  - L0 ship-gate table — `Risk Engine` and `OBS Broadcast Kernel`
    moved from `NEEDS_DIRECTIVE` to `DONE (scaffold v1)` with explicit
    follow-up scope captured.
  - §5.1 trigger inventory — added `legal_holds`.
  - §3 status distribution — recounted (102 tracked rows).
- `docs/PRE_LAUNCH_CHECKLIST.md` — Legal hold checklist item flipped
  to `[x]` with citation.
- `docs/ARCHITECTURE_OVERVIEW.md` — §9 open work refreshed: removed
  the closed `legal_holds.correlation_id` item; D002/D004 scaffold v1
  noted with their remaining transport / CB-ledger scope.
- Report-back filed (this file).

---

## 5. Files touched

| Path                                                                             | Kind    |
| -------------------------------------------------------------------------------- | ------- |
| `prisma/migrations/20260503000000_legal_holds_append_only_trigger/migration.sql` | NEW     |
| `infra/postgres/init-ledger.sql`                                                 | UPDATED |
| `PROGRAM_CONTROL/ship-gate-verifier.ts`                                          | UPDATED |
| `services/risk-engine/src/region-signal.service.ts`                              | REWRITE |
| `services/obs-bridge/src/obs-bridge.service.ts`                                  | UPDATED |
| `services/nats/topics.registry.ts`                                               | UPDATED |
| `services/ffs/src/ffs.service.ts`                                                | UPDATED |
| `services/core-api/src/zone-access/zone-access.service.ts`                       | UPDATED |
| `tsconfig.json`                                                                  | UPDATED |
| `.eslintrc.js`                                                                   | UPDATED |
| `tests/integration/legal-hold-correlation-id.spec.ts`                            | NEW     |
| `tests/integration/risk-region-signal.spec.ts`                                   | NEW     |
| `tests/integration/obs-bridge-correlation-id.spec.ts`                            | NEW     |
| `tests/integration/cyrano-layer4-enterprise.spec.ts`                             | UPDATED |
| `tests/e2e/ui-presenters.spec.ts`                                                | UPDATED |
| `services/creator-onboarding/src/pixel-legacy.service.spec.ts`                   | UPDATED |
| `OQMI_SYSTEM_STATE.md`                                                           | UPDATED |
| `docs/PRE_LAUNCH_CHECKLIST.md`                                                   | UPDATED |
| `docs/ARCHITECTURE_OVERVIEW.md`                                                  | UPDATED |
| `PROGRAM_CONTROL/REPORT_BACK/POST-PAYLOAD9-HYGIENE-2026-05-03.md`                | NEW     |

---

## 6. Remaining `NEEDS_DIRECTIVE` items + recommended next directives

1. **D002 — Risk Engine: Mini Credit Bureau ledger ingestion.** The
   region-signal v1 only models the BIN/Billing/IP/VPN axis. Charge-back
   ratio, dispute volume, and velocity windows still need a wired
   reader on `transactions` + `user_risk_profiles` (already defined in
   `init-ledger.sql`). **Recommended directive:** `D002-A —
Risk-Engine Charge-back Reader` (FIZ-prefix, scope M).
2. **D004 — OBS Broadcast Kernel: SRT/RTMP edge transport.** Bridge v1
   speaks Nest + NATS only. SRT relay, FFmpeg health probe, and
   bandwidth shaping are still scaffolds. **Recommended directive:**
   `D004-A — OBS Edge Transport`, scope L, requires CEO_GATE for
   network-egress configuration.
3. **E001 / E002 / E003 — RedBook + FairPay/NOWPayouts + GateGuard
   Sentinel.** Untouched in this run. Still NEEDS_DIRECTIVE.
4. **D008 — Compliance Stack: WORM export signing-key rotation
   policy.** Out of scope for hygiene; needs CEO clearance.
5. **G101+ — Black-Glass Interface.** Visual treatment still deferred
   post-alpha.
6. **CNZ-WORK-001-A015 — Restore `OQMI_GOVERNANCE.md` §§9–§12 from
   authoritative source.** Flagged as a residual item from Wave A
   cleanup; mechanical restore expected.

---

## 7. Closure note

All invariants honoured: append-only ledger via Postgres triggers
(now including `legal_holds`), no secrets committed, no banned-entity
references introduced, every new event carries
`correlation_id + reason_code + rule_applied_id`. **Authority chain:
Kevin B. Hartley, CEO — OmniQuest Media Inc.** Awaiting GOV gate
sign-off on this report-back to move the Wave H §7 line item to
`DONE/`.
