// services/core-api/src/admin-moderation/admin-moderation.module.ts
// PHASE3-ITEM4: NestJS module for admin moderation feature

import { Module } from '@nestjs/common';
import { AdminModerationController } from './admin-moderation.controller';

@Module({
  controllers: [AdminModerationController],
  providers: [],
  exports: [],
})
export class AdminModerationModule {}
