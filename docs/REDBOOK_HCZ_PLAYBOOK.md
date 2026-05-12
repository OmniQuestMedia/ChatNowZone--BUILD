# RedBook — HCZ Bootstrap Playbook

**Date:** 2026-05-12  
**Authority:** `PROGRAM_CONTROL/DIRECTIVES/QUEUE/OQMI_GOVERNANCE.md` + `docs/POLICIES/OQMI_INFRASTRUCTURE_AND_SECURITY_POLICY.md` (INFRA_v1.0)  
**Scope:** HCZ escalation routing and operator response bootstrap for ChatNow.Zone

This document bootstraps the repo-local RedBook artifact referenced across the
build. It gives HCZ agents a single scenario table for the existing welfare,
recovery, and Diamond Concierge escalation surfaces already present in code and
docs.

## Scenario matrix

| RedBook playbook ID                  | Trigger                                                                             | Primary owner           | Required action                                                                                                                                                              | Evidence / source                                                                                                |
| ------------------------------------ | ----------------------------------------------------------------------------------- | ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `REDBOOK-HCZ-SOFT_NUDGE`             | `SOFT_NUDGE` welfare intervention                                                   | HCZ                     | Present the non-blocking welfare nudge, confirm the Guest can continue voluntarily, and capture the interaction outcome in the case record.                                  | `docs/ux/10-compliance-overlays.md`, `docs/ux/04-reason-code-catalog.md`                                         |
| `REDBOOK-HCZ-COOL_DOWN`              | `COOL_DOWN` welfare intervention                                                    | HCZ                     | Enforce the mandatory five-minute pause, preserve the countdown state, and document the resolution before any further spending path resumes.                                 | `docs/ux/10-compliance-overlays.md`, `docs/ux/03-state-machines.md`                                              |
| `REDBOOK-HCZ-HARD_DECLINE`           | `HARD_DECLINE_HCZ` welfare intervention                                             | HCZ                     | Pause the session, route the case to a real HCZ agent, and preserve the welfare rationale and correlation trail for follow-up.                                               | `docs/ux/10-compliance-overlays.md`, `docs/DOMAIN_GLOSSARY.md`                                                   |
| `REDBOOK-HCZ-RECOVERY`               | Recovery case enters `OPEN`, `TOKEN_BRIDGE_OFFERED`, or `THREE_FIFTHS_EXIT_OFFERED` | HCZ + Recovery          | Use the Recovery Engine script path, keep the audit trail append-only, and record whether the case proceeds through Token Bridge, Three-Fifths Exit, or expiration handling. | `services/recovery/src/recovery.types.ts`, `PROGRAM_CONTROL/REPORT_BACK/PAYLOAD-2-REDBOOK-RECOVERY-DASHBOARD.md` |
| `REDBOOK-HCZ-DIAMOND_PERSONAL_TOUCH` | High-balance Diamond wallet requires personal touch                                 | HCZ + Diamond Concierge | Route the case to HCZ through the personal-touch channel and preserve the Diamond tier context with the recovery / pricing snapshot.                                         | `PROGRAM_CONTROL/REPORT_BACK/PAYLOAD-2-REDBOOK-RECOVERY-DASHBOARD.md`                                            |
| `REDBOOK-HCZ-SHIFT_HANDOFF`          | HCZ shift assignment, swap, or gap-fill event                                       | HCZ                     | Use the shift briefing emitted from the Layer 3 HCZ wiring as the opening context for the next agent handoff.                                                                | `services/cyrano/src/cyrano-layer3-hcz.service.ts`                                                               |

## Minimum record for every RedBook case

- `redbook_playbook_id`
- `correlation_id`
- `reason_code`
- `rule_applied_id`
- current escalation owner
- current case stage / outcome

## Bootstrap notes

- This playbook is intentionally limited to scenarios already evidenced in the
  repository.
- It does not redefine welfare thresholds, payout policy, or Diamond pricing.
- Follow-on work can expand this file into the full HCZ operating manual once a
  dedicated directive is authored for deeper RedBook coverage.
