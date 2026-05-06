# OQMI Infrastructure and Security Policy

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
