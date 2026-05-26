// services/core-api/src/group-chat/group-chat.module.ts
// PHASE3-ITEM2: NestJS module for group chat feature

import { Module } from '@nestjs/common';
import { GroupChatController } from './group-chat.controller';

@Module({
  controllers: [GroupChatController],
  providers: [],
  exports: [],
})
export class GroupChatModule {}
