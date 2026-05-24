// services/core-api/src/synthetic-twin/synthetic-twin.module.ts
// PHASE2-440: NestJS module for Safe Synthetic Twin

import { Module } from '@nestjs/common';
import { SyntheticTwinController } from './synthetic-twin.controller';

@Module({
  controllers: [SyntheticTwinController],
  providers: [],
  exports: [],
})
export class SyntheticTwinModule {}
