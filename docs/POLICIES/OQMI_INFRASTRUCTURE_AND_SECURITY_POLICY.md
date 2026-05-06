# OQMI Infrastructure and Security Policy

**Document ID:** INFRA_v1.0  
**Authority:** OmniQuest Media Inc. — Kevin B. Hartley, CEO  
**Scope:** All OmniQuest Media Inc. production infrastructure and services  
**Repo:** `OmniQuestMediaInc/ChatNowZone--BUILD`  
**Path:** `docs/POLICIES/OQMI_INFRASTRUCTURE_AND_SECURITY_POLICY.md`  
**Effective Date:** 2026-05-06  
**Status:** ACTIVE  
**Rule Applied:** INFRA_v1.0  
**Supersedes:** None (initial version)

---

## 0. Purpose

This policy defines the mandatory infrastructure and security controls for all OmniQuest Media Inc. (OQMInc™) production systems. It is binding on all engineering agents (human and AI), contractors, and third-party integrators.

Violations of this policy constitute a deployment blocker. No code, service, or infrastructure change that contradicts this policy may land on `main` or any production-adjacent branch.

This document is a child of `PROGRAM_CONTROL/DIRECTIVES/QUEUE/OQMI_GOVERNANCE.md`. Where conflict exists, OQMI_GOVERNANCE.md prevails.

---

## 1. Cloud Region and Jurisdiction

| Control | Requirement |
|---------|-------------|
| **Primary region** | `ca-central-1` (AWS Canada — Montreal) |
| **Data residency** | All PII, financial data, and audit records must remain in Canada at rest |
| **Secondary / DR region** | `ca-west-1` (AWS Canada — Calgary) — passive standby only |
| **Forbidden regions** | No production workload may execute outside Canadian AWS regions without explicit CEO sign-off |
| **Jurisdiction** | Ontario, Canada — PIPEDA + Bill C-27 (Digital Charter Implementation Act) |

---

## 2. Network Isolation

| Control | Requirement |
|---------|-------------|
| **VPC** | All compute, database, and cache resources must reside in a private VPC |
| **Postgres (port 5432)** | NEVER exposed on a public interface; private subnet only |
| **Redis (port 6379)** | NEVER exposed on a public interface; private subnet only |
| **NATS (port 4222)** | Private subnet only; no public listener |
| **Egress** | Outbound traffic routed via NAT Gateway; no public IPs on service instances |
| **Load balancer** | Application Load Balancer (ALB) is the only public-facing entry point; all traffic terminates TLS at ALB |
| **Security groups** | Principle of least privilege; intra-service ports only opened between named security groups |
| **VPN / Bastion** | Admin access via SSM Session Manager only; no SSH port exposed |

---

## 3. Data Storage and Encryption

| Control | Requirement |
|---------|-------------|
| **S3 encryption** | SSE-KMS mandatory; SSE-S3 not permitted for any bucket holding PII or financial data |
| **S3 Object Lock** | Enabled on all buckets holding audit logs, legal holds, and financial ledger exports — COMPLIANCE mode, 7-year retention |
| **S3 public access** | All public access blocked at bucket and account level; presigned URLs for time-limited delivery only |
| **Postgres at rest** | AWS RDS with storage encryption via KMS CMK |
| **Postgres in transit** | TLS 1.2+ required; `ssl_mode=require` enforced |
| **Redis at rest** | ElastiCache with encryption at rest enabled |
| **Redis in transit** | TLS 1.2+ required |
| **KMS keys** | Customer-managed keys (CMK) per service; automatic annual rotation enabled |
| **Secrets** | All secrets stored in AWS Secrets Manager or Parameter Store (SecureString); NEVER in environment variables baked into images or in source code |

---

## 4. Financial Integrity Zone (FIZ)

The FIZ encompasses any system path that reads, writes, or influences monetary values. FIZ controls are a strict superset of general security controls.

| Control | Requirement |
|---------|-------------|
| **Append-only ledger** | No UPDATE or DELETE on balance columns; offset-only writes |
| **Correlation ID** | Every financial record must carry a `correlation_id` (UUID v4) |
| **Reason code** | Every financial record must carry a `reason_code` |
| **Idempotency** | All financial writes are idempotent by `correlation_id`; duplicate requests return the original result without re-applying |
| **Hash chain** | Ledger entries are hash-chained; `prev_hash` must be verified before write |
| **Schema integrity** | No migration may alter, drop, or nullify a financial column without dual-agent review and CEO sign-off |
| **Audit trail** | Every FIZ event is written to the immutable audit chain within the same transaction |
| **FIZ commit format** | All commits touching FIZ paths must include `REASON:`, `IMPACT:`, and `CORRELATION_ID:` fields in the commit message |

FIZ-scoped paths (non-exhaustive):

- `services/ledger/`
- `services/gateguard-sentinel/`
- `services/gateguard-sentinel/av/`
- `services/cyrano/` (payout-touching paths only)
- `finance/`
- Any schema migration touching: `czt_balance`, `payout_rate`, `rate_state`, `welcome_credit_active`, `go_no_go_decision`, `pixel_legacy`

---

## 5. Secret Management

| Control | Requirement |
|---------|-------------|
| **Source tree** | Zero secrets in source code, committed files, or container image layers |
| **`.env` files** | `.env` and all variants (`*.env.*`) are in `.gitignore`; pre-commit hooks prevent accidental commit |
| **Runtime injection** | Secrets injected at runtime via AWS Secrets Manager; services fetch on startup |
| **Rotation** | Secrets rotated on a 90-day cycle minimum; database passwords rotated on a 30-day cycle |
| **Access** | IAM roles with least-privilege; no long-lived IAM access keys; use instance profiles and IRSA |
| **CI/CD** | GitHub Actions secrets via GitHub Actions encrypted secrets only; never in workflow YAML as plaintext |

