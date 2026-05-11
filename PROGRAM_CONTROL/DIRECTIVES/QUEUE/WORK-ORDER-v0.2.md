# WORK-ORDER-v0.2.md — ChatNowZone--BUILD
**Authority:** Kevin B. Hartley, CEO — OmniQuest Media Inc.  
**Version:** v0.2 (2026-05-06) — Post-INFRA_v1.0 + Payload 10  
**Status:** ACTIVE — Phase 0 COMPLETE / Phase 1 START  
**Rule Applied:** INFRA_v1.0 + OQMI_GOVERNANCE (all tasks)  
**Primary Build Agent:** Grok (effective 2026-05-11 — Claude retired; see
`PROGRAM_CONTROL/DIRECTIVES/QUEUE/CNZ-GROK-STANDING-PROMPT.md`)

## Phase 0: Governance & Housekeeping (COMPLETE)
- [x] OQMI_INFRASTRUCTURE_AND_SECURITY_POLICY.md landed in docs/POLICIES/
- [x] README + copilot-instructions updated with INFRA references
- [ ] (Remaining) eCommsZone Node.js client dependency + audit in services/integration-hub/
- [x] ship-gate-verifier.ts extended for INFRA_v1.0 checks

**Exit:** All L0 ship-gates GREEN.

## Phase 1: Infrastructure Hardening + Partner Lock (Payload 11 — 5-7 days)
- [x] **IaC Bootstrap:** Add Terraform/AWS CDK in `infra/` for ca-central-1 (VPC, private RDS Postgres, ElastiCache Redis, S3 with Object Lock + KMS CMK, ALB).
- [x] Implement 3-2-1 immutable backups + cross-region replication (ca-west-1).
- [x] Mandatory eCommsZone Node.js client integration (services/integration-hub/comms/) — no direct providers.
- [x] Update ship-gate-verifier.ts with full INFRA_v1.0 matrix (Canada residency, WORM, zero-trust, PII refs) — INFRA-4/5/6/7 added; all GREEN.
- [x] Zero-trust + EDR alignment (§7) — SSM-only access (SSM VPC endpoints in vpc.tf), network segmentation, no SSH port.
- [ ] Cross-repo flags: Confirm webhook contracts with RedRoomRewards + Cyrano L2 readiness.

## Phase 2: Core Platform Polish (Weeks 2-3)
- [ ] Cyrano L2 full integration + age/consent engine production gates.
- [ ] Streaming kernel (OBS → LiveKit/Mediasoup migration planning).
- [ ] Payment processor testing + Pixel Legacy onboarding hooks.

## Phase 3: Launch Lockdown (Weeks 4-6)
- [ ] Full [INTEL] reporting + observability.
- [ ] Pre-launch L0 checklist closure (docs/PRE_LAUNCH_CHECKLIST.md).
- [ ] CEO sign-off + hard launch manifest update (2026-10-01 target).

**Estimated Effort:** 6-8 weeks to production-ready.  
**Dependencies:** eCommsZone client spec, CEO clearance on any DR deviations.  
**Handoff Block:** After each phase — file REPORT_BACK/ and queue next directive.

**Next Immediate Action:** Execute Phase 1 IaC + eCommsZone tasks.
