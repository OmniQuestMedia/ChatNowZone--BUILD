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
**Document ID:** INFRA_v1.0
**Authority:** Kevin B. Hartley, CEO — OmniQuest Media Inc.
**Effective Date:** 2026-05-06
**Status:** ACTIVE
**Scope:** All OmniQuest Media Inc. production environments — primary: ChatNow.Zone
**Governing Document:** `PROGRAM_CONTROL/DIRECTIVES/QUEUE/OQMI_GOVERNANCE.md`

---

## 1. PURPOSE

This policy defines the mandatory infrastructure and security requirements for
all OmniQuest Media Inc. production systems. It is the authoritative source for:

- Cloud region and data residency requirements
- Backup, disaster recovery, and WORM (Write Once Read Many) retention
- PII handling and data classification
- Network isolation and zero-trust posture
- Endpoint detection and response (EDR)
- Partner ecosystem connection constraints
- Audit and observability obligations

This document is referenced by the Ship-Gate Verifier (`PROGRAM_CONTROL/ship-gate-verifier.ts`).
Failures in INFRA-category checks block the L0 ship-gate.

---

## 2. DATA RESIDENCY

### 2.1 Canada-First Mandate

All production data, backups, and analytics MUST reside in **Canada** unless
an explicit CEO waiver is on file in `PROGRAM_CONTROL/CLEARANCES/`.

- **Primary region:** `ca-central-1` (AWS Canada — Central, Montreal)
- **Failover region:** `ca-west-1` (AWS Canada — West, Calgary) — available
  from 2024 and preferred over any US region for DR
- No production workload may be hosted outside a Canadian AWS region without
  a `CEO_GATE: YES` clearance signed in `PROGRAM_CONTROL/CLEARANCES/`

### 2.2 Partner Data Flows

Where partner APIs (eCommsZone, RedRoomRewards, Cyrano) receive or process
subscriber PII, the partner contract MUST include a Canadian data-residency SLA
or a documented legal transfer mechanism (PIPEDA-compliant SCCs).

---

## 3. WORM BACKUP AND DISASTER RECOVERY

### 3.1 Backup Rule

OQMInc adopts the **3-2-1 immutable backup rule**:

- **3** copies of data
- on **2** different media types (e.g., live RDS + S3 Object Lock snapshot)
- with **1** off-site (different AWS region: `ca-west-1` or secured cold vault)

### 3.2 WORM Retention — S3 Object Lock

All database snapshots, ledger exports, and audit chain exports MUST be stored
in an S3 bucket configured with **S3_OBJECT_LOCK** in Compliance mode with a
minimum retention period of **90 days** (`WORM_RETENTION_DAYS: 90`).

- Bucket naming convention: `oqmi-cnz-worm-<environment>`
- KMS encryption: AWS-managed CMK in `ca-central-1`
- No `s3:DeleteObject` permission may be granted to any service role

### 3.3 Quarterly DR Test

A disaster-recovery restoration test MUST be executed and documented quarterly.
Test results are recorded in `PROGRAM_CONTROL/REPORT_BACK/DR_TEST_<YYYY-QN>.md`.

### 3.4 WORM Export — Audit Chain

The Immutable Audit Service (`services/core-api/src/audit/`) MUST periodically
export its hash-chain records to the WORM bucket (`AUDIT_EXPORT_ENABLED: true`).
The export frequency is governed by `governance.config.ts`.

---

## 4. PII HANDLING

### 4.1 PII Reference-Only Principle

**`PII_REFERENCE_ONLY`** — ChatNow.Zone services MUST NOT store raw PII
(legal name, SIN, address, payment card data, government ID) in application
tables. Permitted data model:

- **Reference pointer only:** store an opaque `pii_vault_ref` UUID that resolves
  to the PII vault (a PIPEDA-compliant third-party vault or a dedicated isolated
  service)
