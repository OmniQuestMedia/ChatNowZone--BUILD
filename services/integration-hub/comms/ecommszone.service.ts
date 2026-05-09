// INFRA: Phase 1 — eCommsZone Comms Service
// rule_applied_id: INFRA_v1.0
// Authority: OmniQuest Media Inc. — Kevin B. Hartley, CEO
//
// §8.1 — ALL outbound communications (email, SMS, push) MUST route through
// eCommsZone. No direct SMTP/SNS/SendGrid calls are permitted. This service
// is the single mandatory gateway for all outbound comms.
//
// PII_REFERENCE_ONLY invariant: this service NEVER accepts raw PII.
// Only `pii_vault_ref` + `template_id` + non-PII template_vars are forwarded
// to eCommsZone (INFRA_v1.0 §4.1).
//
// Commit: INFRA: eCommsZone comms service — mandatory routing [rule_applied_id: INFRA_v1.0]

import { Injectable, Logger, Inject } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'crypto';
import type {
  IECommsZoneClient,
  ECommsDispatchRequest,
  ECommsDispatchResult,
  ECommsWebhookEvent,
} from '../src/ecommszone/ecommszone-client.interface';
import { ECOMMSZONE_CLIENT } from './ecommszone.tokens';

/** Delivery event recorded after every dispatch attempt (non-PII). */
export interface CommsDispatchRecord {
  correlation_id: string;
  reason_code: string;
  intent: ECommsDispatchRequest['intent'];
  template_id: string;
  pii_vault_ref: string; // opaque reference — no raw PII
  dispatched_at_utc: string;
  success: boolean;
  ecomms_message_id: string | null;
  error_code: string | null;
}

@Injectable()
export class ECommsZoneService {
  private readonly logger = new Logger(ECommsZoneService.name);

  /** Canonical rule_applied_id — surfaces in every audit record. */
  static readonly RULE_APPLIED_ID = 'ECOMMSZONE_COMMS_v1';

  constructor(
    @Inject(ECOMMSZONE_CLIENT)
    private readonly client: IECommsZoneClient,
  ) {}

  /**
   * Dispatch a single outbound message through eCommsZone.
   *
   * MANDATORY ROUTING: This is the ONLY path by which ChatNow.Zone may send
   * outbound email, SMS, or push notifications. No service may call a
   * communications provider directly (INFRA_v1.0 §8.1).
   *
   * PII invariant: `req.pii_vault_ref` must be an opaque vault reference —
   * never a raw email, phone number, or name. Callers that violate this
   * produce a HARD_STOP security incident.
   *
   * @param req - Dispatch request; `pii_vault_ref` is mandatory and must
   *              never contain raw PII (INFRA_v1.0 §4.1 PII_REFERENCE_ONLY).
   */
  async dispatch(req: ECommsDispatchRequest): Promise<CommsDispatchRecord> {
    // Guard: raw PII check (structural — catches obvious violations)
    this.assertNoPii(req);

    this.logger.log('ECommsZoneService: dispatching', {
      correlation_id: req.correlation_id,
      intent: req.intent,
      template_id: req.template_id,
      rule_applied_id: ECommsZoneService.RULE_APPLIED_ID,
    });

    let result: ECommsDispatchResult;
    try {
      result = await this.client.dispatch(req);
    } catch (err) {
      this.logger.error('ECommsZoneService: dispatch threw', {
        correlation_id: req.correlation_id,
        error: (err as Error).message,
        rule_applied_id: ECommsZoneService.RULE_APPLIED_ID,
      });
      result = {
        success: false,
        ecomms_message_id: null,
        error_code: 'DISPATCH_EXCEPTION',
        correlation_id: req.correlation_id,
      };
    }

    const record: CommsDispatchRecord = {
      correlation_id: req.correlation_id,
      reason_code: req.reason_code,
      intent: req.intent,
      template_id: req.template_id,
      pii_vault_ref: req.pii_vault_ref,
      dispatched_at_utc: req.dispatched_at_utc,
      success: result.success,
      ecomms_message_id: result.ecomms_message_id,
      error_code: result.error_code,
    };

    if (!result.success) {
      this.logger.warn('ECommsZoneService: dispatch failed', {
        correlation_id: req.correlation_id,
        error_code: result.error_code,
        rule_applied_id: ECommsZoneService.RULE_APPLIED_ID,
      });
    }

    return record;
  }

  /**
   * Verify the HMAC-SHA256 signature on an inbound webhook delivery event.
   *
   * eCommsZone signs every delivery status webhook as:
   *   HMAC-SHA256(`${ecomms_message_id}|${occurred_at_utc}`, WEBHOOK_SIGNING_SECRET)
   *
   * This method uses `timingSafeEqual` to prevent timing-oracle attacks
   * (INFRA_v1.0 §12: "All inbound webhooks must verify HMAC signatures").
   *
   * @param event       - Inbound webhook event from eCommsZone.
   * @param signingSecret - `WEBHOOK_SIGNING_SECRET` injected from Secrets Manager.
   */
  verifyWebhookSignature(event: ECommsWebhookEvent, signingSecret: string): boolean {
    const expected = createHmac('sha256', signingSecret)
      .update(`${event.ecomms_message_id}|${event.occurred_at_utc}`)
      .digest('hex');

    // Constant-time comparison — no timing oracle
    try {
      return timingSafeEqual(Buffer.from(event.hmac_signature, 'hex'), Buffer.from(expected, 'hex'));
    } catch {
      // Buffers of different lengths → invalid signature
      return false;
    }
  }

  /**
   * Process an inbound eCommsZone delivery status webhook.
   * Verifies the HMAC signature before doing anything else.
   * Returns the parsed event on success; throws on invalid signature.
   */
  processWebhookEvent(
    event: ECommsWebhookEvent,
    signingSecret: string,
  ): { verified: true; event: ECommsWebhookEvent } {
    if (!this.verifyWebhookSignature(event, signingSecret)) {
      this.logger.error('ECommsZoneService: invalid webhook signature', {
        ecomms_message_id: event.ecomms_message_id,
        rule_applied_id: ECommsZoneService.RULE_APPLIED_ID,
      });
      throw new Error('INVALID_WEBHOOK_SIGNATURE');
    }

    this.logger.log('ECommsZoneService: webhook verified', {
      event_type: event.event,
      ecomms_message_id: event.ecomms_message_id,
      rule_applied_id: ECommsZoneService.RULE_APPLIED_ID,
    });

    return { verified: true, event };
  }

  /**
   * Structural PII guard — rejects obviously-invalid pii_vault_ref values.
   * A valid vault ref is a UUID v4 (36-char hyphenated form).
   *
   * Callers that pass raw email addresses, phone numbers, or names will be
   * caught here during development/staging and surfaced as a HARD_STOP error.
   */
  private assertNoPii(req: ECommsDispatchRequest): void {
    const ref = req.pii_vault_ref ?? '';
    // Valid vault ref is UUID v4: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
    const uuidV4Pattern =
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

    if (!uuidV4Pattern.test(ref)) {
      const err = new Error(
        `HARD_STOP: ECommsZoneService.dispatch() received a non-UUID pii_vault_ref. ` +
          `Raw PII must never be sent to eCommsZone (INFRA_v1.0 §4.1 PII_REFERENCE_ONLY). ` +
          `correlation_id: ${req.correlation_id}`,
      );
      this.logger.error('ECommsZoneService: PII_REFERENCE_ONLY violation', {
        correlation_id: req.correlation_id,
        rule_applied_id: ECommsZoneService.RULE_APPLIED_ID,
      });
      throw err;
    }
  }
}
