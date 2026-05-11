## CHATNOW.ZONE BUILD STATUS

**Date:** May 11, 2026
**Status:** BUILD COMPLETE — CANONICAL COMPLIANT (Alpha Launch Ready) — Phase 0.5 Ecosystem Lint Parity: lint:ci script added, lint-staged + Husky pre-commit hook standardized, LINT-1 ship-gate invariant added. Ship-gate 32/32 GREEN.

**Recent status log:**
- May 11, 2026 — WORK-ORDER-v0.3 Phase 1 completed: EDR alignment (INFRA-8), outbound webhook dispatcher (INFRA-9), INFRA_v1.0_CANADA_RESIDENCY tagging, docker-compose eCommsZone + outbound webhook env vars. Ship-gate 31/31 GREEN.
- May 11, 2026 — Claude retired; Grok promoted to primary build agent; B001 R-CLARIFY surface filed for CEO; CNZ-WORK-001.md agent routing updated.
- May 9, 2026 — agent fast-path signal lane added without relaxing required governance/security gates.
- May 6, 2026 — BUILD COMPLETE — CANONICAL COMPLIANT (Alpha Launch Ready).
- May 3, 2026 — BUILD COMPLETE — CANONICAL COMPLIANT (Alpha Launch Ready) — Wave H+ hygiene applied.

All L0 ship-gates closed per Canonical Corpus v10 + REDBOOK + Business Plan v2.8.
Payloads 1–10 executed and verified.

**Phase 0.5 — Ecosystem Lint Parity (2026-05-11):**
- P0.5.2: devDependencies audited — no dupes found in ChatNowZone--BUILD
- P0.5.3: lint-staged@15.5.2 + husky@9.1.7 installed; `prepare: husky` script added; `.husky/pre-commit` invokes `yarn lint-staged`; `lint-staged` config in package.json targets `services/**/*.ts` with ESLint
- P0.5.4: `lint:ci` script added to package.json (`eslint 'services/**/*.ts' --max-warnings 0`); `yarn lint:ci` → **PASS** (0 warnings, 0 errors); formatter check deferred — 432 pre-existing prettier violations in ui/ are tracked as tech-debt (out of Phase 0.5 scope)
- Cross-Repo Flag: LINT-1 invariant added to `PROGRAM_CONTROL/ship-gate-verifier.ts` — checks `.eslintrc.js`, `lint:ci` script, `lint-staged` config, `super-linter.yml`, `linter` configs, Husky pre-commit hook
- Ship-gate result: **32/32 GREEN** (LINT-1 PASS)
- P0.5.1: Cross-repo distribution of canonical lint configs (`.github/linters/*`, `super-linter.yml`, `.eslintrc.js`) to CyranoZone / Marketplace-Build / eCommsZone is **DEFERRED** — requires separate PRs in those repos (agent has write access to ChatNowZone--BUILD only)

**Agent flow optimization:** Added a branch-scoped internal fast-gate workflow for
`copilot/*`, `grok/*`, and `agent/*` PRs, tightened auto-merge re-arming for
ready-for-review PRs, and refreshed `.github/copilot-instructions.md` with
Continuous Flow Mode guidance that preserves CodeQL, ship-gate, and protected-check
requirements.

**Payload 10 (Backend Closure)** added: Risk Engine (D002) production-grade,
FairPay PayoutRateLock (PAY-006 / PAY-011), OBS audio-signal gate (PAY-008 /
D004), Cyrano L2 LLM provider abstraction (CYR-006), Diamond Concierge intake
risk fields (DIA-003 / DIA-004). Ship-gate verifier extended to 22/22 PASS.
Retired tier alignment complete: `DAY_PASS`, `ANNUAL` (as tier), `OMNIPASS_PLUS`, and standalone `DIAMOND`
replaced with canonical `GUEST` / `VIP` / `VIP_SILVER` / `VIP_GOLD` / `VIP_PLATINUM` / `VIP_DIAMOND`
across `ZONE_MAP`, `ZONE_ACCESS_TIERS`, `MEMBERSHIP.STIPEND_CZT`, `MembershipService`,
`ZoneAccessService`, `RecoveryTypes`, `DiamondConciergeService`, and all integration tests.

---

# OQMI System State — Backlog Snapshot

