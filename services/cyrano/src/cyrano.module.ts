// PAYLOAD 5+ — Cyrano module
// Phase 1.6 + 3.10 + 3.11 — Layer 1 (whisper copilot) is the production
// surface today; Layer 3 (HCZ consumer) and Layer 4 (enterprise multi-tenant
// API) are scaffolded providers. Layer 2 lives in apps/cyrano-standalone/.
import { Module } from '@nestjs/common';
import { NatsModule } from '../../core-api/src/nats/nats.module';
import { CyranoLayer3HczService } from './cyrano-layer3-hcz.service';
import { CyranoLayer4EnterpriseService } from './cyrano-layer4-enterprise.service';
import { CyranoService } from './cyrano.service';
import { PersonaManager } from './persona.manager';
import { SessionMemoryStore } from './session-memory.store';

@Module({
  imports: [NatsModule],
  providers: [
    SessionMemoryStore,
    PersonaManager,
    CyranoService,
    CyranoLayer3HczService,
    CyranoLayer4EnterpriseService,
  ],
  exports: [
    SessionMemoryStore,
    PersonaManager,
    CyranoService,
    CyranoLayer3HczService,
    CyranoLayer4EnterpriseService,
  ],
})
export class CyranoModule {}
