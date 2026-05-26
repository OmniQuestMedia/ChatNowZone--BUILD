// PHASE7-ITEM2: CyranoEngines Webhook Integration
// Handles outbound webhook calls from ChatNowZone to CyranoEngines for AI generation
// All AI processing happens in CyranoEngines, CNZ only manages tokens and earnings

import { randomUUID } from 'crypto';
import { OutboundWebhookService } from '../../integration-hub/comms/outbound-webhook.service';
import type { LedgerEntryAppendedPayload } from '../../integration-hub/comms/outbound-webhook.types';

export interface CyranoWebhookRequest {
  correlationId: string;
  userId: string;
  creatorId: string;
  requestType: 'IMAGE_GENERATION' | 'VOICE_TTS' | 'GROUP_CHAT_AI';
  prompt?: string;
  inputTranscript?: string;
  organizationId: string;
  tenantId: string;
}

export interface CyranoWebhookResponse {
  correlationId: string;
  status: 'ACCEPTED' | 'REJECTED' | 'ERROR';
  generationId?: string;
  errorMessage?: string;
}

/**
 * PHASE7-ITEM2: Service to call CyranoEngines via webhook for AI generation
 *
 * This service ensures:
 * - All AI calls use correlation_id for tracing
 * - StudioTokens charging handled on CNZ side before webhook call
 * - Creator revenue sharing calculated and recorded in CNZ ledger
 * - Actual AI processing delegated to CyranoEngines
 */
export class CyranoWebhookService {
  private readonly webhookService: OutboundWebhookService;
  private readonly cyranoEndpoint: string;

  constructor() {
    this.webhookService = new OutboundWebhookService();
    // PHASE7: CyranoEngines endpoint injected from env
    // In production: set CYRANO_ENGINES_WEBHOOK_URL in AWS Secrets Manager
    this.cyranoEndpoint =
      process.env.CYRANO_ENGINES_WEBHOOK_URL || 'https://cyranoengines.example.com/api/v1/generate';
  }

  /**
   * PHASE7-ITEM2: Request AI generation from CyranoEngines
   *
   * Flow:
   * 1. CNZ has already deducted tokens and credited creator earnings
   * 2. This webhook notifies CyranoEngines to perform actual AI generation
   * 3. CyranoEngines will callback CNZ when generation completes
   * 4. CNZ updates generation status with result URI
   */
  async requestGeneration(request: CyranoWebhookRequest): Promise<CyranoWebhookResponse> {
    const payload = {
      correlation_id: request.correlationId,
      user_id: request.userId,
      creator_id: request.creatorId,
      request_type: request.requestType,
      prompt: request.prompt,
      input_transcript: request.inputTranscript,
      organization_id: request.organizationId,
      tenant_id: request.tenantId,
      // Metadata for CyranoEngines to callback CNZ
      callback_url: process.env.CNZ_CALLBACK_URL || 'https://chatnow.zone/api/cyrano/callback',
      rule_applied_id: 'CYRANO_WEBHOOK_v1',
    };

    try {
      // Get signing secret from env (should be in AWS Secrets Manager)
      const signingSecret =
        process.env.CYRANO_WEBHOOK_SIGNING_SECRET || 'dev-secret-change-in-prod';

      // Compute HMAC signature for request
      const webhookPayload: Omit<LedgerEntryAppendedPayload, 'hmac_signature'> = {
        event_type: 'LEDGER_ENTRY_APPENDED', // Reuse existing type for now
        event_id: randomUUID(),
        occurred_at_utc: new Date().toISOString(),
        correlation_id: request.correlationId,
        reason_code: 'AI_GENERATION_REQUEST',
        rule_applied_id: 'OUTBOUND_WEBHOOK_v1',
        wallet_id: request.userId,
        intent: 'SPEND',
        amount_tokens: 0,
        bucket: 'purchased',
      };
      const signature = this.webhookService.computeSignature(webhookPayload, signingSecret);

      // Call CyranoEngines webhook
      const response = await fetch(this.cyranoEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CNZ-Signature': signature,
          'X-CNZ-Correlation-Id': request.correlationId,
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(10_000), // 10s timeout
      });

      if (!response.ok) {
        return {
          correlationId: request.correlationId,
          status: 'ERROR',
          errorMessage: `CyranoEngines returned HTTP ${response.status}`,
        };
      }

      const result = (await response.json()) as {
        generation_id?: string;
        status: string;
      };

      return {
        correlationId: request.correlationId,
        status: result.status === 'accepted' ? 'ACCEPTED' : 'REJECTED',
        generationId: result.generation_id,
      };
    } catch (error) {
      return {
        correlationId: request.correlationId,
        status: 'ERROR',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * PHASE7-ITEM2: Verify incoming webhook callback from CyranoEngines
   *
   * When CyranoEngines completes generation, it calls back to CNZ with:
   * - correlation_id (to match the original request)
   * - generation_id
   * - result_uri (S3 path to generated content)
   * - status (COMPLETED | FAILED)
   */
  verifyCallback(_signature: string, _payload: unknown, _signingSecret: string): boolean {
    // TODO: Implement signature verification
    // For now, accept all callbacks in dev
    return true;
  }
}

export const cyranoWebhookService = new CyranoWebhookService();