---

## 6. Identity and Access Management

| Control | Requirement |
|---------|-------------|
| **Authentication** | Clerk (or equivalent) with MFA required for all admin and creator accounts |
| **Age assurance** | Age verification gate required before any restricted content is accessible |
| **JIT access** | Just-in-time elevated access for restricted data; time-bounded sessions |
| **RBAC** | Role-based access control enforced at API layer; roles: Admin, Creator/Model, Guest, Agent |
| **Session tokens** | Short-lived JWTs (15 min); refresh tokens stored in HttpOnly cookies |
| **Step-up auth** | Required for financial operations, personal data exports, and admin actions |
| **API keys** | Third-party API keys stored in Secrets Manager; scoped to least-privilege |

---

## 7. CI/CD and Ship Gates

| Control | Requirement |
|---------|-------------|
| **No secrets in CI** | GitHub Actions workflows must not contain plaintext secrets or credentials |
| **Policy lint** | All PRs must pass policy lint (`.github/workflows/ci.yml`) before merge |
| **Security scan** | CodeQL security scan runs on every PR; HIGH/CRITICAL findings block merge |
| **Dependency scan** | Dependabot configured for all ecosystems; HIGH/CRITICAL CVEs block merge |
| **Image signing** | Container images signed with AWS Signer or Cosign before deployment |
| **Ship gate** | `PROGRAM_CONTROL/ship-gate-verifier.ts` must pass before any production deployment |
| **Branch protection** | `main` is protected: linear history, squash-merge only, all status checks required |

---

## 8. Observability and Audit

| Control | Requirement |
|---------|-------------|
| **Centralized logging** | All service logs shipped to a centralized, tamper-resistant log store (CloudWatch Logs with KMS encryption) |
| **Audit chain** | Every sensitive action (auth, financial, admin, consent change) written to immutable hash-chained audit log |
| **Log retention** | 7-year minimum for financial and consent logs; 1-year for operational logs |
| **Metrics** | CloudWatch metrics + alarms for error rates, latency, and financial event throughput |
| **Tracing** | Distributed tracing via AWS X-Ray for all inter-service calls |
| **Alerting** | PagerDuty or equivalent; P1 alerts for financial anomalies, auth failures above threshold, and SLA breaches |

---

## 9. Real-Time Fabric

| Control | Requirement |
|---------|-------------|
| **Transport** | NATS JetStream is the only permitted transport for chat, telemetry, and haptic events |
| **No REST polling** | REST polling for real-time events is forbidden; use NATS subscriptions |
| **Topic registry** | All NATS topics must be registered in `services/nats/topics.registry.ts` |
| **Message persistence** | JetStream subjects used for financial and audit events must use `limits` or `interest` retention with replay |

---

## 10. Data Residency and Privacy

| Control | Requirement |
|---------|-------------|
| **PII classification** | All personal data classified before storage; categories: Restricted (biometric, financial), Sensitive (contact, identity), Internal, Public |
| **Consent** | Consent logs are append-only; every consent change is timestamped and tied to `correlation_id` |
| **Geo fencing** | Canadian users must have data processed in `ca-central-1`; geo-fence enforced at ALB |
| **Data minimization** | Collect only what is required; no shadow profiles |
| **Right to erasure** | Erasure requests processed within 30 days; financial records retained per legal obligation with PII redacted |
| **No raw PII in logs** | PII must not appear in operational logs; use masked identifiers |

---

## 11. Disaster Recovery

| Control | Requirement |
|---------|-------------|
| **RTO** | Recovery Time Objective: 4 hours for Tier 1 services (ledger, auth, streaming) |
| **RPO** | Recovery Point Objective: 15 minutes (continuous backup to `ca-west-1`) |
| **Backup testing** | DR drills conducted quarterly; immutable backups tested for restore |
| **RDS snapshots** | Automated daily snapshots; cross-region copy to `ca-west-1`; 35-day retention |
| **S3 replication** | Cross-region replication to `ca-west-1` for audit and financial buckets |

---

## 12. Third-Party Integration Security

| Control | Requirement |
|---------|-------------|
| **Webhook verification** | All inbound webhooks must verify HMAC signatures |
| **Outbound TLS** | All outbound HTTP calls use TLS 1.2+; certificate validation enforced |
| **Integration contracts** | Webhook contracts with eCommsZone, Cyrano, and RedRoomRewards must be documented in `docs/POLICIES/` before production traffic flows |
| **Allowlist** | Third-party egress limited to an allowlisted set of domains; no arbitrary outbound |

---

## 13. Prohibited Actions

The following are unconditionally forbidden across all OQMInc systems:

1. Secrets, credentials, or tokens committed to source control
2. UPDATE or DELETE on any balance or ledger column
3. Public exposure of Postgres (5432), Redis (6379), or NATS (4222) ports
4. Processing or storing PII outside Canadian AWS regions without CEO sign-off
5. Bypassing MFA for admin or financial operations
6. Deploying without all CI ship gates green
7. Hardcoded master passwords or backdoor authentication paths

---

## 14. Amendment Procedure

Amendments to this policy require:

1. A PR authored by an authorized agent
2. The PR title must include `INFRA:` prefix and reference the amendment reason
3. CEO review and merge (this policy is in Human-Review Category per OQMI_GOVERNANCE.md §2.2)
4. Version number increment and changelog entry at the bottom of this document

---

## Changelog

| Version | Date | Author | Summary |
|---------|------|--------|---------|
| v1.0 | 2026-05-06 | CEO directive (WORK-ORDER v0.1) | Initial policy — Phase 0 |
