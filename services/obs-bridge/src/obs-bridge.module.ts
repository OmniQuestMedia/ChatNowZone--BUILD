// OBS: OBS-001 — OBSBridgeModule
// Provides OBSBridgeService, ChatAggregatorService, PersonaEngineService,
// and (Payload 10) AudioSignalService for the heat-escalation gate.
import { Module } from '@nestjs/common';
import { OBSBridgeService } from './obs-bridge.service';
import { ChatAggregatorService } from './chat-aggregator.service';
import { PersonaEngineService } from './persona-engine.service';
import { AudioSignalService } from './audio-signal.service';

@Module({
  providers: [OBSBridgeService, ChatAggregatorService, PersonaEngineService, AudioSignalService],
  exports: [OBSBridgeService, ChatAggregatorService, PersonaEngineService, AudioSignalService],
})
export class OBSBridgeModule {}
