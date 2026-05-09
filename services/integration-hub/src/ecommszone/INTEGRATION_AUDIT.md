# eCommsZone Integration Audit — Integration Hub
**Audit Date:** 2026-05-06
**Updated:** 2026-05-09 (Phase 1 — INFRA_v1.0 comms module delivered)
**Author:** Copilot (Phase 1 — per WORK-ORDER-v0.2.md)
**Status:** PARTIAL — comms module wired; production impl blocked on eCommsZone npm package

---

## 1. Dependency Status

| Item | Status | Notes |
|---|---|---|
| eCommsZone npm package | NOT_YET_PUBLISHED | Partner SDK not yet available on npm |
| Client interface stub | DONE | `ecommszone-client.interface.ts` |
| No-op stub (test/dev) | DONE | `ECommsZoneClientNoop` |
| Production impl | BLOCKED | Awaiting partner SDK (ECZ-GAP-001) |
| `hub.module.ts` wiring | **DONE** | `ECommsModule` imported + exported — mandatory routing active |
| `ECommsZoneService` (mandatory routing) | **DONE** | `services/integration-hub/comms/ecommszone.service.ts` |
| `ECommsModule` (NestJS module) | **DONE** | `services/integration-hub/comms/ecommszone.module.ts` |
| Webhook controller | **DONE** | `services/integration-hub/comms/ecommszone.controller.ts` |
| PII_REFERENCE_ONLY guard | **DONE** | `assertNoPii()` in `ECommsZoneService` |
| HMAC-SHA256 webhook verification | **DONE** | `verifyWebhookSignature()` — timing-safe |
| Unit tests (19 cases) | **DONE** | `services/integration-hub/comms/ecommszone.service.spec.ts` |
| INFRA-4 ship-gate check | **DONE** | Passes GREEN in `ship-gate-verifier.ts` |

## 2. Integration Contract (per INFRA_v1.0 §8.1)

- All outbound comms (email, SMS, push) route through eCommsZone — no direct SMTP/SNS
- Only `pii_vault_ref` + `template_id` + non-PII template vars are sent to eCommsZone
- Inbound webhooks are authenticated via HMAC-SHA256 on `WEBHOOK_SIGNING_SECRET`
- eCommsZone data residency must be Canadian or covered by a PIPEDA-compliant SCA

## 3. Open Gaps

| Gap ID | Description | Owner | Resolution |
|---|---|---|---|
| ECZ-GAP-001 | eCommsZone npm package not published | eCommsZone partner | Await partner SDK release — swap `ECommsZoneClientNoop` for `ECommsZoneClientImpl` |
| ECZ-GAP-002 | Partner PIPEDA/Canadian residency SLA not yet on file | CEO / Legal | Obtain and file under `PROGRAM_CONTROL/CLEARANCES/` |

## 4. Resolved Gaps (Phase 1)

| Gap ID | Description | Resolution | Date |
|---|---|---|---|
| ECZ-GAP-003 | `hub.module.ts` not wired for `IECommsZoneClient` DI token | `ECommsModule` imported into `IntegrationHubModule` | 2026-05-09 |
| ECZ-GAP-004 | eCommsZone webhook endpoint not implemented | `POST /comms/ecommszone/webhook` in `ecommszone.controller.ts` | 2026-05-09 |

## 5. Next Steps

1. CEO or Legal to obtain eCommsZone data-residency SLA and file clearance (ECZ-GAP-002)
2. eCommsZone publishes npm client package → implement `ECommsZoneClientImpl`, swap out `ECommsZoneClientNoop` in `ecommszone.module.ts`
3. NATS topic `ECOMMSZONE_DISPATCH_CONFIRMED` may be added when the prod client is wired