- Application tables may store: email hash (SHA-256 + salt), display name,
  platform-generated IDs, consent flags, and tokenized payment references

### 4.2 PII Vault

The PII vault (external or internal isolated service) must:

- Be hosted within `ca-central-1`
- Enforce column-level encryption (AES-256)
- Support right-to-erasure (PIPEDA §7) by nulling the vault record; the
  `pii_vault_ref` in application tables becomes a dead reference — no cascading
  delete into ledger tables (append-only invariant)

### 4.3 Logs and Observability

No PII may appear in application logs, NATS payloads, or audit chain records.
Only `pii_vault_ref` pointers are permitted in audit events. Violation of this
rule is a **HARD_STOP** security incident.

---

## 5. NETWORK ISOLATION

### 5.1 Database and Cache

Per the existing invariant (`NET-1` in ship-gate-verifier):

- Postgres (port `5432`) MUST NOT be exposed on any public interface
- Redis (port `6379`) MUST NOT be exposed on any public interface

In production (IaC), both services run in a private VPC subnet with no
inbound internet route. Security groups allow only the application tier's
security group as a source.

### 5.2 VPC Design

- One dedicated VPC per environment (`dev`, `staging`, `prod`)
- Public subnet: ALB only
- Private subnet: application containers, Postgres, Redis, NATS
- No NAT Gateway route for Postgres or Redis subnets
- VPC Flow Logs enabled; logs exported to `ca-central-1` S3 WORM bucket

### 5.3 API Gateway

All inbound traffic terminates at the AWS Application Load Balancer (ALB) in
the public subnet. The ALB forwards to NestJS containers in the private subnet.
Direct EC2/container ports are never exposed to the internet.

---

## 6. ZERO-TRUST AND EDR

### 6.1 Zero-Trust Posture

- All service-to-service calls within the VPC use mTLS where supported by
  the framework (NestJS + NATS TLS)
- IAM roles follow least-privilege: each service has its own task role with
  only the permissions it requires
- No long-lived IAM access keys; use IAM Roles for Service Accounts (IRSA)
  or ECS task roles exclusively

### 6.2 Endpoint Detection and Response (EDR)

- All developer workstations and CI runners that access production secrets
  MUST have an approved EDR agent installed (Crowdstrike Falcon or equivalent)
- Production container images are scanned for CVEs at build time via
  `docker scout` or AWS Inspector before deployment
- Critical and high CVEs block the deployment pipeline

---

## 7. SECRET MANAGEMENT

- Credentials, API keys, and tokens MUST reside in the developer's local
  environment or AWS Secrets Manager — NEVER on CNZ servers or in the repo
- No `.env` file containing production secrets may be committed (enforced by
  `SEC-1` in ship-gate-verifier)
- AWS Secrets Manager is the production store; secrets rotate every 90 days
- Webhook signing secrets (`WEBHOOK_SIGNING_SECRET`, `RBAC_STEP_UP_SIGNING_SECRET`)
  are injected at container start via ECS task definitions — never baked into
  container images

---

## 8. PARTNER ECOSYSTEM CONTRACTS

### 8.1 eCommsZone

- All outbound communication (email, SMS, push) MUST route through eCommsZone
- eCommsZone receives only `pii_vault_ref` + message template ID — no raw PII
- Webhook delivery from eCommsZone is authenticated via HMAC-SHA256 on
  `WEBHOOK_SIGNING_SECRET`
- Client integration: `services/integration-hub/src/ecommszone/`

### 8.2 RedRoomRewards (RRR)

- Loyalty point awards and marketplace hooks route via the RRR webhook
- RRR webhook is signed and verified on ingress
- No RRR payload may contain raw PII — reference pointers only
- Webhook contract: `services/integration-hub/WEBHOOK_CONTRACTS.md`

### 8.3 Cyrano

