// INFRA: Phase 1 — Outbound Webhook Types
// rule_applied_id: INFRA_v1.0
// Authority: OmniQuest Media Inc. — Kevin B. Hartley, CEO
//
// Typed payloads for signed outbound webhook notifications dispatched by
// ChatNow.Zone to partner systems (RedRoomRewards, Marketplace-Build) when
// canonical events occur: ledger entries, consent changes, risk decisions,
// and payout completions.
//
// INVARIANTS:
//   - All payloads contain `correlation_id` and `reason_code` (schema integrity).
//   - Raw PII MUST NOT appear in any outbound payload (INFRA_v1.0 §4.1 PII_REFERENCE_ONLY).
//   - Every payload carries `rule_applied_id` for traceability.
//   - Signature computed as HMAC-SHA256(`${event_type}|${event_id}|${occurred_at_utc}`,
//     OUTBOUND_WEBHOOK_SIGNING_SECRET) — partners verify on receipt.

/** Supported outbound event types for partner webhook dispatch. */
export type OutboundWebhookEventType =
  | 'LEDGER_ENTRY_APPENDED'   // FIZ: append-only ledger write completed
  | 'CONSENT_UPDATED'         // PII: notification consent change
  | 'RISK_DECISION_EMITTED'   // Risk Engine decision (PASS/BLOCK/ESCALATE)
  | 'PAYOUT_COMPLETED';       // Creator payout settled

/** Partner endpoints that receive outbound webhook notifications. */
export type OutboundWebhookPartner =
  | 'REDROOM_REWARDS'   // Loyalty + marketplace hooks
  | 'MARKETPLACE_BUILD'; // Marketplace platform hooks

/** Base fields present on every outbound webhook payload. */
export interface OutboundWebhookBase {
  /** Monotonically unique event ID (UUID v4). */
  event_id: string;
  /** Event type discriminator. */
  event_type: OutboundWebhookEventType;
  /** ISO-8601 UTC timestamp when the event occurred in ChatNow.Zone. */
  occurred_at_utc: string;
  /** CNZ transaction correlation ID — used for idempotency and audit linkage. */
  correlation_id: string;
  /** Reason code for the event — aligns with ledger/risk/consent reason vocabularies. */
  reason_code: string;
  /** Traceability: rule that governs this payload. */
  rule_applied_id: 'OUTBOUND_WEBHOOK_v1';
  /** HMAC-SHA256 signature — partners verify this field on receipt. */
  hmac_signature: string;
}

/** Payload dispatched when a ledger entry is appended (FIZ append-only rule). */
export interface LedgerEntryAppendedPayload extends OutboundWebhookBase {
  event_type: 'LEDGER_ENTRY_APPENDED';
  /** Opaque wallet identifier — no raw account numbers or PII. */
  wallet_id: string;
  /** Intent of the ledger entry. */
  intent: 'PURCHASE' | 'SPEND' | 'EXTENSION' | 'RECOVERY' | 'DIAMOND_QUOTE' | 'PAYOUT';
  /** Amount in platform tokens (non-negative integer). */
  amount_tokens: number;
  /** Bucket drawn from (append-only; no retroactive updates). */
  bucket: 'purchased' | 'membership' | 'bonus';
}

/** Payload dispatched when a user's notification consent record changes. */
export interface ConsentUpdatedPayload extends OutboundWebhookBase {
  event_type: 'CONSENT_UPDATED';
  /** Opaque vault reference for the user — no raw email/phone (PII_REFERENCE_ONLY). */
  pii_vault_ref: string;
  /** New consent state. */
  consent_granted: boolean;
  /** Consent channel that was updated. */
  channel: 'EMAIL' | 'SMS' | 'PUSH';
}

/** Payload dispatched when the Risk Engine emits a decision. */
export interface RiskDecisionEmittedPayload extends OutboundWebhookBase {
  event_type: 'RISK_DECISION_EMITTED';
  /** Risk Engine composite score (0–100). */
  composite_score: number;
  /** Risk tier. */
  tier: 'GREEN' | 'AMBER' | 'RED' | 'CRITICAL';
  /** Risk decision. */
  decision: 'PASS' | 'REVIEW' | 'BLOCK' | 'ESCALATE';
  /** Risk reason codes (non-PII). */
  reason_codes: readonly string[];
}

/** Payload dispatched when a creator payout is completed. */
export interface PayoutCompletedPayload extends OutboundWebhookBase {
  event_type: 'PAYOUT_COMPLETED';
  /** Opaque creator reference — no raw names or banking details (PII_REFERENCE_ONLY). */
  creator_pii_vault_ref: string;
  /** Payout amount in USD cents (integer). Negative = clawback. */
  amount_usd_cents: number;
  /** Payout rate that was locked at transaction time. */
  payout_rate_applied: number;
  /** Rate lock correlation ID (FIZ audit trail). */
  payout_rate_lock_correlation_id: string;
}

/** Union of all outbound webhook payload shapes. */
export type OutboundWebhookPayload =
  | LedgerEntryAppendedPayload
  | ConsentUpdatedPayload
  | RiskDecisionEmittedPayload
  | PayoutCompletedPayload;

/** Dispatch request passed to OutboundWebhookService.dispatch(). */
export interface OutboundWebhookDispatchRequest {
  /** Target partner to notify. */
  partner: OutboundWebhookPartner;
  /** Fully constructed payload (minus hmac_signature — service fills it). */
  payload: Omit<OutboundWebhookPayload, 'hmac_signature'>;
}

/** Result returned after an outbound webhook dispatch attempt. */
export interface OutboundWebhookDispatchResult {
  partner: OutboundWebhookPartner;
  event_type: OutboundWebhookEventType;
  event_id: string;
  correlation_id: string;
  /** HTTP status code returned by the partner endpoint. */
  http_status: number | null;
  success: boolean;
  error_code: string | null;
  dispatched_at_utc: string;
}
