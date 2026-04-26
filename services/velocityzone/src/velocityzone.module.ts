// services/velocityzone/src/velocityzone.module.ts
// VelocityZone NestJS module registration.

import { Module } from '@nestjs/common';
import { VelocityZoneController } from './velocityzone.controller';
import { VelocityZoneService } from './velocityzone.service';
import { CreatorRateTierService } from './creator-rate-tier.service';

@Module({
  controllers: [VelocityZoneController],
  providers:   [VelocityZoneService, CreatorRateTierService],
  exports:     [VelocityZoneService, CreatorRateTierService],
})
export class VelocityZoneModule {}
