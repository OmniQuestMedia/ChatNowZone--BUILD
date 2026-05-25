// services/synthetic-twin/src/synthimates-api-client.ts
// PHASE5-ITEM1: SynthiMatesAi API/Webhook Integration Client
//
// This service handles API calls from ChatNowZone to SynthiMatesAi for synthetic twin services.
// Implements resell model where CNZ consumes synthetic twin services via API.
//
// Architecture:
// - CNZ triggers image/video generation via SynthiMatesAi API
// - Passes creator ID and fan context to SynthiMatesAi
// - Receives results (image/video URLs) via webhook callbacks
// - Revenue from services purchased on CNZ is credited to CNZ creators

import { createHmac, timingSafeEqual } from 'crypto';
import { randomUUID } from 'crypto';

/**
 * Configuration for SynthiMatesAi API integration
 * These should be injected from environment variables in production
 */
export interface SynthiMatesAiConfig {
  apiBaseUrl: string; // e.g., 'https://api.synthimatesai.com/v1'
  apiKey: string; // API key for authenticating with SynthiMatesAi
  webhookSecret: string; // Secret for verifying webhook signatures
  timeoutMs: number; // API timeout in milliseconds
}

/**
 * Request to generate AI image via SynthiMatesAi
 */
export interface ImageGenerationRequest {
  correlationId: string; // CNZ correlation ID for tracking
  creatorId: string; // CNZ creator ID
  userId: string; // CNZ fan/user ID
  prompt?: string; // Optional text prompt for generation
  callbackUrl: string; // CNZ webhook URL to receive results
  metadata?: Record<string, unknown>; // Optional metadata
}

/**
 * Response from SynthiMatesAi image generation API
 */
export interface ImageGenerationResponse {
  synthimatesJobId: string; // SynthiMatesAi job ID
  status: 'queued' | 'processing' | 'completed' | 'failed';
  estimatedCompletionMs?: number;
  correlationId: string; // Echo back CNZ correlation ID
}

/**
 * Request to generate AI video via SynthiMatesAi
 */
export interface VideoGenerationRequest {
  correlationId: string;
  creatorId: string;
  userId: string;
  prompt?: string;
  durationSeconds?: number; // Optional video duration
  callbackUrl: string;
  metadata?: Record<string, unknown>;
}

/**
 * Response from SynthiMatesAi video generation API
 */
export interface VideoGenerationResponse {
  synthimatesJobId: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  estimatedCompletionMs?: number;
  correlationId: string;
}

/**
 * Webhook payload from SynthiMatesAi when generation completes
 */
export interface SynthiMatesWebhookPayload {
  jobId: string; // SynthiMatesAi job ID
  correlationId: string; // CNZ correlation ID
  status: 'completed' | 'failed';
  resultUrl?: string; // S3/CDN URL of generated image/video
  contentType: 'image' | 'video';
  errorMessage?: string;
  metadata?: Record<string, unknown>;
  completedAt: string; // ISO 8601 timestamp
  hmacSignature: string; // HMAC-SHA256 signature for verification
}

/**
 * SynthiMatesAi API Client
 *
 * Handles all communication with SynthiMatesAi platform for synthetic twin services.
 * Follows resell model where CNZ is a consumer of SynthiMatesAi services.
 */
export class SynthiMatesAiClient {
  constructor(private readonly config: SynthiMatesAiConfig) {}

  /**
   * Trigger image generation on SynthiMatesAi
   *
   * Flow:
   * 1. POST to SynthiMatesAi /generate/image endpoint
   * 2. Include creator context and fan ID for personalization
   * 3. Provide callback URL for CNZ to receive results
   * 4. SynthiMatesAi returns job ID and queues generation
   * 5. CNZ tracks job ID and awaits webhook callback
   *
   * @param request Image generation parameters
   * @returns Job ID and status from SynthiMatesAi
   */
  async generateImage(request: ImageGenerationRequest): Promise<ImageGenerationResponse> {
    const url = `${this.config.apiBaseUrl}/generate/image`;

    const payload = {
      correlation_id: request.correlationId,
      creator_id: request.creatorId,
      user_id: request.userId,
      prompt: request.prompt,
      callback_url: request.callbackUrl,
      metadata: request.metadata,
    };

    try {
      const response = await this.makeApiRequest<ImageGenerationResponse>(url, payload);
      return response;
    } catch (error) {
      throw new Error(
        `SynthiMatesAi image generation API failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Trigger video generation on SynthiMatesAi
   *
   * Similar to image generation but for video content.
   *
   * @param request Video generation parameters
   * @returns Job ID and status from SynthiMatesAi
   */
  async generateVideo(request: VideoGenerationRequest): Promise<VideoGenerationResponse> {
    const url = `${this.config.apiBaseUrl}/generate/video`;

    const payload = {
      correlation_id: request.correlationId,
      creator_id: request.creatorId,
      user_id: request.userId,
      prompt: request.prompt,
      duration_seconds: request.durationSeconds,
      callback_url: request.callbackUrl,
      metadata: request.metadata,
    };

    try {
      const response = await this.makeApiRequest<VideoGenerationResponse>(url, payload);
      return response;
    } catch (error) {
      throw new Error(
        `SynthiMatesAi video generation API failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Verify webhook signature from SynthiMatesAi
   *
   * Uses HMAC-SHA256 to verify the webhook payload is authentic.
   * Signature is computed as: HMAC-SHA256(`${jobId}|${correlationId}|${completedAt}`, webhookSecret)
   *
   * @param payload Webhook payload from SynthiMatesAi
   * @returns True if signature is valid, false otherwise
   */
  verifyWebhookSignature(payload: SynthiMatesWebhookPayload): boolean {
    const expected = createHmac('sha256', this.config.webhookSecret)
      .update(`${payload.jobId}|${payload.correlationId}|${payload.completedAt}`)
      .digest('hex');

    try {
      // Constant-time comparison to prevent timing attacks
      return timingSafeEqual(
        Buffer.from(payload.hmacSignature, 'hex'),
        Buffer.from(expected, 'hex'),
      );
    } catch {
      // Buffers of different lengths → invalid signature
      return false;
    }
  }

  /**
   * Generic HTTP request helper for SynthiMatesAi API
   */
  private async makeApiRequest<T>(url: string, payload: unknown): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey}`,
          'X-CNZ-Request-ID': randomUUID(),
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        const errorBody = await response.text().catch(() => 'Unknown error');
        throw new Error(`HTTP ${response.status}: ${errorBody}`);
      }

      return (await response.json()) as T;
    } catch (error) {
      clearTimeout(timeout);
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`Request timeout after ${this.config.timeoutMs}ms`);
      }
      throw error;
    }
  }
}

/**
 * Factory function to create SynthiMatesAiClient with configuration
 *
 * Usage:
 *   const client = createSynthiMatesAiClient({
 *     apiBaseUrl: process.env.SYNTHIMATES_API_URL,
 *     apiKey: process.env.SYNTHIMATES_API_KEY,
 *     webhookSecret: process.env.SYNTHIMATES_WEBHOOK_SECRET,
 *     timeoutMs: 30000,
 *   });
 */
export function createSynthiMatesAiClient(config: SynthiMatesAiConfig): SynthiMatesAiClient {
  return new SynthiMatesAiClient(config);
}