- Cyrano LLM calls are bounded by the 350 ms latency budget (FFS-003)
- Cyrano receives session context, heat scores, and sanitized frame data only
- No Cyrano payload may include wallet balances, payout rates, or PII
- Payout-touching Cyrano paths fall under the FIZ zone and require
  `REASON`, `IMPACT`, and `CORRELATION_ID` in every commit

---

## 9. COMPLIANCE OBLIGATIONS

| Regulation | Scope | Owner |
|---|---|---|
| PIPEDA | Canadian subscriber PII | CEO / Legal |
| Canada Anti-Spam Legislation (CASL) | Email/SMS comms | eCommsZone SLA |
| PCI-DSS (SAQ A) | Payment card tokenization | Payment processor |
| OQMI_GOVERNANCE §12 | Banned entity quarantine | All agents |

---

## 10. AMENDMENTS

This policy is amended by the CEO only. Each amendment increments the version
suffix (INFRA_v1.1, INFRA_v1.2, …) and is recorded in `docs/POLICIES/CHANGELOG.md`.

Prior conflicting or superseded infra policy artifacts are moved to
`archive/INFRA-PRE-<date>/` per OQMI_GOVERNANCE §12 repo hygiene.

---

_© OmniQuest Media Inc. All rights reserved. Authority: Kevin B. Hartley, CEO._
# OQMI_INFRASTRUCTURE_AND_SECURITY_POLICY.md

**Document:** OQMI_INFRASTRUCTURE_AND_SECURITY_POLICY.md  
**Authority:** OmniQuest Media Inc. (OQMInc™)  
**Scope:** Company-wide (all environments, repos, production, staging, and development). Complements and extends OQMI_GOVERNANCE.md (repo-portable coding governance).  
**Version:** v1.0  
**Effective Date:** 2026-05-06  
**Platform Time Standard:** America/Toronto  
**Authority of Record:** Kevin B. Hartley, CEO — OmniQuest Media Inc.

---

## 0. PURPOSE

This document establishes the non-negotiable operational, security, and infrastructure policies for OmniQuest Media Inc. It governs server operations, database management, AI system usage, data security, backup/disaster-recovery (DR), and defenses against malware/ransomware.

It synthesizes the highest-integrity practices from:

- OQMI_GOVERNANCE.md (coding agents, AI advisory boundary, financial invariants, commit discipline, audit logging)
- Integration & Automation doctrine (deterministic, auditable, "It Just Works")
- REDBOOK Corpus & Canonical Corpus (financial sovereignty, compliance-first, consent/age-assurance, PII minimization)
- VoiceSampleCollectionService directive (encrypted path references only, never raw sensitive media in DB, consent gates)
- [INTEL] reporting and operational intelligence requirements

Where any conflict arises, this document and OQMI_GOVERNANCE.md prevail. This policy is Human-Review Category (§2.2 of OQMI_GOVERNANCE.md) for any material amendment.

---

## 1. REFERENCE TO CORE GOVERNANCE

All teams and agents must read and comply with OQMI_GOVERNANCE.md before any non-trivial infrastructure or security work. Key cross-references:

- **§5** — Code invariants (append-only, deterministic, idempotent financial/audit paths)
- **§6** — Security posture (least privilege, no secrets in code/logs, audit events with rule_applied_id)
- **§7** — Advisory-AI boundary (AI is read-only/proposal-generating; never mutates ledger, authorizes refunds, or overrides compliance)
- **§8** — Commit discipline (four-line FIZ format on financial-integrity paths)

---

## 2. CODING & AI INTEGRITY (EXTENDED FROM OQMI_GOVERNANCE)

- Coding agents (Claude Code, Copilot, Grok, etc.) operate in **Droid Mode** only. No creative deviation from assigned tasks.
- All changes to financial, compliance, or PII-handling code require `rule_applied_id: 'VOICE_SAMPLE_v1'`-style traceability (or equivalent per module).
- AI systems are **advisory infrastructure only**. They may draft policies, summarize logs, or propose code, but **never**:
  - Compute earnings/payouts
  - Mutate ledger/audit/balance tables
  - Authorize irreversible actions (refunds, suspensions, content takedowns)
  - Bypass consent/age gates
