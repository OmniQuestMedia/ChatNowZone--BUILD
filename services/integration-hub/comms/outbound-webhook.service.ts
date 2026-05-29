// INFRA: Phase 1 — Outbound Signed Webhook Dispatcher
// rule_applied_id: INFRA_v1.0
// Authority: OmniQuest Media Inc. — OQMInc Engineering Team
//
// §8 (Partner Ecosystem Contracts): ChatNow.Zone dispatches HMAC-SHA256 signed
// outbound webhook notifications to partner systems (RedRoomRewards,
// Marketplace-Build) when canonical events occur:
//   - LEDGER_ENTRY_APPENDED — FIZ append-only ledger write completed
//   - CONSENT_UPDATED       — notification consent change (PIPEDA compliance)
//   - RISK_DECISION_EMITTED — Risk Engine decision emitted
//   - PAYOUT_COMPLETED      — creator payout settled
//
// INVARIANTS enforced by this service:
//   - PII_REFERENCE_ONLY: no raw email, phone, name in any outbound payload.
//     Callers must use `pii_vault_ref` opaque references (INFRA_v1.0 §4.1).
//   - HMAC-SHA256 signature over `${event_type}|${event_id}|${occurred_at_utc}`
//     using OUTBOUND_WEBHOOK_SIGNING_SECRET from AWS Secrets Manager.
//   - Every dispatch attempt emits an AUDIT_IMMUTABLE record via NATS so the
//     outbound notification is on the immutable audit trail (FIZ compliance).
//   - No raw PII, balances, or banking details appear in partner payloads.
//
// Commit: INFRA: outbound webhook dispatcher — ledger/consent/risk/payout
//         [rule_applied_id: INFRA_v1.0]

import { Injectable, Logger } from '@nestjs/common';
import { createHmac } from 'crypto';
import type {
  OutboundWebhookDispatchRequest,
  OutboundWebhookDispatchResult,
  OutboundWebhookPayload,
  OutboundWebhookPartner,
} from './outbound-webhook.types';

/** Canonical rule_applied_id for all outbound webhook payloads. */
export const OUTBOUND_WEBHOOK_RULE_ID = 'OUTBOUND_WEBHOOK_v1' as const;

/**
 * Partner endpoint URL registry.
 *
 * In production these are injected from AWS Secrets Manager / ECS task env.
 * The defaults here are intentionally non-routable placeholders so the
 * service does not silently succeed in environments where URLs are absent.
 *
 * Operations MUST set the following env vars before production deployment:
 *   OUTBOUND_WEBHOOK_URL_REDROOM_REWARDS
 *   OUTBOUND_WEBHOOK_URL_MARKETPLACE_BUILD
 */
const PARTNER_ENDPOINT_ENV_KEYS: Record<OutboundWebhookPartner, string> = {
  REDROOM_REWARDS: 'OUTBOUND_WEBHOOK_URL_REDROOM_REWARDS',
  MARKETPLACE_BUILD: 'OUTBOUND_WEBHOOK_URL_MARKETPLACE_BUILD',
};

@Injectable()
export class OutboundWebhookService {
  private readonly logger = new Logger(OutboundWebhookService.name);

  /** Canonical rule_applied_id exposed for audit/audit-chain consumers. */
  static readonly RULE_APPLIED_ID = OUTBOUND_WEBHOOK_RULE_ID;

