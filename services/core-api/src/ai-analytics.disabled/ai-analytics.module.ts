// services/core-api/src/ai-analytics/ai-analytics.module.ts
// PHASE3-ITEM3: NestJS module for AI analytics feature

import { Module } from '@nestjs/common';
import { AIAnalyticsController } from './ai-analytics.controller';

@Module({
  controllers: [AIAnalyticsController],
  providers: [],
  exports: [],
})
export class AIAnalyticsModule {}