- **Hard invariant:** Raw sensitive data (voice samples, ID images, payment details, NCII evidence) never enters application code or DB except via encrypted references or immutable audit hashes.

---

## 3. SERVER & DATABASE OPERATIONS

**Principles (zero-trust, defense-in-depth):**

- All production workloads run in Canada (data sovereignty under PIPEDA).
- Database and cache services (Postgres, Redis, etc.) never exposed to public internet. Use private VPCs only.
- Least-privilege IAM / RBAC enforced at every layer (service accounts, not root).
- All traffic encrypted in transit (TLS 1.3 minimum).
- Encryption at rest mandatory (AWS KMS / equivalent with customer-managed keys where possible).
- Multi-tenant isolation enforced via `organization_id` + `tenant_id` on every write (per VoiceSample model pattern).

**Database invariants:**

- Financial/audit/compliance tables: append-only (no UPDATE/DELETE; use offset entries).
- Every table includes `correlation_id`, `reason_code`, `rule_applied_id`.
- VoiceSample-style records store encrypted path references only (SSE-S3 object key); raw media/audio/PII never in DB.

---

## 4. CRITERIA FOR THIRD-PARTY CANADIAN SERVER PROVIDERS

All infrastructure vendors must meet or exceed the following mandatory criteria (evaluated annually by CEO + engineering lead):

| Criterion | Requirement | Rationale |
| --- | --- | --- |
| Data Residency | All production data stored in Canadian regions only (e.g., AWS ca-central-1, Azure Canada Central, Google Cloud Toronto/Montreal, OVH Canada, ThinkOn, eStruxture) | PIPEDA, avoids CLOUD Act / foreign government access risks |
| Compliance Certifications | SOC 2 Type II, ISO 27001, PCI-DSS (for payment paths), PIPEDA-compliant | Mandatory for adult platform handling PII, payments, age/consent data |
| Encryption & Key Management | Customer-managed KMS, SSE-S3 or equivalent, no vendor default keys for sensitive data | Protects voice samples, consent records, financials |
| Audit & Logging | Full audit logs exported to immutable SIEM (e.g., AWS CloudTrail + S3 immutable) | Required for [INTEL] reporting and regulatory defense |
| SLA & Uptime | ≥99.99% availability, <5 min RTO for critical services | "It Just Works" moral obligation |
| Incident Response | 24/7 SOC, <1 hour initial response for security incidents, contractual obligation to notify OQMInc within 15 min of breach | Ransomware/malware containment |
| Canadian Legal Entity | Vendor must have Canadian legal presence and data-processing agreement | Sovereignty & enforceability |
| No Backdoors / Transparency | Vendor publishes transparency report; no known government backdoors | Trust in adult-industry compliance |
| Exit Strategy | Data export tooling + 90-day migration window guaranteed | Avoid vendor lock-in |

**Preferred Tier-1 providers (2026):** AWS ca-central-1, OVHcloud Canada, Azure Canada Central.  
**Prohibited:** Any U.S.-only or non-sovereign providers for production workloads.

---

## 5. BACKUP & DISASTER-RECOVERY PLANS

**Mandatory 3-2-1 Rule (with immutability):**

- 3 copies of data
- 2 different media/types (e.g., S3 + Glacier)
- 1 offsite / air-gapped (immutable object storage or tape)

**Specific requirements:**

- Daily immutable backups (S3 Object Lock or equivalent with 90-day minimum retention for financial/audit data).
- Weekly full + daily incremental for non-financial data.
- Encrypted (AES-256) and immutable (WORM — Write Once, Read Many).
- Tested quarterly (documented restore drills with RTO/RPO metrics).
- Voice samples & PII: Backups reference encrypted S3 keys only; never contain raw media.
- **RPO:** ≤5 minutes for financial/audit data; ≤1 hour for all other production data.
- **RTO:** ≤15 minutes for critical services (ledger, consent gates).
- **DR Strategy:** Active-active in secondary Canadian AZ/region where feasible. Failover tested biannually.

