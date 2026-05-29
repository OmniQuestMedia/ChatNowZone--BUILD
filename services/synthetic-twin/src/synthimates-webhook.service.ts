// services/synthetic-twin/src/synthimates-webhook.service.ts
// PHASE5-ITEM1: Synthimate Webhook Handler
//
// Receives and processes webhook callbacks from Synthimate when generation jobs complete.
// Updates CNZ database with results and ensures proper revenue tracking.

import { PrismaClient } from '@prisma/client';
import type { SynthiMatesWebhookPayload, SynthiMatesAiClient } from './synthimates-api-client';

const prisma = new PrismaClient();

export interface WebhookProcessResult {
  success: boolean;
  correlationId: string;
  generationId?: string;
  errorMessage?: string;
}

/**
 * SynthiMates Webhook Service
 *
 * Handles incoming webhook callbacks from Synthimate platform.
 * Updates generation records with results and triggers necessary follow-up actions.
 */
export class SynthiMatesWebhookService {
  constructor(private readonly apiClient: SynthiMatesAiClient) {}

  /**
   * Process incoming webhook from Synthimate
   *
   * Flow:
   * 1. Verify HMAC signature to ensure authenticity
   * 2. Look up CNZ generation record by correlation ID
   * 3. Update record with result URL or error message
   * 4. Update status to COMPLETED or FAILED
   * 5. Emit NATS event for real-time UI updates (optional)
   *
   * @param payload Webhook payload from Synthimate
   * @returns Process result with success status
   */
  async processWebhook(payload: SynthiMatesWebhookPayload): Promise<WebhookProcessResult> {
    // Step 1: Verify signature
    const signatureValid = this.apiClient.verifyWebhookSignature(payload);
    if (!signatureValid) {
      return {
        success: false,
        correlationId: payload.correlationId,
        errorMessage: 'Invalid webhook signature - possible forgery attempt',
      };
    }

    try {
      // Step 2: Find generation record by correlation ID
      const generation = await prisma.syntheticTwinGeneration.findUnique({
        where: { correlation_id: payload.correlationId },
        select: {
          id: true,
          status: true,
          user_id: true,
          creator_id: true,
        },
      });

      if (!generation) {
        return {
          success: false,
          correlationId: payload.correlationId,
          errorMessage: `Generation not found for correlation ID: ${payload.correlationId}`,
        };
      }

      // Step 3: Update generation record based on webhook status
      if (payload.status === 'completed' && payload.resultUrl) {
        await prisma.syntheticTwinGeneration.update({
          where: { id: generation.id },
          data: {
            status: 'COMPLETED',
            image_uri: payload.resultUrl,
            updated_at: new Date(),
          },
        });

        // TODO: Emit NATS event for real-time UI notification
        // this.natsService.publish(NATS_TOPICS.SYNTHETIC_TWIN_GENERATION_COMPLETED, {
        //   correlation_id: payload.correlationId,
        //   user_id: generation.user_id,
        //   creator_id: generation.creator_id,
        //   image_uri: payload.resultUrl,
        // });

        return {
          success: true,
          correlationId: payload.correlationId,
          generationId: generation.id,
        };
      } else {
        // Generation failed on Synthimate side
        await prisma.syntheticTwinGeneration.update({
          where: { id: generation.id },
          data: {
            status: 'FAILED',
            error_message: payload.errorMessage || 'Generation failed on SynthiMatesAi',
            updated_at: new Date(),
          },
        });

        return {
          success: true, // Webhook was processed successfully even though generation failed
          correlationId: payload.correlationId,
          generationId: generation.id,
          errorMessage: payload.errorMessage,
        };
      }
    } catch (error) {
      return {
        success: false,
        correlationId: payload.correlationId,
        errorMessage: error instanceof Error ? error.message : 'Unknown processing error',
      };
    }
  }

  /**
   * Get generation status by correlation ID
   *
   * Allows polling for generation status before webhook arrives.
   * Useful for debugging and health checks.
   *
   * @param correlationId CNZ correlation ID
   * @returns Generation record or null if not found
   */
  async getGenerationStatus(correlationId: string): Promise<{
    id: string;
    status: string;
    imageUri?: string;
    errorMessage?: string;
  } | null> {
    const generation = await prisma.syntheticTwinGeneration.findUnique({
      where: { correlation_id: correlationId },
      select: {
        id: true,
        status: true,
        image_uri: true,
        error_message: true,
      },
    });

    if (!generation) {
      return null;
    }

    return {
      id: generation.id,
      status: generation.status,
      imageUri: generation.image_uri || undefined,
      errorMessage: generation.error_message || undefined,
    };
  }
}

export const synthiMatesWebhookService = new SynthiMatesWebhookService(
  // NOTE: In production, inject properly configured client
  // For now, using a stub to satisfy TypeScript
  {} as SynthiMatesAiClient,
);
