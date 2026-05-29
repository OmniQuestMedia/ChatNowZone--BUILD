# ChatNow.Zone Architecture Inventory (Governance Equalization)

**Date:** 2026-05-26
**Status:** Post-SxF Integration — Clean
**Authority:** `PROGRAM_CONTROL/DIRECTIVES/QUEUE/OQMI_GOVERNANCE.md` + `docs/POLICIES/OQMI_INFRASTRUCTURE_AND_SECURITY_POLICY.md` (INFRA_v1.0)

## Platform profile

- **Company:** OmniQuest Media Inc. (OQMInc™)
- **Jurisdiction:** Ontario, Canada
- **Production residency invariant:** Canada-only (`ca-central-1` primary, `ca-west-1` DR)
- **Time standard:** America/Toronto

## Common architecture status

| Component                                 | Status          | Evidence                                                                                                             |
| ----------------------------------------- | --------------- | -------------------------------------------------------------------------------------------------------------------- |
| Microservices bounded contexts            | **Finished**    | Services split by domains under `services/` with gate checks in `PROGRAM_CONTROL/ship-gate-verifier.ts`              |
| Shared libraries/contracts                | **In Progress** | Shared governance constants and topic registry exist; broader extraction into dedicated shared libs is still partial |
| Infrastructure as Code (Terraform)        | **Finished**    | `infra/terraform/` with VPC, RDS, ElastiCache, KMS, S3 Object Lock, ALB, outputs                                     |
| Ship-Gate Verifier                        | **Finished**    | `PROGRAM_CONTROL/ship-gate-verifier.ts` reports all checks green                                                     |
| Immutable audit chain                     | **Finished**    | `services/core-api/src/audit/` + append-only trigger enforcement in `infra/postgres/init-ledger.sql`                 |
| Encrypted references / PII-reference-only | **Finished**    | INFRA policy + integration-hub controls enforce reference-only pattern                                               |
| Canada region patterns (`ca-central-1`)   | **Finished**    | INFRA policy + Terraform defaults enforce Canada residency                                                           |
| Zero-trust network isolation              | **Finished**    | Internal-only Postgres/Redis, SSM endpoint posture, no SSH 22 policy                                                 |
| RedBook bootstrap playbook                | **Finished**    | `docs/REDBOOK_HCZ_PLAYBOOK.md` captures HCZ scenario routing for welfare, recovery, Diamond, and shift handoff       |
| Branch hygiene                            | **In Progress** | Branch inventory completed; local prune completed; no stale branches present in current clone                        |
| Dependency refresh cadence                | **Queued**      | Dependabot config present; next refresh cycle pending in separate dependency PR wave                                 |
| Cross-repo architecture shedding          | **Queued**      | Candidate removals identified; this cycle removes local generated artifacts only                                     |
| Corporate boilerplate standardization     | **In Progress** | Root docs now include Ontario/authority metadata; legal mailing address not present in repo sources                  |

## Immediate gaps

- **Missing:** dedicated root legal-address source document for boilerplate reuse across repos.
- **Queued:** next pass to externalize additional shared contracts into standalone shared libraries.
- **Queued:** expand the RedBook bootstrap matrix into a directive-backed HCZ operating manual with case lifecycle ownership and escalation SLAs.