**Snapshot date:** 2026-05-03 (Post-Payload-9 hygiene — legal_holds trigger + Risk/OBS hardening)
**Branch of record:** `claude/post-payload9-hygiene-YCgdU`
**Authority:** OmniQuest Media Inc. — OQMI_GOVERNANCE.md (Canonical Corpus v10)
**Launch posture:** **ChatNow.Zone Core — Launch Ready (Alpha)**

> This file is a **periodic snapshot** of program state. It is generated
> during governance runs (most recently: Repo Prep & Cleanup 2026-04-24).
> The live, authoritative source of truth is:
>
> - Governance doctrine → `PROGRAM_CONTROL/DIRECTIVES/QUEUE/OQMI_GOVERNANCE.md`
> - Program state tracker (this snapshot) → `OQMI_SYSTEM_STATE.md`
> - Live requirements → `docs/REQUIREMENTS_MASTER.md`
> - Domain glossary → `docs/DOMAIN_GLOSSARY.md`
> - Agent instructions → `.github/copilot-instructions.md`

---

## 1. Core Identifiers

| Field                | Value                                                                     |
| -------------------- | ------------------------------------------------------------------------- |
| Company              | OmniQuest Media Inc. (OQMInc™)                                            |
| CEO / CD / LD        | Kevin B. Hartley                                                          |
| Platform (primary)   | ChatNow.Zone — `chatnow.zone`                                             |
| Secondary platform   | Cyrano (60–120 days post-CNZ stabilization)                               |
| Repo                 | `OmniQuestMediaInc/ChatNowZone--BUILD`                                    |
| Hard launch deadline | 2026-10-01                                                                |
| Governance ban (§12) | Banned entity (name [REDACTED]) — never referenced in any OQMInc material |

---

## 2. Directive Pipeline (snapshot counts)

| Bucket                                    | Count | Source                                 |
| ----------------------------------------- | ----: | -------------------------------------- |
| `PROGRAM_CONTROL/DIRECTIVES/DONE/`        |    39 | filesystem                             |
| `PROGRAM_CONTROL/DIRECTIVES/IN_PROGRESS/` |     0 | filesystem                             |
| `PROGRAM_CONTROL/DIRECTIVES/QUEUE/`       |     7 | filesystem (excludes standing prompts) |

**Active QUEUE contents (2026-05-11 update — Claude retired, Grok primary):**

- `CNZ-GROK-STANDING-PROMPT.md` — **Grok** standing prompt (replaces retired Claude files)
- `CNZ-WORK-001.md` — master Wave A–H backlog (Waves B–H still open; B001 IN-REVIEW)
- `OQMI_GOVERNANCE.md` — governance doctrine (live source of truth; agent roster updated)
- `OQMI_SYSTEM_STATE.md` — coding doctrine v2.0 (live source of truth)
- `OSS-Lift-From-Index.md` — OSS reference lift index
- `OSS-Repo-Registry.md` — OSS reference repo registry
- `WORK-ORDER-v0.1.md` — Phase 0 work order (Phase 0 complete)
- `WORK-ORDER-v0.2.md` — Phase 1–3 work order (Phase 1 in progress; Grok primary noted)

> Retired from QUEUE (2026-05-11): `CNZ-CLAUDE-CODE-KICKOFF.md`,
> `CNZ-CLAUDE-CODE-STANDING-PROMPT.md` — archived to `archive/agents/`.

---

## 3. Requirements Master — Status Distribution

Counts from `docs/REQUIREMENTS_MASTER.md` (102 tracked rows; recount
2026-05-03):

| Status          | Count |
| --------------- | ----: |
| DONE            |    29 |
| QUEUED          |    12 |
| IN_PROGRESS     |     4 |
| NEEDS_DIRECTIVE |    64 |
| RETIRED         |     9 |
| DONE            |     6 |
| QUEUED          |    11 |
| IN_PROGRESS     |     3 |
| VERIFY          |     7 |
| NEEDS_DIRECTIVE |    72 |
| DEFERRED        |     1 |
| CLARIFY         |     2 |

(`RETIRED` rows removed from the table after 2026-04-25 retired-tier
sweep; nine entries were physically deleted, not re-tagged.)

> Distribution updated 2026-05-06 (Payload 10 — Backend Closure). Nine
> NEEDS_DIRECTIVE rows promoted to DONE: PAY-006, PAY-008, PAY-011, TOK-009,
> DIA-003, DIA-004, CYR-006, CYR-007, plus the new RiskEngineService (D002)
> coverage row tracked in §4 below.

