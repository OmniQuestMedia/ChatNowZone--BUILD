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
