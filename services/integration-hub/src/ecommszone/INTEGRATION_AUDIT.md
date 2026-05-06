# eCommsZone Integration Audit — Integration Hub
**Audit Date:** 2026-05-06
**Author:** Copilot (Phase 0 — per WORK-ORDER.md)
**Status:** PENDING_PARTNER_SDK — stub wired; production impl blocked on eCommsZone npm package

---

## 1. Dependency Status

| Item | Status | Notes |
|---|---|---|
| eCommsZone npm package | NOT_YET_PUBLISHED | Partner SDK not yet available on npm |
| Client interface stub | DONE | `ecommszone-client.interface.ts` |
| No-op stub (test/dev) | DONE | `ECommsZoneClientNoop` |
| Production impl | BLOCKED | Awaiting partner SDK |
| hub.module.ts wiring | PENDING | Wire `IECommsZoneClient` token on SDK arrival |

## 2. Integration Contract (per INFRA_v1.0 §8.1)

- All outbound comms (email, SMS, push) route through eCommsZone — no direct SMTP/SNS
- Only `pii_vault_ref` + `template_id` + non-PII template vars are sent to eCommsZone
- Inbound webhooks are authenticated via HMAC-SHA256 on `WEBHOOK_SIGNING_SECRET`
- eCommsZone data residency must be Canadian or covered by a PIPEDA-compliant SCA

## 3. Open Gaps (blockers)

| Gap ID | Description | Owner | Resolution |
|---|---|---|---|
| ECZ-GAP-001 | eCommsZone npm package not published | eCommsZone partner | Await partner SDK release |
| ECZ-GAP-002 | Partner PIPEDA/Canadian residency SLA not yet on file | CEO / Legal | Obtain and file under `PROGRAM_CONTROL/CLEARANCES/` |
| ECZ-GAP-003 | `hub.module.ts` not yet wired for `IECommsZoneClient` DI token | Copilot | Wire after SDK available |
| ECZ-GAP-004 | eCommsZone webhook endpoint not yet implemented | claude-code | Implement on SDK arrival |

## 4. Next Steps

1. CEO or Legal to obtain eCommsZone data-residency SLA and file clearance
2. eCommsZone publishes npm client package → integrate as `ECommsZoneClientImpl`
3. Wire `IECommsZoneClient` into `hub.module.ts` and update NATS topics registry
4. Add `INFRA-4` ship-gate check once production impl is live
