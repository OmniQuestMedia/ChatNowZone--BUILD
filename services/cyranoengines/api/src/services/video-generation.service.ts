/* eslint-disable no-console */
import { Injectable } from '@nestjs/common';
import { GenerateVideoDto, WebhookResponseDto } from '../dto/cyranoengines.dto';
import { WebhookCallbackService } from './webhook-callback.service';
import { LearningLoopCaptureService } from '../../../common/src/learning-loop-capture.service';

function uuidv4(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Video Generation Service
 *
 * Handles video generation via HeyGen or future internal video pipeline.
 * Implements async processing with webhook callbacks.
 */
@Injectable()
export class VideoGenerationService {
  constructor(
    private readonly webhookService: WebhookCallbackService,
    private readonly learningLoopService: LearningLoopCaptureService,
  ) {}

  async generate(dto: GenerateVideoDto, correlationId?: string): Promise<WebhookResponseDto> {
    const jobId = uuidv4();
    const finalCorrelationId = correlationId || dto.correlation_id || uuidv4();

    // Capture input for learning loop
    await this.learningLoopService.captureInput({
      job_id: jobId,
      correlation_id: finalCorrelationId,
      service: 'video-generation',
      input_data: {
        prompt: dto.prompt,
        avatar: dto.avatar,
        parameters: dto.parameters,
      },
      platform: dto.platform,
      account_id: dto.account_id,
      timestamp: new Date().toISOString(),
    });

    // Queue async processing
    this.processAsync(dto, jobId, finalCorrelationId).catch((error) => {
      console.error(`Video generation failed for job ${jobId}:`, error);
    });

    return {
      job_id: jobId,
      correlation_id: finalCorrelationId,
      status: 'accepted',
      message: 'Video generation job accepted',
      estimated_completion_seconds: 120,
    };
  }

  private async processAsync(
    dto: GenerateVideoDto,
    jobId: string,
    correlationId: string,
  ): Promise<void> {
    try {
      // TODO: Implement actual HeyGen integration or internal video generation
      // This is a placeholder for the actual implementation
      const result = {
        output_video_url: 'https://placeholder.example.com/generated-video.mp4',
        metadata: {
          duration_seconds: 30,
          resolution: '1920x1080',
          generation_time_ms: 45000,
        },
      };

      // Capture output for learning loop
      await this.learningLoopService.captureOutput({
        job_id: jobId,
        correlation_id: correlationId,
        service: 'video-generation',
        output_data: result,
        success: true,
        timestamp: new Date().toISOString(),
      });

      // Send webhook callback
      await this.webhookService.sendCallback(dto.callback_url, {
        job_id: jobId,
        correlation_id: correlationId,
        status: 'completed',
        result,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      // Capture error for learning loop
      await this.learningLoopService.captureOutput({
        job_id: jobId,
        correlation_id: correlationId,
        service: 'video-generation',
        output_data: null,
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      });

      // Send error webhook callback
      await this.webhookService.sendCallback(dto.callback_url, {
        job_id: jobId,
        correlation_id: correlationId,
        status: 'failed',
        error: {
          code: 'GENERATION_FAILED',
          message: error.message,
        },
        timestamp: new Date().toISOString(),
      });
    }
  }
}
