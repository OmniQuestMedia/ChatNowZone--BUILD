# Webhook Contracts — Integration Hub
**Document:** `services/integration-hub/WEBHOOK_CONTRACTS.md`
**Date:** 2026-05-06 (Phase 1 update: 2026-05-11)
**Authority:** Kevin B. Hartley, CEO — OmniQuest Media Inc.
**Status:** PHASE 1 — outbound contracts added; inbound partner confirmations pending

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

---

## 4. Outbound Webhooks — ChatNow.Zone → Partners

ChatNow.Zone dispatches **signed outbound webhook notifications** to partner
systems when the following canonical events occur. Signing uses HMAC-SHA256
over `${event_type}|${event_id}|${occurred_at_utc}` with
`OUTBOUND_WEBHOOK_SIGNING_SECRET` (partner-specific secret from Secrets Manager).

Implementation: `services/integration-hub/comms/outbound-webhook.service.ts`

### 4.1 LEDGER_ENTRY_APPENDED

**Direction:** ChatNow.Zone → RedRoomRewards, Marketplace-Build  
**Purpose:** Notify partners when a ledger entry is appended (FIZ append-only)  
**Env key:** `OUTBOUND_WEBHOOK_URL_REDROOM_REWARDS`, `OUTBOUND_WEBHOOK_URL_MARKETPLACE_BUILD`

| Field | Type | Notes |
|---|---|---|
| `event_id` | UUID v4 | Unique event identifier |
| `event_type` | `LEDGER_ENTRY_APPENDED` | — |
| `wallet_id` | string | Opaque wallet ID — no raw account numbers |
| `intent` | enum | PURCHASE / SPEND / EXTENSION / RECOVERY / DIAMOND_QUOTE / PAYOUT |
| `amount_tokens` | integer | Non-negative |
| `bucket` | enum | purchased / membership / bonus (spend order position) |
| `correlation_id` | string | CNZ transaction correlation ID |
| `reason_code` | string | Ledger reason code |
| `occurred_at_utc` | ISO-8601 | — |
| `hmac_signature` | string | HMAC-SHA256 — partners verify on receipt |

### 4.2 CONSENT_UPDATED

**Direction:** ChatNow.Zone → Marketplace-Build  
**Purpose:** PIPEDA compliance — notify marketplace when consent record changes

| Field | Type | Notes |
|---|---|---|
| `event_id` | UUID v4 | — |
| `event_type` | `CONSENT_UPDATED` | — |
| `pii_vault_ref` | UUID v4 | Opaque vault ref — NO raw email/phone (PII_REFERENCE_ONLY) |
| `consent_granted` | boolean | New consent state |
| `channel` | enum | EMAIL / SMS / PUSH |
| `correlation_id` | string | — |
| `reason_code` | string | — |
| `occurred_at_utc` | ISO-8601 | — |
| `hmac_signature` | string | — |

### 4.3 RISK_DECISION_EMITTED

**Direction:** ChatNow.Zone → RedRoomRewards  
**Purpose:** Notify RRR when a Risk Engine decision blocks or flags a transaction

| Field | Type | Notes |
|---|---|---|
| `event_id` | UUID v4 | — |
| `event_type` | `RISK_DECISION_EMITTED` | — |
| `composite_score` | number | 0–100 |
| `tier` | enum | GREEN / AMBER / RED / CRITICAL |
| `decision` | enum | PASS / REVIEW / BLOCK / ESCALATE |
| `reason_codes` | string[] | Non-PII risk codes |
| `correlation_id` | string | — |
| `reason_code` | string | — |
| `occurred_at_utc` | ISO-8601 | — |
| `hmac_signature` | string | — |

### 4.4 PAYOUT_COMPLETED

**Direction:** ChatNow.Zone → RedRoomRewards, Marketplace-Build  
**Purpose:** Notify partners when a creator payout is settled

| Field | Type | Notes |
|---|---|---|
| `event_id` | UUID v4 | — |
| `event_type` | `PAYOUT_COMPLETED` | — |
| `creator_pii_vault_ref` | UUID v4 | Opaque vault ref — NO raw names/banking (PII_REFERENCE_ONLY) |
| `amount_usd_cents` | integer | Payout amount; negative = clawback |
| `payout_rate_applied` | number | Rate locked at transaction time |
| `payout_rate_lock_correlation_id` | string | FIZ audit trail link |
| `correlation_id` | string | — |
| `reason_code` | string | — |
| `occurred_at_utc` | ISO-8601 | — |
| `hmac_signature` | string | — |

---

## 5. Marketplace-Build — Inbound Webhook

**Direction:** Marketplace-Build → ChatNow.Zone  
**Purpose:** Marketplace purchase/listing events  
**Endpoint:** `POST /webhooks/marketplace/events` (TBD — implement on Marketplace-Build repo sync)  
**Auth:** HMAC-SHA256 using `MARKETPLACE_WEBHOOK_SIGNING_SECRET` (separate secret)

| Field | Type | Required | Notes |
|---|---|---|---|
| `event` | enum | Yes | LISTING_CREATED / PURCHASE_COMPLETED / LISTING_REMOVED |
| `marketplace_item_id` | string | Yes | Marketplace-assigned item ID |
| `pii_vault_ref` | string | Yes | Opaque buyer/seller ref — no raw PII |
| `amount_usd_cents` | integer | Yes | Transaction amount |
| `correlation_id` | string | Yes | Must match CNZ correlation_id for ledger linkage |
| `reason_code` | string | Yes | Marketplace-side reason code |
| `occurred_at_utc` | ISO-8601 | Yes | Event timestamp |
| `hmac_signature` | string | Yes | HMAC-SHA256 signature |

**Invariants:**
- Marketplace member IDs must map to CNZ `pii_vault_ref` — no legal names
- All marketplace-triggered ledger mutations use CNZ append-only ledger entries
- `correlation_id` required on every event

**Confirmation status:** PENDING — Marketplace-Build is a separate repo; webhook endpoint not yet implemented

---

## 6. Confirmation Checklist (Cross-Repo Sync)

| Partner | Direction | Contract Type | Confirmed | Blocking Gap |
|---|---|---|---|---|
| eCommsZone | Inbound | HTTP webhook | ❌ PENDING | ECZ-GAP-001 — SDK + endpoint not live |
| eCommsZone | Outbound | NATS dispatch | ✅ CONFIRMED | `ECommsZoneService.dispatch()` implemented |
| RedRoomRewards | Inbound | HTTP webhook | ❌ PENDING | RRR repo separate (D5) |
| RedRoomRewards | Outbound | Signed HTTP webhook | ✅ CONFIRMED | `OutboundWebhookService` — LEDGER_ENTRY_APPENDED + RISK_DECISION_EMITTED + PAYOUT_COMPLETED |
| Cyrano | Internal | NATS | ✅ CONFIRMED | Implemented in Payload 5/10 |
| Marketplace-Build | Inbound | HTTP webhook | ❌ PENDING | Separate repo — endpoint not yet implemented |
| Marketplace-Build | Outbound | Signed HTTP webhook | ✅ CONFIRMED | `OutboundWebhookService` — LEDGER_ENTRY_APPENDED + CONSENT_UPDATED + PAYOUT_COMPLETED |

---

_Last updated: 2026-05-11 by Copilot (Phase 1 — WORK-ORDER-v0.3)_
