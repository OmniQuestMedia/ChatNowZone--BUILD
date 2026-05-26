// services/core-api/src/voice-chat/voice-chat.module.ts
// PHASE3-ITEM1: NestJS module for voice chat feature

import { Module } from '@nestjs/common';
import { VoiceChatController } from './voice-chat.controller';

@Module({
  controllers: [VoiceChatController],
  providers: [],
  exports: [],
})
export class VoiceChatModule {}
