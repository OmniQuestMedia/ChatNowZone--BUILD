import { Controller, Post, Body, Headers, HttpCode, HttpStatus } from '@nestjs/common';
import { SyntheticTwinService } from './services/synthetic-twin.service';
import { VideoGenerationService } from './services/video-generation.service';
import { VoiceGenerationService } from './services/voice-generation.service';
import { MemoryService } from './services/memory.service';
import {
  GenerateSyntheticTwinDto,
  GenerateVideoDto,
  GenerateVoiceDto,
  MemoryQueryDto,
  WebhookResponseDto,
} from './dto/cyranoengines.dto';

/**
 * CyranoEngines Webhook Controller
 *
 * All endpoints accept correlation_id and return results asynchronously
 * via webhook callback to the calling platform.
 */
@Controller('cyranoengines')
export class CyranoEnginesController {
  constructor(
    private readonly syntheticTwinService: SyntheticTwinService,
    private readonly videoService: VideoGenerationService,
    private readonly voiceService: VoiceGenerationService,
    private readonly memoryService: MemoryService,
  ) {}

  /**
   * POST /generate-synthetic-twin
   *
   * Generates a Safe Synthetic Twin image from input parameters.
   * Returns immediately with job_id, results delivered via webhook.
   */
  @Post('generate-synthetic-twin')
  @HttpCode(HttpStatus.ACCEPTED)
  async generateSyntheticTwin(
    @Body() dto: GenerateSyntheticTwinDto,
    @Headers('x-correlation-id') correlationId?: string,
  ): Promise<WebhookResponseDto> {
    return this.syntheticTwinService.generate(dto, correlationId);
  }

  /**
   * POST /generate-video
   *
   * Generates video content via HeyGen or internal video pipeline.
   * Returns immediately with job_id, results delivered via webhook.
   */
  @Post('generate-video')
  @HttpCode(HttpStatus.ACCEPTED)
  async generateVideo(
    @Body() dto: GenerateVideoDto,
    @Headers('x-correlation-id') correlationId?: string,
  ): Promise<WebhookResponseDto> {
    return this.videoService.generate(dto, correlationId);
  }

  /**
   * POST /generate-voice
   *
   * Generates voice/audio content via TTS engine.
   * Returns immediately with job_id, results delivered via webhook.
   */
  @Post('generate-voice')
  @HttpCode(HttpStatus.ACCEPTED)
  async generateVoice(
    @Body() dto: GenerateVoiceDto,
    @Headers('x-correlation-id') correlationId?: string,
  ): Promise<WebhookResponseDto> {
    return this.voiceService.generate(dto, correlationId);
  }

  /**
   * POST /memory/query
   *
   * Queries context memory, RAG system, or summarization engine.
   * Returns immediately with job_id, results delivered via webhook.
   */
  @Post('memory/query')
  @HttpCode(HttpStatus.ACCEPTED)
  async queryMemory(
    @Body() dto: MemoryQueryDto,
    @Headers('x-correlation-id') correlationId?: string,
  ): Promise<WebhookResponseDto> {
    return this.memoryService.query(dto, correlationId);
  }
}
