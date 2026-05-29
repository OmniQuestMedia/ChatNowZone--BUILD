// INFRA: Phase 1 — eCommsZone Inbound Webhook Controller
// rule_applied_id: INFRA_v1.0
// Authority: OmniQuest Media Inc. — OQMInc Engineering Team
//
// §12: "All inbound webhooks must verify HMAC signatures"
// This controller receives delivery status events from eCommsZone and
// verifies their HMAC-SHA256 signature before any processing.
//
// Endpoint: POST /comms/ecommszone/webhook
//
// Commit: INFRA: eCommsZone webhook controller [rule_applied_id: INFRA_v1.0]

import {
  Controller,
  Post,
  Body,
  Headers,
  HttpCode,
  HttpStatus,
  Logger,
  Inject,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { ECommsZoneService } from './ecommszone.service';
import { ECOMMSZONE_WEBHOOK_SECRET } from './ecommszone.tokens';
import type { ECommsWebhookEvent } from '../src/ecommszone/ecommszone-client.interface';

@Controller('comms/ecommszone')
export class ECommsZoneWebhookController {
  private readonly logger = new Logger(ECommsZoneWebhookController.name);

  constructor(
    private readonly ecommsService: ECommsZoneService,
    @Inject(ECOMMSZONE_WEBHOOK_SECRET)
    private readonly webhookSigningSecret: string,
  ) {}

  /**
   * Inbound delivery status webhook from eCommsZone.
   *
   * Per INFRA_v1.0 §12: signature is verified via HMAC-SHA256 before any
   * processing. Returns 200 immediately after signature verification so
   * eCommsZone does not time-out and retry spuriously.
   *
   * Event types: DELIVERED | BOUNCED | COMPLAINED | CLICKED | UNSUBSCRIBED
   */
  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  handleWebhook(
    @Body() body: unknown,
    @Headers('x-ecommszone-signature') signatureHeader: string | undefined,
  ): { received: boolean } {
    // Validate body shape before touching it
    if (!body || typeof body !== 'object') {
      throw new BadRequestException('Invalid webhook payload');
    }

    const event = body as ECommsWebhookEvent;

    // Require the signature header to be present
    if (!signatureHeader) {
      this.logger.warn('ECommsZoneWebhookController: missing x-ecommszone-signature header', {
        ecomms_message_id: event.ecomms_message_id,
        rule_applied_id: ECommsZoneService.RULE_APPLIED_ID,
      });
      throw new UnauthorizedException('Missing webhook signature header');
    }

    // Override hmac_signature with the header value (eCommsZone may send via
    // header only; body field is the canonical location per contract)
    const eventWithSig: ECommsWebhookEvent = {
      ...event,
      hmac_signature: signatureHeader ?? event.hmac_signature,
    };

    try {
      this.ecommsService.processWebhookEvent(eventWithSig, this.webhookSigningSecret);
    } catch (err) {
      if ((err as Error).message === 'INVALID_WEBHOOK_SIGNATURE') {
        throw new UnauthorizedException('Invalid webhook signature');
      }
      throw err;
    }

    return { received: true };
  }
}