---

## 4. Canonical Corpus L0 Ship-Gate Status

Ship-gate components tracked against Corpus L0 (from `CNZ-WORK-001` Wave H,
H-LAUNCH-READY sign-off directive):

| System                                     | Directive(s) | Status at snapshot                                                                                                                                                                                                                                                         |
| ------------------------------------------ | ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Three-Bucket Wallet                        | D001         | DONE — `LedgerService.debitWallet` + `ThreeBucketSpendGuardMiddleware` defence-in-depth                                                                                                                                                                                    |
| Risk Engine                                | D002         | DONE — PAYLOAD 10 RiskEngineService (composite scoring + Diamond Concierge intake + append-only `risk_engine_decisions` + NATS `RISK_ENGINE_DECISION_*`)                                                                                                                   |
| NATS Fabric                                | D003         | DONE (scaffold) — PAYLOAD 6 extended with `AUDIT_IMMUTABLE_*` topics + PAYLOAD 10 RISK_ENGINE / PAYOUT_RATE_LOCKED / OBS_HEAT_ESCALATION topics                                                                                                                           |
| OBS Broadcast Kernel                       | D004         | DONE — PAYLOAD 10 AudioSignalService gates Flicker n'Flame escalation above COLD on a positive vocal signal (PAY-008); OBSBridgeService key/lifecycle intact                                                                                                               |
| FairPay + NOWPayouts                       | D006, E002   | DONE (FairPay) — PAYLOAD 10 PayoutRateLockService captures rate at purchase (PAY-006/011); NOWPayouts batch settlement remains scaffold                                                                                                                                    |
| Risk Engine                                | D002         | DONE (scaffold v1) — `RegionSignalService` deterministic, NATS-driven (`risk.region_signal.emitted`), GateGuard-pre-processed; full Mini Credit Bureau still NEEDS_DIRECTIVE                                                                                               |
| NATS Fabric                                | D003         | DONE (scaffold) — PAYLOAD 6 extended with `AUDIT_IMMUTABLE_*` topics                                                                                                                                                                                                       |
| OBS Broadcast Kernel                       | D004         | DONE (scaffold v1) — `OBSBridgeService` carries `correlation_id` + `reason_code` on every NATS emission; SRT/RTMP edge transport NEEDS_DIRECTIVE                                                                                                                           |
| FairPay + NOWPayouts                       | D006, E002   | NEEDS_DIRECTIVE                                                                                                                                                                                                                                                            |
| RedBook                                    | E001         | NEEDS_DIRECTIVE                                                                                                                                                                                                                                                            |
| Compliance Stack                           | D008         | NEEDS_DIRECTIVE                                                                                                                                                                                                                                                            |
| GateGuard Sentinel                         | E003         | NEEDS_DIRECTIVE                                                                                                                                                                                                                                                            |
| Flicker n'Flame Scoring (FFS)              | PAYLOAD 5    | DONE (scaffold) — deterministic tier computation + NATS emission, persistence NEEDS_DIRECTIVE                                                                                                                                                                              |
| CreatorControl.Zone                        | PAYLOAD 5    | DONE (scaffold) — Broadcast Timing + Session Monitoring copilots, single-pane snapshot; frontend NEEDS_DIRECTIVE                                                                                                                                                           |
| Cyrano Layer 1                             | PAYLOAD 5    | DONE — 8-category whisper engine, memory, personas, latency SLO. PAYLOAD 10 added Layer 2 LLM provider abstraction (CYR-006: `CyranoLlmProvider` + `InMemoryCyranoLlmProvider`) and Prisma-backed session memory (CYR-007). Anthropic Claude provider lands in Payload 11. |
| Integration Hub                            | PAYLOAD 5    | DONE (scaffold) — Ledger↔GateGuard, Recovery↔Diamond Concierge, Flicker n'Flame Scoring↔CreatorControl+Cyrano handoffs                                                                                                                                                     |
| Cyrano Layer 1                             | PAYLOAD 5    | DONE (scaffold) — 8-category whisper engine, memory, personas, latency SLO; Layer 2 (LLM + Prisma memory) NEEDS_DIRECTIVE                                                                                                                                                  |
| Integration Hub                            | PAYLOAD 5    | DONE (scaffold) — Ledger↔GateGuard, Recovery↔Diamond Concierge, Flicker n'Flame Scoring↔CreatorControl+Cyrano handoffs                                                                                                                                                     |
| Banned-entity residual purge               | C001 (§12)   | DONE — purge/redact sweep completed 2026-04-24                                                                                                                                                                                                                             |
| Immutable Audit Architecture               | PAYLOAD-6    | DONE — hash-chain + WORM export + Canonical Compliance Checklist                                                                                                                                                                                                           |
| Frontend Polish + Diamond Concierge UI     | PAYLOAD-7    | DONE — `/admin/diamond`, `/admin/recovery`, `/creator/control`, `/tokens`, `/diamond/purchase`, `/wallet` page builders + presenters + render plans + theme + SEO + accessibility                                                                                          |
| End-to-end validation + Ship-Gate verifier | PAYLOAD-8    | DONE — six E2E flows + `PROGRAM_CONTROL/ship-gate-verifier.ts` + `docs/ARCHITECTURE_OVERVIEW.md` + `docs/PRE_LAUNCH_CHECKLIST.md`                                                                                                                                          |

