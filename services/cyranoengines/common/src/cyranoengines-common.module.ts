import { Module } from '@nestjs/common';
import { LearningLoopCaptureService } from './learning-loop-capture.service';
import { StudioTokensChargingService } from './studiotokens-charging.service';
import { GateGuardIntegrationService } from './gateguard-integration.service';

/**
 * CyranoEngines Common Module
 *
 * Provides shared services for all CyranoEngines components:
 * - Learning loop data capture
 * - StudioTokens charging integration
 * - GateGuard safety verification
 * - Shared logging utilities
 */
@Module({
  providers: [LearningLoopCaptureService, StudioTokensChargingService, GateGuardIntegrationService],
  exports: [LearningLoopCaptureService, StudioTokensChargingService, GateGuardIntegrationService],
})
export class CyranoEnginesCommonModule {}
