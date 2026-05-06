# Webhook Contracts — Integration Hub
**Document:** `services/integration-hub/WEBHOOK_CONTRACTS.md`
**Date:** 2026-05-06
**Authority:** Kevin B. Hartley, CEO — OmniQuest Media Inc.
**Status:** DRAFT — pending partner confirmations (Phase 0 cross-repo sync)

---

## 1. eCommsZone — Inbound Webhook

**Direction:** eCommsZone → ChatNow.Zone  
**Purpose:** Delivery status events (DELIVERED, BOUNCED, COMPLAINED, CLICKED, UNSUBSCRIBED)  
**Endpoint:** `POST /webhooks/ecommszone/delivery` (TBD — implement on SDK arrival)  
**Auth:** HMAC-SHA256 over `${ecomms_message_id}|${occurred_at_utc}` using `WEBHOOK_SIGNING_SECRET`  
**Interface:** `ECommsWebhookEvent` in `ecommszone-client.interface.ts`

| Field | Type | Required | Notes |
|---|---|---|---|
| `event` | enum | Yes | DELIVERED / BOUNCED / COMPLAINED / CLICKED / UNSUBSCRIBED |
| `ecomms_message_id` | string | Yes | eCommsZone internal ID |
| `pii_vault_ref` | string | Yes | Opaque reference; no raw PII |
| `template_id` | string | Yes | Template used for dispatch |
| `occurred_at_utc` | ISO-8601 | Yes | Event timestamp |
| `hmac_signature` | string | Yes | HMAC-SHA256 signature |

**Invariants:**
- Raw PII MUST NOT appear in payload (INFRA_v1.0 §4.3)
- Signature must be verified before processing (INFRA_v1.0 §8.1)
- Failed verification: HTTP 401, emit `AUDIT_IMMUTABLE_WEBHOOK_REJECTED` NATS topic

**Confirmation status:** PENDING — awaiting eCommsZone partner confirmation

---

## 2. RedRoomRewards (RRR) — Inbound Webhook

**Direction:** RRR → ChatNow.Zone  
**Purpose:** Loyalty point award events and marketplace hooks  
**Endpoint:** `POST /webhooks/rrr/loyalty` (TBD)  
**Auth:** HMAC-SHA256 using `WEBHOOK_SIGNING_SECRET` (separate secret from eCommsZone)  

| Field | Type | Required | Notes |
|---|---|---|---|
| `event` | enum | Yes | POINTS_AWARDED / REDEMPTION_REQUESTED / MARKETPLACE_PURCHASE |
| `rrr_member_id` | string | Yes | RRR-assigned member ID; maps to CNZ `pii_vault_ref` |
| `points_delta` | integer | Yes | Positive = award, Negative = redemption |
| `correlation_id` | string | Yes | Must match CNZ transaction `correlation_id` where applicable |
| `reason_code` | string | Yes | RRR-side reason code |
| `occurred_at_utc` | ISO-8601 | Yes | Event timestamp |
| `hmac_signature` | string | Yes | HMAC-SHA256 signature |

**Invariants:**
- RRR member IDs must be mapped to CNZ `pii_vault_ref` — RRR MUST NOT send legal names
- All loyalty mutations use CNZ append-only ledger entries (FIZ invariant)
- `correlation_id` required on every event

**Confirmation status:** PENDING — D5 (RRR separate repo, per CEO decisions 2026-04-17) implies separate webhook endpoint

---

## 3. Cyrano — Internal Event Bridge

**Direction:** ChatNow.Zone → Cyrano (outbound call) / Cyrano → ChatNow.Zone (response)  
**Protocol:** NATS.io topics (not HTTP webhooks) — per LATENCY_INVARIANT  
**Topics:** `CYRANO_SUGGESTION_EMITTED` (response), `HUB_HIGH_HEAT_MONETIZATION` (trigger)  
**Auth:** NATS TLS + subject-based authorization (per INFRA_v1.0 §6.1)

| Topic | Direction | Schema |
|---|---|---|
| `HUB_HIGH_HEAT_MONETIZATION` | CNZ → Cyrano | `CyranoInputFrame` + heat score |
| `CYRANO_SUGGESTION_EMITTED` | Cyrano → CNZ | `CyranoSuggestion` |

**Latency budget:** ≤ 350 ms (FFS-003)  
**Invariants:**
- No wallet balances, payout rates, or PII in Cyrano payloads
- Payout-touching paths require FIZ dual-prefix commit

**Confirmation status:** CONFIRMED — NATS contract implemented in Payload 5 + Payload 10

---

## 4. Confirmation Checklist (Cross-Repo Sync)

| Partner | Contract Type | Confirmed | Blocking Gap |
|---|---|---|---|
| eCommsZone | Inbound HTTP webhook | ❌ PENDING | ECZ-GAP-001 — SDK + endpoint not live |
| RedRoomRewards | Inbound HTTP webhook | ❌ PENDING | RRR repo separate (D5) — separate webhook endpoint needed |
| Cyrano | NATS internal | ✅ CONFIRMED | None — implemented in Payload 5/10 |

---

_Last updated: 2026-05-06 by Copilot (Phase 0)_
