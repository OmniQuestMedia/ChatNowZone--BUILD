import { Module } from '@nestjs/common';
import { CyranoEnginesController } from './cyranoengines.controller';
import { SyntheticTwinService } from './services/synthetic-twin.service';
import { VideoGenerationService } from './services/video-generation.service';
import { VoiceGenerationService } from './services/voice-generation.service';
import { MemoryService } from './services/memory.service';
import { WebhookCallbackService } from './services/webhook-callback.service';
import { HealthController } from './health.controller';

/**
 * CyranoEngines API Module
 *
 * This module provides webhook-based API access to AI engine capabilities
 * for both SynthiMatesAi and ChatNowZone--BUILD platforms.
 *
 * All requests accept correlation_id and return results asynchronously
 * via webhook callback when possible.
 */
@Module({
  controllers: [CyranoEnginesController, HealthController],
  providers: [
    SyntheticTwinService,
    VideoGenerationService,
    VoiceGenerationService,
    MemoryService,
    WebhookCallbackService,
  ],
  exports: [
    SyntheticTwinService,
    VideoGenerationService,
    VoiceGenerationService,
    MemoryService,
  ],
})
export class CyranoEnginesApiModule {}
