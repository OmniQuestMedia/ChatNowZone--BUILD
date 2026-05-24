// services/core-api/src/group-chat/group-chat.controller.ts
// PHASE3-ITEM2: REST API controller for group chat with synthetic twins

import { Controller, Post, Get, Delete, Body, Param, Query } from '@nestjs/common';
import { groupChatService } from '../../../group-chat/src/group-chat.service';

/**
 * PHASE3-ITEM2: Group Chat API Controller
 *
 * Endpoints:
 * - POST /group-chat/create - Create a new group chat
 * - POST /group-chat/:conversationId/participants - Add participant
 * - DELETE /group-chat/:conversationId/participants/:participantId - Remove participant
 * - POST /group-chat/:conversationId/messages - Send message
 * - GET /group-chat/:conversationId - Get group chat details
 * - GET /group-chat/user/:userId - List user's group chats
 */
@Controller('group-chat')
export class GroupChatController {
  /**
   * PHASE3-ITEM2: Create a new group chat
   *
   * Request body:
   * {
   *   creatorId?: string,
   *   title?: string,
   *   initialParticipants: Array<{
   *     participantId: string,
   *     participantType: 'USER' | 'SYNTHETIC_TWIN'
   *   }>,
   *   organizationId: string,
   *   tenantId: string
   * }
   */
  @Post('create')
  async createGroupChat(
    @Body()
    body: {
      creatorId?: string;
      title?: string;
      initialParticipants: Array<{
        participantId: string;
        participantType: 'USER' | 'SYNTHETIC_TWIN';
      }>;
      organizationId: string;
      tenantId: string;
    },
  ) {
    return await groupChatService.createGroupChat(body);
  }

  /**
   * PHASE3-ITEM2: Add a participant to a group chat
   */
  @Post(':conversationId/participants')
  async addParticipant(
    @Param('conversationId') conversationId: string,
    @Body()
    body: {
      participantId: string;
      participantType: 'USER' | 'SYNTHETIC_TWIN';
      organizationId: string;
      tenantId: string;
    },
  ) {
    await groupChatService.addParticipant({
      conversationId,
      ...body,
    });
    return { success: true };
  }

  /**
   * PHASE3-ITEM2: Remove a participant from a group chat
   */
  @Delete(':conversationId/participants/:participantId')
  async removeParticipant(
    @Param('conversationId') conversationId: string,
    @Param('participantId') participantId: string,
  ) {
    await groupChatService.removeParticipant(conversationId, participantId);
    return { success: true };
  }

  /**
   * PHASE3-ITEM2: Send a message in a group chat
   */
  @Post(':conversationId/messages')
  async sendMessage(
    @Param('conversationId') conversationId: string,
    @Body()
    body: {
      senderId: string;
      senderType: 'USER' | 'CREATOR' | 'SYNTHETIC_TWIN';
      messageType: 'TEXT' | 'VOICE' | 'IMAGE';
      content?: string;
      voiceUri?: string;
      organizationId: string;
      tenantId: string;
    },
  ) {
    return await groupChatService.sendGroupMessage({
      conversationId,
      ...body,
    });
  }

  /**
   * PHASE3-ITEM2: Get group chat details
   */
  @Get(':conversationId')
  async getGroupChat(@Param('conversationId') conversationId: string) {
    return await groupChatService.getGroupChat(conversationId);
  }

  /**
   * PHASE3-ITEM2: List group chats for a user
   */
  @Get('user/:userId')
  async listUserGroupChats(@Param('userId') userId: string, @Query('limit') limit?: number) {
    return await groupChatService.listGroupChatsForUser(userId, limit);
  }
}