---

## 6. DATA SECURITY & PII HANDLING

- **Classification:** All data tagged (Public / Internal / Sensitive / Restricted). Voice samples, consent logs, payment events = Restricted.
- **Minimization:** Store only what is required. Raw audio/ID images never persisted.
- **Encryption:** At-rest (KMS), in-transit (TLS 1.3), in-use where possible (confidential computing).
- **Access:** Just-in-time, audited, role-bound, step-up authentication for Restricted data.
- **Logging:** Every access to Restricted data emits immutable audit event (§6.5 of OQMI_GOVERNANCE).
- **Deletion/Retention:** Strict legal holds for compliance data; automated purge after retention window (PIPEDA-aligned).

---

## 7. MALWARE & RANSOMWARE DEFENSE

**Defense-in-depth stack (mandatory):**

- Endpoint Detection & Response (EDR) on all servers/workstations.
- Network segmentation (micro-segmentation via VPCs/security groups).
- Immutable backups (see §5) — primary ransomware mitigation.
- Zero-trust network access (no direct SSH/RDP; use bastion or SSM).
- MFA everywhere (including infrastructure consoles and CI/CD).
- Continuous vulnerability scanning + automated patching (within 48h for critical CVEs).
- Air-gapped / offline backups for long-term archives.

**Incident Response Plan (IRP):**

- Immediate isolation of affected systems.
- Forensic snapshot before remediation.
- CEO notification within 15 minutes.
- Post-incident [INTEL] report filed within 24h.
- Lessons-learned incorporated into policy within 7 days.

**Prohibited:** Any "restore from backup" that would re-introduce malware. Always validate integrity first.

---

## 8. MONITORING, ALERTING & [INTEL] REPORTING

- Centralized observability (logs, metrics, traces) with immutable retention.
- Automated anomaly detection for financial drift, consent-gate bypass, unusual access patterns.
- All incidents generate "evidence-ready" [INTEL] pack per attached [INTEL] Report Requirements.
- Monthly executive security posture review (CEO + engineering).

---

## 9. AGENT & VENDOR HANDOFF PROTOCOL

Same discipline as OQMI_GOVERNANCE.md §9. Any incomplete infrastructure work must end with a `## HANDOFF` block specifying next steps.

---

## 10. AMENDMENT PROCEDURE

Follow Human-Review Category process in OQMI_GOVERNANCE.md §2.2. PR modifying this document requires CEO merge.

---

## 11. INVARIANTS REGISTER (QUICK REFERENCE)

| # | Invariant | rule_applied_id |
| --- | --- | --- |
| 1 | Canada-only data residency for production | INFRA_v1.0-INV-01 |
| 2 | Raw sensitive media/PII never stored in DB — encrypted references only | INFRA_v1.0-INV-02 |
| 3 | Immutable, encrypted, tested backups (3-2-1 + WORM) | INFRA_v1.0-INV-03 |
| 4 | AI advisory-only; never mutates financial/compliance state | INFRA_v1.0-INV-04 |
| 5 | All infrastructure changes audited with rule_applied_id | INFRA_v1.0-INV-05 |
| 6 | Least-privilege + zero-trust enforced at every layer | INFRA_v1.0-INV-06 |
| 7 | Ransomware defense = immutable backups + rapid isolation | INFRA_v1.0-INV-07 |

This policy is effective immediately. All existing and future infrastructure must conform.

---

**Authority:** Kevin B. Hartley, CEO — OmniQuest Media Inc.  
**Effective:** 2026-05-06  
**rule_applied_id:** INFRA_v1.0
