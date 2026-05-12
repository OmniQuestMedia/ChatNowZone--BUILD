# Contributing to ChatNow.Zone

## Authority and scope

All contributions must comply with:

- `PROGRAM_CONTROL/DIRECTIVES/QUEUE/OQMI_GOVERNANCE.md`
- `docs/POLICIES/OQMI_INFRASTRUCTURE_AND_SECURITY_POLICY.md`
- `docs/DOMAIN_GLOSSARY.md`

Corporate context: **OmniQuest Media Inc. (Ontario, Canada)**.

## Contribution flow

1. Start from an issue/directive in `PROGRAM_CONTROL/DIRECTIVES/QUEUE/`.
2. Use a feature branch (`grok/*`, `copilot/*`, `agent/*`, or team branch).
3. Keep changes scoped to a single bounded context.
4. Run local checks before opening/updating PR:
   - `yarn lint:ci`
   - `yarn test`
   - `yarn ship-gate`
5. Open/update PR and keep it small, reviewable, and merge-ready.

## Required invariants

- Append-only financial/audit behavior.
- `correlation_id` + `reason_code` on required writes.
- Canada-only data residency for production workloads.
- Zero-trust posture (no public Postgres/Redis, least privilege).
- No secrets or PII in repository content.

## Commit message policy

- Use canonical prefixes from `docs/DOMAIN_GLOSSARY.md`.
- Infrastructure/security changes must include `rule_applied_id` from INFRA policy §11.
- FIZ-scoped changes require full FIZ commit format.
