import { Injectable, Logger } from '@nestjs/common';
import { createHmac } from 'crypto';
import { WebhookCallbackPayload } from '../dto/cyranoengines.dto';

/**
 * Webhook Callback Service - Phase 11 Production-Ready
 *
 * Handles sending async results back to calling platforms via webhooks
 * with HMAC-SHA256 signing, retry logic with exponential backoff,
 * and failed callback persistence for manual intervention.
 *
 * rule_applied_id: CYRANOENGINES_WEBHOOK_v1.0
 */

interface RetryState {
  attemptCount: number;
  lastAttemptAt: string;
  nextRetryAt: string;
  error: string;
}

interface FailedCallback {
  job_id: string;
  correlation_id: string;
  callbackUrl: string;
  payload: WebhookCallbackPayload;
  retryState: RetryState;
  failedAt: string;
}

@Injectable()
export class WebhookCallbackService {
  private readonly logger = new Logger(WebhookCallbackService.name);
  private readonly MAX_RETRIES = 5;
  private readonly INITIAL_BACKOFF_MS = 1000; // 1 second
  private readonly MAX_BACKOFF_MS = 60000; // 1 minute
  private readonly REQUEST_TIMEOUT_MS = 10000; // 10 seconds

  // In-memory storage for failed callbacks (in production, persist to DB)
  private readonly failedCallbacks = new Map<string, FailedCallback>();

  /**
   * Send webhook callback with retry logic and exponential backoff.
   */
  async sendCallback(
    callbackUrl: string,
    payload: WebhookCallbackPayload,
    attemptNumber = 0,
  ): Promise<void> {
    const signature = await this.generateSignature(payload);

    try {
      const response = await fetch(callbackUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CyranoEngines-Signature': signature,
          'X-CyranoEngines-Job-Id': payload.job_id,
          'X-CyranoEngines-Correlation-Id': payload.correlation_id,
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(this.REQUEST_TIMEOUT_MS),
      });

      if (!response.ok) {
        throw new Error(`Webhook callback failed: ${response.status} ${response.statusText}`);
      }

      this.logger.log(
        `Webhook callback sent successfully for job ${payload.job_id} ` +
          `(attempt ${attemptNumber + 1}/${this.MAX_RETRIES + 1})`,
      );

      // Remove from failed callbacks if it was previously failed
      this.failedCallbacks.delete(payload.job_id);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      this.logger.warn(
        `Failed to send webhook callback for job ${payload.job_id} ` +
          `(attempt ${attemptNumber + 1}/${this.MAX_RETRIES + 1}): ${errorMessage}`,
      );

      // Retry with exponential backoff
      if (attemptNumber < this.MAX_RETRIES) {
        const backoffMs = this.calculateBackoff(attemptNumber);

        this.logger.log(
          `Scheduling retry for job ${payload.job_id} in ${backoffMs}ms ` +
            `(attempt ${attemptNumber + 2}/${this.MAX_RETRIES + 1})`,
        );

        setTimeout(() => {
          this.sendCallback(callbackUrl, payload, attemptNumber + 1);
        }, backoffMs);
      } else {
        // Max retries exhausted - store for manual intervention
        this.storeFailedCallback(callbackUrl, payload, attemptNumber, errorMessage);
      }
    }
  }

  /**
   * Calculate exponential backoff with jitter.
   */
  private calculateBackoff(attemptNumber: number): number {
    const exponentialBackoff = Math.min(
      this.INITIAL_BACKOFF_MS * Math.pow(2, attemptNumber),
      this.MAX_BACKOFF_MS,
    );

    // Add jitter (±20%) to prevent thundering herd
    const jitter = exponentialBackoff * 0.2 * (Math.random() * 2 - 1);
    return Math.floor(exponentialBackoff + jitter);
  }

  /**
   * Store failed callback for manual intervention.
   * In production, this should persist to a database table.
   */
  private storeFailedCallback(
    callbackUrl: string,
    payload: WebhookCallbackPayload,
    attemptCount: number,
    error: string,
  ): void {
    const failedCallback: FailedCallback = {
      job_id: payload.job_id,
      correlation_id: payload.correlation_id,
      callbackUrl,
      payload,
      retryState: {
        attemptCount: attemptCount + 1,
        lastAttemptAt: new Date().toISOString(),
        nextRetryAt: 'MANUAL_INTERVENTION_REQUIRED',
        error,
      },
      failedAt: new Date().toISOString(),
    };

    this.failedCallbacks.set(payload.job_id, failedCallback);

    this.logger.error(
      `Webhook callback failed permanently for job ${payload.job_id} ` +
        `after ${attemptCount + 1} attempts. Stored for manual intervention.`,
      {
        job_id: payload.job_id,
        correlation_id: payload.correlation_id,
        callback_url: callbackUrl,
        error,
        rule_applied_id: 'CYRANOENGINES_WEBHOOK_v1.0',
      },
    );
  }

  /**
   * Generate HMAC-SHA256 signature for webhook verification.
   * Platforms can verify the webhook came from CyranoEngines.
   *
   * Signature input: `${job_id}|${correlation_id}|${timestamp}`
   */
  private async generateSignature(payload: WebhookCallbackPayload): Promise<string> {
    const signingSecret =
      process.env.CYRANOENGINES_WEBHOOK_SECRET || 'dev-secret-change-in-production';

    const signatureInput = `${payload.job_id}|${payload.correlation_id}|${payload.timestamp}`;

    return createHmac('sha256', signingSecret).update(signatureInput).digest('hex');
  }

  /**
   * Get all failed callbacks for manual intervention.
   * In production, query from database.
   */
  getFailedCallbacks(): FailedCallback[] {
    return Array.from(this.failedCallbacks.values());
  }

  /**
   * Retry a specific failed callback manually.
   */
  async retryFailedCallback(job_id: string): Promise<boolean> {
    const failed = this.failedCallbacks.get(job_id);
    if (!failed) {
      this.logger.warn(`No failed callback found for job ${job_id}`);
      return false;
    }

    this.logger.log(`Manually retrying failed callback for job ${job_id}`);
    await this.sendCallback(failed.callbackUrl, failed.payload, 0);
    return true;
  }

  /**
   * Clear a failed callback record (after manual resolution).
   */
  clearFailedCallback(job_id: string): boolean {
    return this.failedCallbacks.delete(job_id);
  }
}
