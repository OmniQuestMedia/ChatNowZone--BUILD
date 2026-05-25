// PAYLOAD 5 — CreatorControl.Zone module — Phase 11 Enhanced
import { Module } from '@nestjs/common';
import { NatsModule } from '../../core-api/src/nats/nats.module';
import { BroadcastTimingCopilot } from './broadcast-timing.copilot';
import { CreatorControlService } from './creator-control.service';
import { FlickerNFlameScoringEngine } from './ffs.engine';
import { SessionMonitoringCopilot } from './session-monitoring.copilot';
import { OmniSyncTelemetryService } from './omnisync-telemetry.service';
import { SyntheticFeatureToggleService } from './synthetic-feature-toggle.service';

@Module({
  imports: [NatsModule],
  providers: [
    FlickerNFlameScoringEngine,
    BroadcastTimingCopilot,
    SessionMonitoringCopilot,
    CreatorControlService,
    OmniSyncTelemetryService,
    SyntheticFeatureToggleService,
  ],
  exports: [
    FlickerNFlameScoringEngine,
    BroadcastTimingCopilot,
    SessionMonitoringCopilot,
    CreatorControlService,
    OmniSyncTelemetryService,
    SyntheticFeatureToggleService,
  ],
})
export class CreatorControlModule {}
