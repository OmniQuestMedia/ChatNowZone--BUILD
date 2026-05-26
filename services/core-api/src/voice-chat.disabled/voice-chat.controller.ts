// services/core-api/src/voice-chat/voice-chat.controller.ts
// PHASE3-ITEM1: REST API controller for voice chat with TTS

import { Controller, Post, Get, Body, Param, Query } from '@nestjs/common';
import { voiceChatService } from '../../../voice-chat/src/voice-chat.service';

/**
 * PHASE3-ITEM1: Voice Chat API Controller
 *
 * Endpoints:
 * - POST /voice-chat/send - Send a voice message
 * - POST /voice-chat/tts/generate - Generate TTS response from synthetic twin
 * - GET /voice-chat/messages/:conversationId - Get conversation messages
 */
@Controller('voice-chat')
export class VoiceChatController {
  /**
   * PHASE3-ITEM1: Send a voice message
   *
   * Request body:
   * {
   *   conversationId: string,
   *   senderId: string,
   *   senderType: 'USER' | 'CREATOR' | 'SYNTHETIC_TWIN',
   *   voiceUri?: string,
   *   transcript?: string,
   *   voiceDurationMs?: number,
   *   ttsVoiceId?: string,
   *   organizationId: string,
   *   tenantId: string
   * }
   */
  @Post('send')
  async sendVoiceMessage(
    @Body()
    body: {
      conversationId: string;
      senderId: string;
      senderType: 'USER' | 'CREATOR' | 'SYNTHETIC_TWIN';
      voiceUri?: string;
      transcript?: string;
      voiceDurationMs?: number;
      ttsVoiceId?: string;
      organizationId: string;
      tenantId: string;
    },
  ) {
    return await voiceChatService.sendVoiceMessage(body);
  }

  /**
   * PHASE3-ITEM1: Generate TTS response from synthetic twin
   *
   * Request body:
   * {
   *   conversationId: string,
   *   syntheticTwinId: string,
   *   textContent: string,
   *   voiceId?: string,
   *   organizationId: string,
   *   tenantId: string
   * }
   */
  @Post('tts/generate')
  async generateTTS(
    @Body()
    body: {
      conversationId: string;
      syntheticTwinId: string;
      textContent: string;
      voiceId?: string;
      organizationId: string;
      tenantId: string;
    },
  ) {
    return await voiceChatService.generateTTSResponse(body);
  }

  /**
   * PHASE3-ITEM1: Get conversation messages
   *
   * Query params:
   * - limit?: number (default 100)
   */
  @Get('messages/:conversationId')
  async getMessages(@Param('conversationId') conversationId: string, @Query('limit') limit?: number) {
    return await voiceChatService.getConversationMessages(conversationId, limit);
  }
}