---

## 5. Invariant Compliance Audit — 2026-04-24

### 5.1 Ledger append-only (no UPDATE/DELETE)

Enforced via Postgres triggers in `infra/postgres/init-ledger.sql` on:

- `ledger_entries` (lines 111–175)
- `transactions` (lines 239–345, partial — status updates permitted by design)
- `audit_events` (lines 429–500)
- `referral_links` (lines 508–570)
- `attribution_events` (lines 578–660)
- `notification_consent_store` (lines 668–730)
- `game_sessions` (lines 765–795)
- `call_sessions` (lines 855–890)
- `voucher_vault` (lines 892–920)
- `content_suppression_queue` (lines 925–955)
- `identity_verification` DELETE-blocked (lines 396–420)
- `legal_holds` (lines 1128–end; lift transition allowed only on un-lifted
  rows touching `lifted_by` / `lifted_at_utc` exclusively — installed by
  migration `20260503000000_legal_holds_append_only_trigger`)

Migration-level triggers also present on `schedule_audit_log`
(`prisma/migrations/20260412000000_gz_scheduling_module/migration.sql`,
lines 154–170).

**Status:** PASS — all designated ledger/audit tables are append-only.

### 5.2 `correlation_id` + `reason_code` on financial/audit tables

Verified via `grep` in `prisma/schema.prisma`:

- Present on: `StaffMember`, `SchedulePeriod`, `ShiftTemplate`,
  `ShiftAssignment`, `ShiftGap`, `ShiftBid`, `ScheduleAuditLog`,
  `DepartmentCoverage`, `StatHoliday`, `WebhookIdempotencyLog`,
  `AuditEvent` (reason_code only), and other ledger-adjacent models
  via init-ledger SQL.
- **`LegalHold`:** `reason_code` AND `correlation_id` both present after
  migration `20260428130000_legal_hold_correlation_id`. Verified during
  Payload 10 audit on 2026-05-06.
- **`LegalHold`:** `correlation_id` and `reason_code` both present.
  `correlation_id VARCHAR(64) NOT NULL` was added by migration
  `20260428130000_legal_hold_correlation_id`; the database-tier
  append-only / lift-transition guard was added by migration
  `20260503000000_legal_holds_append_only_trigger` and mirrored into
  `infra/postgres/init-ledger.sql`. Service-tier coverage:
  `tests/integration/legal-hold-correlation-id.spec.ts`.

**Remediation status:** CLOSED — §7 / Wave H legal_holds gap closed
2026-05-03 under correlation_id `LEGAL-HOLDS-APPEND-ONLY-TRIGGER-20260503`.

### 5.3 Network isolation — Postgres (5432) / Redis (6379)

Enforced in `docker-compose.yml` lines 4–39: neither `db` nor `redis`
exposes a host port binding; both live on the internal `backend`
network only. **Status:** PASS.

### 5.4 NATS real-time event fabric (no REST polling for chat/haptic)

NATS JetStream present at `docker-compose.yml` line 41; topic registry
at `services/nats/topics.registry.ts` per governance doctrine.
**Status:** PASS at scaffold level — per-feature enforcement tracked
via `CNZ-WORK-001` wave directives.

### 5.5 No secrets in repo

`find -name ".env*" -o -name "*.env"` returns nothing under tracked
paths (excluding `.git` and `node_modules`). `.gitignore` covers
`*.env.local` and `*.env.*.local` patterns. **Status:** PASS.

