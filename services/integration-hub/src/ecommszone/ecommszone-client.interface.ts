// eCommsZone Node.js client interface stub.
//
// eCommsZone is the mandatory outbound-communications partner for ChatNow.Zone
// (email, SMS, push). Per INFRA_v1.0 §8.1, ALL outbound comms route through
// eCommsZone. No raw PII is ever sent — only `pii_vault_ref` + template ID.
//
// When the eCommsZone npm client package is published, replace this stub with
// the real import and wire the concrete class into hub.module.ts. Until then,
// this interface is the authoritative contract and guards type-safety at the
// call-site.
//
// See also:
//   services/integration-hub/WEBHOOK_CONTRACTS.md — inbound webhook contract
//   docs/POLICIES/OQMI_INFRASTRUCTURE_AND_SECURITY_POLICY.md §8.1

/** Outbound message intents supported by eCommsZone. */
export type ECommsIntent =
  | 'TRANSACTIONAL_EMAIL'
  | 'TRANSACTIONAL_SMS'
  | 'MARKETING_EMAIL'
  | 'PUSH_NOTIFICATION'
  | 'WEBHOOK_ECHO';

/** Every dispatch request uses a `pii_vault_ref` — never raw PII. */
export interface ECommsDispatchRequest {
  /** Opaque reference to the PII vault entry for the recipient (no raw PII). */
  pii_vault_ref: string;
  /** eCommsZone template identifier agreed in the partner contract. */
  template_id: string;
  /** Structured merge variables for the template — must NOT include PII. */
  template_vars: Record<string, string | number | boolean>;
  intent: ECommsIntent;
  correlation_id: string;
  reason_code: string;
  /** ISO-8601 UTC timestamp at dispatch construction. */
  dispatched_at_utc: string;
}

export interface ECommsDispatchResult {
  success: boolean;
  ecomms_message_id: string | null;
  error_code: string | null;
  correlation_id: string;
}

/** Inbound webhook event posted by eCommsZone on delivery status change. */
export interface ECommsWebhookEvent {
  event: 'DELIVERED' | 'BOUNCED' | 'COMPLAINED' | 'CLICKED' | 'UNSUBSCRIBED';
  ecomms_message_id: string;
  pii_vault_ref: string;
  template_id: string;
  occurred_at_utc: string;
  /** HMAC-SHA256 signature over `${ecomms_message_id}|${occurred_at_utc}` */
  hmac_signature: string;
}

/**
 * Canonical client interface for eCommsZone.
 *
 * Implementations:
 *   - `ECommsZoneClientImpl` (future — when npm package is published)
 *   - `ECommsZoneClientNoop` (stub for local dev / unit tests)
 */
export interface IECommsZoneClient {
  /**
   * Dispatch a single outbound message through eCommsZone.
   * Caller is responsible for populating `correlation_id` and `reason_code`.
   */
  dispatch(req: ECommsDispatchRequest): Promise<ECommsDispatchResult>;

  /**
   * Verify the HMAC-SHA256 signature on an inbound webhook event.
   * Returns `true` if the signature is valid against `WEBHOOK_SIGNING_SECRET`.
   */
  verifyWebhookSignature(event: ECommsWebhookEvent): boolean;
}

/**
 * No-op stub — satisfies `IECommsZoneClient` for local dev and unit tests.
 * Replace with `ECommsZoneClientImpl` when the partner SDK is available.
 */
export class ECommsZoneClientNoop implements IECommsZoneClient {
  async dispatch(req: ECommsDispatchRequest): Promise<ECommsDispatchResult> {
    return {
      success: true,
      ecomms_message_id: `noop-${req.correlation_id}`,
      error_code: null,
      correlation_id: req.correlation_id,
    };
  }

  verifyWebhookSignature(_event: ECommsWebhookEvent): boolean {
    // Guard: this stub MUST NOT be used in production. Throw loudly so any
    // accidental wiring in a non-dev environment surfaces immediately rather
    // than silently accepting every signature.
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        'ECommsZoneClientNoop.verifyWebhookSignature must not be used in production. ' +
          'Wire ECommsZoneClientImpl instead.',
      );
    }
    // Noop always returns true in test/dev context.
    // Production impl MUST verify HMAC-SHA256 against WEBHOOK_SIGNING_SECRET.
    return true;
  }
}
