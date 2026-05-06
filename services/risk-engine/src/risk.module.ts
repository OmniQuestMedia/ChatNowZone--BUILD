// PAYLOAD 10 — Risk Engine module (D002)
// Wires RegionSignalService + RiskEngineService for downstream consumers.
import { Module } from '@nestjs/common';
import { PrismaService } from '../../core-api/src/prisma.service';
import { NatsModule } from '../../core-api/src/nats/nats.module';
import { RegionSignalService } from './region-signal.service';
import { RiskEngineService } from './risk-engine.service';

@Module({
  imports: [NatsModule],
  providers: [PrismaService, RegionSignalService, RiskEngineService],
  exports: [RegionSignalService, RiskEngineService],
})
export class RiskModule {}