### 5.6 Governance §12 banned-entity purge

All references to the banned individual/firm have been redacted across
`REFERENCE_LIBRARY/00_THREAD_BOOTSTRAP.md`, `docs/REQUIREMENTS_MASTER.md`,
`PROGRAM_CONTROL/DIRECTIVES/QUEUE/CNZ-WORK-001.md`, and both Thread 13
report-back files. `grep -rni "Navigator\|Jaime Watt"` outside the
`archive/` quarantine returns zero matches. **Status:** PASS.

---

## 6.0 Payload 10 — Backend Closure Deliverables (2026-05-06)

| Artifact                      | Path                                                                       | Purpose                                                                                                                                                                                                                                       |
| ----------------------------- | -------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Risk Engine service           | `services/risk-engine/src/risk-engine.service.ts`                          | Composite risk scoring (region + behavioural + Diamond Concierge) with append-only `risk_engine_decisions` rows + NATS emission                                                                                                               |
| Risk Engine types             | `services/risk-engine/src/risk-engine.types.ts`                            | Canonical envelope: `RiskIntent`, `RiskTier`, `RiskDecision`, signal slices                                                                                                                                                                   |
| FairPay rate lock             | `services/ledger/payout-rate-lock.service.ts`                              | Captures live FFS rate at purchase (PAY-006), persists in immutable `payout_rate_locks`, honoured by `PayoutService`                                                                                                                          |
| OBS audio gate                | `services/obs-bridge/src/audio-signal.service.ts`                          | Per-stream vocal-presence probe; gates Flicker n'Flame escalation above COLD (PAY-008)                                                                                                                                                        |
| Cyrano LLM provider interface | `services/cyrano/src/llm-provider.interface.ts`                            | Provider abstraction satisfying CYR-006; production swaps in Anthropic Claude                                                                                                                                                                 |
| Cyrano LLM in-memory provider | `services/cyrano/src/llm-provider.in-memory.ts`                            | Deterministic stub for tests / CI / offline dev                                                                                                                                                                                               |
| Schema migration              | `prisma/migrations/20260503000000_payload10_backend_closure/migration.sql` | Adds `risk_engine_decisions`, `payout_rate_locks`, `transactions.heat_score_at_tip / payout_rate_applied / diamond_floor_active`, Diamond Concierge intake fields on `risk_assessments`, `ZoneAccessZone.CYRANO_LAYER2`, append-only triggers |
| Hub Risk + Lock handoffs      | `services/integration-hub/src/hub.service.ts`                              | `forwardGuardedLedgerRequest` now refuses on Risk Engine BLOCK/ESCALATE and emits `AUDIT_IMMUTABLE_PAYOUT_LOCK` when a rate-lock id is attached                                                                                               |
| NATS topics                   | `services/nats/topics.registry.ts`                                         | `RISK_ENGINE_DECISION_*`, `AUDIT_IMMUTABLE_RISK_ENGINE`, `PAYOUT_RATE_LOCKED`, `OBS_AUDIO_SIGNAL_*`, `OBS_HEAT_ESCALATION_BLOCKED`                                                                                                            |
| E2E test                      | `tests/e2e/payload10-backend-closure.spec.ts`                              | 9-test coverage for Risk Engine, audio gate, rate-lock, Cyrano LLM provider                                                                                                                                                                   |
| Ship-gate verifier            | `PROGRAM_CONTROL/ship-gate-verifier.ts`                                    | +3 Payload-10 checks (PAY10-1, PAY10-2, PAY10-3) — total 22/22 PASS                                                                                                                                                                           |

## 6. Repo Hygiene Actions (2026-04-25 — Payload 7 + 8)

- Built UI surface: `ui/types/` (admin-diamond, public-wallet, creator-panel),
  `ui/view-models/` (presenters), `ui/app/` (page builders for
  `/admin/diamond`, `/admin/recovery`, `/creator/control`, `/tokens`,
  `/diamond/purchase`, `/wallet`), `ui/config/` (theme, SEO, build config,
  accessibility), `ui/components/render-plan.ts`.
- Added six end-to-end test files under `tests/e2e/` covering the
  canonical token purchase, high-heat → Cyrano → payout scaling,
  Diamond recovery flows, expiration redistribution, immutable audit
  chain replay, RBAC step-up enforcement, and the UI presenters.
