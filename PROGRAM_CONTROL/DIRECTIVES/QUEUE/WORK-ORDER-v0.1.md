# WORK-ORDER — ChatNowZone--BUILD

**Document ID:** WORK-ORDER-v0.1  
**Authority:** OmniQuest Media Inc. — Kevin B. Hartley, CEO  
**Version:** v0.1 (2026-05-06)  
**Status:** ACTIVE — Phase 0 In Progress  
**Rule Applied:** INFRA_v1.0 + GOVERNANCE (all tasks)  
**Path:** `PROGRAM_CONTROL/DIRECTIVES/QUEUE/WORK-ORDER-v0.1.md`  
**Branch of execution:** `copilot/cleanup-and-housekeeping-phase-0`

---

## Phase 0: Cleanup & Housekeeping (Immediate — 1-2 days)

| #      | Task                                                                              | Status     | Notes                                                                                      |
| ------ | --------------------------------------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------ |
| P0-001 | Add `OQMI_INFRASTRUCTURE_AND_SECURITY_POLICY.md` to `docs/POLICIES/`              | ✅ DONE    | Filed at `docs/POLICIES/OQMI_INFRASTRUCTURE_AND_SECURITY_POLICY.md`                        |
| P0-002 | Root `README.md` with architecture overview, tenant diagram, governance links     | ✅ DONE    | `README.md` present and references `docs/ARCHITECTURE_OVERVIEW.md` and all governance docs |
| P0-003 | `.github/copilot-instructions.md` (Droid Mode, rule_applied_id, Canada-only)      | ✅ DONE    | File present at `.github/copilot-instructions.md`                                          |
| P0-004 | `.github/CODEOWNERS`                                                              | ✅ DONE    | File present at `.github/CODEOWNERS`                                                       |
| P0-005 | `.github/dependabot.yml`                                                          | ✅ DONE    | Filed — npm, GitHub Actions, Docker ecosystems; weekly Monday schedule                     |
| P0-006 | `.github/workflows/ci.yml` (basic lint + security scan)                           | ✅ DONE    | `ci.yml` + `codeql.yml` + `super-linter.yml` + `ship-gate.yml` present                     |
| P0-007 | `PROGRAM_CONTROL/DIRECTIVES/QUEUE/` with initial directive                        | ✅ DONE    | Queue populated: `CNZ-WORK-001.md`, `OQMI_GOVERNANCE.md`, `OQMI_SYSTEM_STATE.md`, `OSS-*`  |
| P0-008 | `.gitignore` (secrets, node_modules, .env, media temp — no raw PII)               | ✅ DONE    | `.gitignore` present and covers all required patterns                                      |
| P0-009 | Archive noise                                                                     | ✅ DONE    | No noise found; `archive/` directory exists for future archival                            |
| P0-010 | Integrate eCommsZone Node.js client as first dependency                           | 🔴 BLOCKED | Package name not yet published / provided — see `CROSS-REPO-FLAG-001.md`                   |
| P0-011 | Cross-Repo Flag: Confirm webhook contract with eCommsZone, Cyrano, RedRoomRewards | 🟡 FLAGGED | See `PROGRAM_CONTROL/DIRECTIVES/QUEUE/CROSS-REPO-FLAG-001.md`                              |

**Exit Criteria:** Repo passes `git ls-files | wc -l` structure check + policy file present.

---

## Phase 1: Foundation & Governance (Week 1)

- [ ] Infra-as-code: Terraform / AWS CDK for ca-central-1 VPC, Postgres (private), Redis, S3 (SSE-KMS + Object Lock)
- [ ] Database schema: tenants, users (with organization_id + tenant_id), consent logs (append-only), financial ledger (immutable)
- [ ] Auth: Clerk / custom with age-assurance + MFA + JIT access for Restricted data
- [ ] CI/CD: GitHub Actions with OQMI ship-gates (no secrets, policy lint)

> **Note:** The existing `ChatNowZone--BUILD` repo has substantial Phase 1+ work already complete (Payloads 1–10 per `docs/ARCHITECTURE_OVERVIEW.md`). Phase 1 tasks above apply to any gaps identified by `docs/REQUIREMENTS_MASTER.md`.

---

## Phase 2: Core Platform (Weeks 2-4)

- [ ] User model + age/consent engine (integrate Cyrano for narrative/twin control)
- [ ] Performer dashboard + streaming (WebRTC)
- [ ] Viewer experience (token tipping, private shows)
- [ ] Real-time features (Socket.io or LiveKit) with eCommsZone event hooks

---

## Phase 3: Monetization & Ecosystem (Weeks 5-8)

- [ ] Payment ledger (Stripe + append-only) with RedRoomRewards webhook
- [ ] Marketplace integration hooks
- [ ] Observability + [INTEL] reporting
- [ ] DR drills (immutable backups tested)

---

## Estimated Total Effort

8-10 weeks to MVP (from Phase 0 kickoff).

## Dependencies

- eCommsZone client — npm package name pending (see CROSS-REPO-FLAG-001.md)
- Cyrano API contract — see `services/cyrano/`
- RedRoomRewards webhook spec — see CROSS-REPO-FLAG-001.md

## Next Review

After Phase 0 complete — CEO sign-off required before Phase 1 code.

---

## Handoff Block

**Built in this execution:**

- `docs/POLICIES/OQMI_INFRASTRUCTURE_AND_SECURITY_POLICY.md` — INFRA_v1.0 policy
- `.github/dependabot.yml` — npm, GitHub Actions, Docker
- `PROGRAM_CONTROL/DIRECTIVES/QUEUE/WORK-ORDER-v0.1.md` — this file
- `PROGRAM_CONTROL/DIRECTIVES/QUEUE/CROSS-REPO-FLAG-001.md` — cross-repo webhook / eCommsZone flag

**Intentionally left incomplete:**

- P0-010 eCommsZone npm integration — requires CEO/team to supply npm package name
- P0-011 webhook contracts — requires cross-repo coordination (see CROSS-REPO-FLAG-001.md)

**Next agent's first task:**

1. CEO to confirm npm package name for eCommsZone Node.js client
2. Once confirmed, run `yarn add <package-name>` and update `CROSS-REPO-FLAG-001.md` status to RESOLVED
3. Confirm webhook contracts per CROSS-REPO-FLAG-001.md §2, then update this file P0-011 to DONE
4. Obtain CEO Phase 0 exit sign-off before proceeding to Phase 1
