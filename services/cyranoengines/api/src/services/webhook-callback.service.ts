import { Injectable } from '@nestjs/common';
import { WebhookCallbackPayload } from '../dto/cyranoengines.dto';

/**
 * Webhook Callback Service
 *
 * Handles sending async results back to calling platforms via webhooks.
 */
@Injectable()
export class WebhookCallbackService {
  async sendCallback(
    callbackUrl: string,
    payload: WebhookCallbackPayload,
  ): Promise<void> {
    try {
      const response = await fetch(callbackUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CyranoEngines-Signature': await this.generateSignature(payload),
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(
          `Webhook callback failed: ${response.status} ${response.statusText}`,
        );
      }

      console.log(
        `Webhook callback sent successfully for job ${payload.job_id}`,
      );
    } catch (error) {
      console.error(
        `Failed to send webhook callback for job ${payload.job_id}:`,
        error,
      );
      // TODO: Implement retry logic with exponential backoff
      // TODO: Store failed callbacks for manual intervention
    }
  }

  private async generateSignature(_payload: WebhookCallbackPayload): Promise<string> {
    // TODO: Implement HMAC signature generation for webhook verification
    // This ensures calling platforms can verify the webhook came from CyranoEngines
    return 'placeholder-signature';
  }
}