- Authored `PROGRAM_CONTROL/ship-gate-verifier.ts` — exits non-zero if
  any L0 invariant is violated; `tests/e2e/ship-gate-verifier.spec.ts`
  pins its report shape.
- Added `docs/PRE_LAUNCH_CHECKLIST.md` (L0 ship-gate sign-off form) and
  `docs/ARCHITECTURE_OVERVIEW.md` (Payloads 1–8 map).
- Updated root `README.md` with the new architecture map + ship-gate
  status.
- Updated `jest.config.js` to include `tests/e2e/**/*.spec.ts` +
  `ui/**/*.spec.ts` roots.
- Added `yarn ship-gate` script to `package.json`.

## 6.1 Repo Hygiene Actions (2026-04-24 run — historical)

- Quarantined `LEGACY_CONFIGS/` → `archive/LEGACY_CONFIGS_2026-04/`
  (HANDOFF.md filed).
- Flattened `archive/governance/` → `governance/` with
  `CLAUDE.stale.md` marker on the superseded doctrine file.
- Deduplicated `.prettierignore` + `.markdownlintignore` (removed
  stale `LEGACY_CONFIGS/` references; archive folder remains excluded
  from formatters).
- Redacted governance §12 banned-entity references across live docs.
- Created root `README.md` with canonical quickstart and governance
  pointers.
- Marked `PROGRAM_CONTROL/REPO_MANIFEST.md` as stale (auto-regenerated
  by the `repo-manifest.yml` workflow on next push).

---

## 7. Known Remediation Items (not executed in this run)

| Item                                                               | Reason                                                                            | Follow-up                                                     |
| ------------------------------------------------------------------ | --------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| `legal_holds.correlation_id` missing                               | Requires FIZ-scoped schema migration; not a hygiene change                        | Author GOV-scoped directive                                   |
| `yarn install` / `lint --fix` / `prettier --write` not run locally | Sandbox registry returned HTTP 503 repeatedly; no cached `node_modules` available | CI `ci.yml` + `super-linter.yml` workflows will enforce on PR |
| Wave B–H of `CNZ-WORK-001` still open                              | Normal backlog                                                                    | Tracked in `docs/REQUIREMENTS_MASTER.md`                      |

---

## 8. Payload 9 — Build-Complete Deliverables (2026-04-24)

| Artifact              | Path                                          | Purpose                                                                                                                                       |
| --------------------- | --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Deployment pipeline   | `.github/workflows/deploy.yml`                | Build, typecheck, lint, test, Prisma push, SQL-schema validation, Docker compose config validation, readiness gate                            |
| Production compose    | `docker-compose.yml`                          | Canonical bring-up with FT-033 intact, env-var driven secrets, Payload 1–8 feature flags                                                      |
| Integration Hub v2    | `services/integration-hub/src/hub.service.ts` | `forwardGuardedLedgerRequest` (GateGuard pre-processor), `emitRecoveryExpiryWarning`, `emitDiamondConciergeHandoff`, `processHighHeatSession` |
| Launch manifest       | `PROGRAM_CONTROL/LAUNCH_MANIFEST.md`          | Pixel Legacy onboarding, Mic Drop Reveal, 3,000-creator rate-lock, GateGuard LOI data package                                                 |
| Pre-launch checklist  | `docs/PRE_LAUNCH_CHECKLIST.md`                | CEO sign-off, compliance, infra, observability, go/no-go                                                                                      |
| Architecture overview | `docs/ARCHITECTURE_OVERVIEW.md`               | Full system map, cross-Payload invariants, cross-service wiring                                                                               |
| Root README update    | `README.md`                                   | Final "How to Run" + architecture summary                                                                                                     |

## 9. Contact / Authority

All content authority flows through Kevin B. Hartley (CEO). Directive
authoring happens via CEO + Grok; execution happens in Grok and
GitHub Copilot via the `PROGRAM_CONTROL/DIRECTIVES/` pipeline. No agent
may clear a GOV gate without CEO-signed clearance in
`PROGRAM_CONTROL/CLEARANCES/`.

> **Agent change (2026-05-11):** Claude Code and Claude in chat are retired.
> Grok is now the primary build agent. Archived Claude prompts:
> `archive/agents/CNZ-CLAUDE-CODE-KICKOFF-RETIRED-2026-05-11.md`,
> `archive/agents/CNZ-CLAUDE-CODE-STANDING-PROMPT-RETIRED-2026-05-11.md`.