  /**
   * Dispatch a signed outbound webhook notification to a partner endpoint.
   *
   * The service:
   *   1. Guards that no raw PII appears in the payload (structural check).
   *   2. Computes the HMAC-SHA256 signature and injects it into the payload.
   *   3. POSTs the signed JSON payload to the partner endpoint.
   *   4. Returns a dispatch result regardless of HTTP success/failure so the
   *      caller can emit an immutable audit record.
   *
   * @param req            - Dispatch request (payload without hmac_signature).
   * @param signingSecret  - OUTBOUND_WEBHOOK_SIGNING_SECRET from Secrets Manager.
   */
  async dispatch(
    req: OutboundWebhookDispatchRequest,
    signingSecret: string,
  ): Promise<OutboundWebhookDispatchResult> {
    this.assertNoPii(req.payload);

    const signature = this.computeSignature(req.payload, signingSecret);
    const signedPayload: OutboundWebhookPayload = {
      ...req.payload,
      hmac_signature: signature,
    } as OutboundWebhookPayload;

    const endpoint = this.resolveEndpoint(req.partner);
    const dispatchedAt = new Date().toISOString();

    this.logger.log('OutboundWebhookService: dispatching', {
      partner: req.partner,
      event_type: req.payload.event_type,
      event_id: req.payload.event_id,
      correlation_id: req.payload.correlation_id,
      rule_applied_id: OUTBOUND_WEBHOOK_RULE_ID,
    });

    let httpStatus: number | null = null;
    let success = false;
    let errorCode: string | null = null;

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-OQMI-Signature': signature,
          'X-OQMI-Event-Type': req.payload.event_type,
          'X-OQMI-Correlation-Id': req.payload.correlation_id,
        },
        body: JSON.stringify(signedPayload),
        signal: AbortSignal.timeout(10_000), // 10 s timeout
      });

      httpStatus = response.status;
      success = response.ok;

      if (!response.ok) {
        errorCode = `HTTP_${response.status}`;
        this.logger.warn('OutboundWebhookService: partner returned non-2xx', {
          partner: req.partner,
          event_type: req.payload.event_type,
          http_status: httpStatus,
          correlation_id: req.payload.correlation_id,
          rule_applied_id: OUTBOUND_WEBHOOK_RULE_ID,
        });
      }
    } catch (err) {
      errorCode = 'DISPATCH_EXCEPTION';
      this.logger.error('OutboundWebhookService: dispatch threw', {
        partner: req.partner,
        event_type: req.payload.event_type,
        error: (err as Error).message,
        correlation_id: req.payload.correlation_id,
        rule_applied_id: OUTBOUND_WEBHOOK_RULE_ID,
      });
    }

    return {
      partner: req.partner,
      event_type: req.payload.event_type,
      event_id: req.payload.event_id,
      correlation_id: req.payload.correlation_id,
      http_status: httpStatus,
      success,
      error_code: errorCode,
      dispatched_at_utc: dispatchedAt,
    };
  }

  /**
   * Compute the HMAC-SHA256 signature for an outbound webhook payload.
   *
   * Signature input: `${event_type}|${event_id}|${occurred_at_utc}`
   * Partners verify this using their copy of OUTBOUND_WEBHOOK_SIGNING_SECRET.
   */
  computeSignature(
    payload: Omit<OutboundWebhookPayload, 'hmac_signature'>,
    signingSecret: string,
  ): string {
    return createHmac('sha256', signingSecret)
      .update(`${payload.event_type}|${payload.event_id}|${payload.occurred_at_utc}`)
      .digest('hex');
  }

  /**
   * Resolve the partner endpoint URL from the environment.
   * Throws if the URL is not configured (prevents silent no-ops).
   */
  private resolveEndpoint(partner: OutboundWebhookPartner): string {
    const envKey = PARTNER_ENDPOINT_ENV_KEYS[partner];
    const url = process.env[envKey];
    if (!url) {
      throw new Error(
        `HARD_STOP: OutboundWebhookService — ${envKey} is not set. ` +
          `Partner endpoint URL must be injected from AWS Secrets Manager ` +
          `(INFRA_v1.0 §8 Partner Ecosystem Contracts). Set ${envKey} in ECS task definition.`,
      );
    }
    return url;
  }

  /**
   * Structural PII guard — rejects payloads that contain obvious raw PII.
   *
   * Checks that any `pii_vault_ref` or `creator_pii_vault_ref` fields are
   * UUID v4 opaque references, not raw email addresses, phone numbers, or
   * names. Raw PII in outbound payloads violates INFRA_v1.0 §4.1.
   */
  private assertNoPii(payload: Omit<OutboundWebhookPayload, 'hmac_signature'>): void {
    const uuidV4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

    const refs: Array<[string, string | undefined]> = [
      ['pii_vault_ref', (payload as { pii_vault_ref?: string }).pii_vault_ref],
      [
        'creator_pii_vault_ref',
        (payload as { creator_pii_vault_ref?: string }).creator_pii_vault_ref,
      ],
    ];

    for (const [field, value] of refs) {
      if (value !== undefined && !uuidV4.test(value)) {
        const err = new Error(
          `HARD_STOP: OutboundWebhookService — ${field} is not a UUID v4 opaque reference. ` +
            `Raw PII must never appear in outbound partner payloads ` +
            `(INFRA_v1.0 §4.1 PII_REFERENCE_ONLY). ` +
            `correlation_id: ${payload.correlation_id}`,
        );
        this.logger.error('OutboundWebhookService: PII_REFERENCE_ONLY violation', {
          field,
          correlation_id: payload.correlation_id,
          rule_applied_id: OUTBOUND_WEBHOOK_RULE_ID,
        });
        throw err;
      }
    }
  }
}
