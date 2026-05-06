```
Task / WorkOrder ID : INFRA-POLICY-ADD
Repo               : OmniQuestMediaInc/ChatNowZone--BUILD
Branch             : copilot/gov-add-oqmi-infrastructure-policy
HEAD (pre-commit)  : f3624e6d2055156f06a19eb5f509e5441b0b0efa

Files changed (git diff --stat --cached):
 .github/copilot-instructions.md                          |   6 ++
 README.md                                                |   1 +
 docs/POLICIES/OQMI_INFRASTRUCTURE_AND_SECURITY_POLICY.md | 188 +++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 3 files changed, 195 insertions(+)

ls docs/POLICIES/:
 OQMI_INFRASTRUCTURE_AND_SECURITY_POLICY.md

Commands run + outputs:

  1. mkdir -p docs/POLICIES/
     → (no output, exit 0)

  2. [Created] docs/POLICIES/OQMI_INFRASTRUCTURE_AND_SECURITY_POLICY.md
     → 188-line policy document v1.0, effective 2026-05-06
        Sections: §0 Purpose, §1 Core Governance, §2 Coding & AI Integrity,
        §3 Server & DB Operations, §4 Canadian Provider Criteria,
        §5 Backup & DR Plans, §6 Data Security & PII, §7 Malware & Ransomware Defense,
        §8 Monitoring & [INTEL], §9 Agent Handoff, §10 Amendment, §11 Invariants Register

  3. [Updated] README.md — added line under "Authoritative docs":
     "⚠️ Infrastructure & Security Policy: docs/POLICIES/OQMI_INFRASTRUCTURE_AND_SECURITY_POLICY.md
      — Canada-only data residency (PIPEDA), immutable 3-2-1 backups (WORM), zero-trust architecture,
      AI advisory-only invariant, ransomware defense. All infra/security changes MUST cite rule_applied_id from §11."

  4. [Updated] .github/copilot-instructions.md — added mandatory reference block:
     "**Infrastructure & Security Policy:** docs/POLICIES/OQMI_INFRASTRUCTURE_AND_SECURITY_POLICY.md
      > MANDATORY: All infrastructure/security changes MUST cite rule_applied_id from §11.
      > Canada-only data residency enforced (PIPEDA invariant — INFRA_v1.0-INV-01)."

  5. npx ts-node --transpile-only --project PROGRAM_CONTROL/tsconfig.json PROGRAM_CONTROL/ship-gate-verifier.ts
     → Summary:   GREEN
       Pass:      22
       Fail:      0
       Skip:      0
       Total:     22
       Exit code: 0

Invariants confirmed:
  ✔ INFRA_v1.0-INV-01 — Canada-only data residency documented and referenced
  ✔ INFRA_v1.0-INV-02 — Raw PII/media encrypted references only (documented)
  ✔ INFRA_v1.0-INV-03 — Immutable 3-2-1 WORM backups documented
  ✔ INFRA_v1.0-INV-04 — AI advisory-only invariant documented
  ✔ INFRA_v1.0-INV-05 — rule_applied_id mandate in copilot-instructions.md
  ✔ INFRA_v1.0-INV-06 — Least-privilege + zero-trust documented
  ✔ INFRA_v1.0-INV-07 — Ransomware defense (immutable backups + rapid isolation) documented
  ✔ ship-gate GREEN (22/22 PASS) — no breakage

Result: SUCCESS
Blockers: none
rule_applied_id: INFRA_v1.0
```
