// PAYLOAD 10 — Risk Engine module (D002)
// Wires RegionSignalService + RiskEngineService for downstream consumers.
//
// PrismaModule is @Global (services/core-api/src/prisma.module.ts) so we do
// not re-provide PrismaService here. Re-providing it would spin up a second
// PrismaClient (extra connection pool) and divorce transaction scoping from
// the rest of the app.
import { Module } from '@nestjs/common';
import { NatsModule } from '../../core-api/src/nats/nats.module';
import { RegionSignalService } from './region-signal.service';
import { RiskEngineService } from './risk-engine.service';

@Module({
  imports: [NatsModule],
  providers: [RegionSignalService, RiskEngineService],
  exports: [RegionSignalService, RiskEngineService],
})
export class RiskModule {}
