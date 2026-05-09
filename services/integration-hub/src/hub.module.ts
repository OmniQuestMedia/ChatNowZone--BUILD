// PAYLOAD 5 — Integration Hub module
// INFRA Phase 1 — ECommsModule wired for mandatory eCommsZone routing
// rule_applied_id: INFRA_v1.0
import { Module } from '@nestjs/common';
import { NatsModule } from '../../core-api/src/nats/nats.module';
import { CreatorControlModule } from '../../creator-control/src/creator-control.module';
import { CyranoModule } from '../../cyrano/src/cyrano.module';
import { IntegrationHubService } from './hub.service';
import { ECommsModule } from '../comms/ecommszone.module';

@Module({
  // ECommsModule is mandatory — ALL outbound comms must route through
  // eCommsZone via ECommsZoneService (INFRA_v1.0 §8.1).
  imports: [NatsModule, CreatorControlModule, CyranoModule, ECommsModule],
  providers: [IntegrationHubService],
  exports: [IntegrationHubService, ECommsModule],
})
export class IntegrationHubModule {}
