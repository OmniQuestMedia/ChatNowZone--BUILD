// services/core-api/src/synthetic-twin/synthetic-twin.controller.ts
// PHASE2-440 + PHASE3: REST API controller for Safe Synthetic Twin features
// PHASE5-ITEM1: Added SynthiMatesAi webhook endpoint

import { Controller, Post, Get, Put, Body, Param, Query } from '@nestjs/common';
import { syntheticTwinService } from '../../../synthetic-twin/src/synthetic-twin.service';
import { voiceChatService } from '../../../synthetic-twin/src/voice-chat.service';
import { groupChatService } from '../../../synthetic-twin/src/group-chat.service';
import { analyticsService } from '../../../synthetic-twin/src/analytics.service';
import { moderationService } from '../../../synthetic-twin/src/moderation.service';
import { synthiMatesWebhookService } from '../../../synthetic-twin/src/synthimates-webhook.service';

/**
 * Safe Synthetic Twin API Controller
 *
 * PHASE2-440 Endpoints:
 * - POST /synthetic-twin/generate - Generate AI image
 * - GET /synthetic-twin/history/:userId - Get generation history for fan
 * - GET /synthetic-twin/earnings/:creatorId - Get creator earnings
 *
 * PHASE3 New Endpoints:
 * - POST /synthetic-twin/voice/send - Send voice message
 * - GET /synthetic-twin/voice/history/:userId - Get voice chat history
 * - POST /synthetic-twin/group/create - Create group chat
 * - POST /synthetic-twin/group/:sessionId/participants - Add participant
 * - POST /synthetic-twin/group/:sessionId/messages - Send message
 * - GET /synthetic-twin/group/:sessionId/messages - Get messages
 * - GET /synthetic-twin/group/sessions/:userId - Get user's sessions
 * - GET /synthetic-twin/analytics/:creatorId - Get creator analytics
 * - GET /synthetic-twin/analytics/:creatorId/usage - Get usage stats
 * - POST /synthetic-twin/moderation/flag - Flag content
 * - PUT /synthetic-twin/moderation/:moderationId/review - Review flagged content
 * - GET /synthetic-twin/moderation/queue - Get moderation queue
 * - GET /synthetic-twin/moderation/stats - Get moderation stats
 * - GET /synthetic-twin/moderation/logs - Get usage logs
 */
@Controller('synthetic-twin')
export class SyntheticTwinController {
  /**
   * PHASE2-440-ITEM1: Generate AI image using creator's synthetic twin
   *
   * Request body:
   * {
   *   userId: string,
   *   creatorId: string,
   *   prompt?: string,
   *   organizationId: string,
   *   tenantId: string
   * }
   */
  @Post('generate')
  async generateImage(
    @Body()
    body: {
      userId: string;
      creatorId: string;
      prompt?: string;
      organizationId: string;
      tenantId: string;
    },
  ) {
    return await syntheticTwinService.generateImage(body);
  }

  /**
   * PHASE2-440-ITEM5: Get generation history for a fan
   *
   * Query params:
   * - limit?: number (default 50)
   */
  @Get('history/:userId')
  async getHistory(@Param('userId') userId: string, @Query('limit') limit?: number) {
    return await syntheticTwinService.getGenerationHistory(userId, limit);
  }

  /**
   * PHASE2-440-ITEM2: Get creator earnings from synthetic twins
   *
   * Query params:
   * - limit?: number (default 100)
   */
  @Get('earnings/:creatorId')
  async getCreatorEarnings(@Param('creatorId') creatorId: string, @Query('limit') limit?: number) {
    return await syntheticTwinService.getCreatorEarnings(creatorId, limit);
  }

  // ─── PHASE3-ITEM1: Voice Chat Endpoints ───────────────────────────────────

  /**
   * PHASE3-ITEM1: Send voice message and receive synthetic twin TTS response
   */
  @Post('voice/send')
  async sendVoiceMessage(
    @Body()
    body: {
      userId: string;
      creatorId: string;
      inputAudioUri?: string;
      inputTranscript?: string;
      organizationId: string;
      tenantId: string;
    },
  ) {
    return await voiceChatService.sendVoiceMessage(body);
  }

  /**
   * PHASE3-ITEM1: Get voice chat history for a fan
   */
  @Get('voice/history/:userId')
  async getVoiceHistory(@Param('userId') userId: string, @Query('limit') limit?: number) {
    return await voiceChatService.getVoiceHistory(userId, limit);
  }

  // ─── PHASE3-ITEM2: Group Chat Endpoints ───────────────────────────────────

  /**
   * PHASE3-ITEM2: Create new group chat session
   */
  @Post('group/create')
  async createGroupChat(
    @Body()
    body: {
      name: string;
      hostUserId: string;
      organizationId: string;
      tenantId: string;
    },
  ) {
    return await groupChatService.createGroupChat(body);
  }

  /**
   * PHASE3-ITEM2: Add participant to group chat (including synthetic twins)
   */
  @Post('group/:sessionId/participants')
  async addParticipant(
    @Param('sessionId') sessionId: string,
    @Body()
    body: {
      participantType: 'USER' | 'CREATOR' | 'SYNTHETIC_TWIN';
      userId?: string;
      creatorId?: string;
      displayName: string;
    },
  ) {
    return await groupChatService.addParticipant({ sessionId, ...body });
  }

  /**
   * PHASE3-ITEM2: Send message in group chat
   */
  @Post('group/:sessionId/messages')
  async sendGroupMessage(
    @Param('sessionId') sessionId: string,
    @Body()
    body: {
      participantId: string;
      content: string;
      messageType?: 'TEXT' | 'VOICE' | 'IMAGE';
      mediaUri?: string;
    },
  ) {
    return await groupChatService.sendMessage({ sessionId, ...body });
  }

  /**
   * PHASE3-ITEM2: Get messages from group chat
   */
  @Get('group/:sessionId/messages')
  async getGroupMessages(@Param('sessionId') sessionId: string, @Query('limit') limit?: number) {
    return await groupChatService.getMessages(sessionId, limit);
  }

  /**
   * PHASE3-ITEM2: Get user's group chat sessions
   */
  @Get('group/sessions/:userId')
  async getUserSessions(@Param('userId') userId: string) {
    return await groupChatService.getUserSessions(userId);
  }

  // ─── PHASE3-ITEM3: Analytics Endpoints ────────────────────────────────────

  /**
   * PHASE3-ITEM3: Get comprehensive analytics for creator's AI features
   */
  @Get('analytics/:creatorId')
  async getCreatorAnalytics(@Param('creatorId') creatorId: string) {
    return await analyticsService.getCreatorAnalytics(creatorId);
  }

  /**
   * PHASE3-ITEM3: Get usage statistics for specific time period
   */
  @Get('analytics/:creatorId/usage')
  async getUsageStats(
    @Param('creatorId') creatorId: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    return await analyticsService.getUsageStats(creatorId, start, end);
  }

  // ─── PHASE3-ITEM4: Moderation Endpoints ───────────────────────────────────

  /**
   * PHASE3-ITEM4: Flag content for moderation review
   */
  @Post('moderation/flag')
  async flagContent(
    @Body()
    body: {
      contentType: 'IMAGE' | 'VOICE' | 'TEXT';
      generationId: string;
      creatorId: string;
      userId: string;
      contentUri: string;
      flagReason: string;
      flagSource: 'AUTO' | 'USER_REPORT';
      organizationId: string;
      tenantId: string;
    },
  ) {
    return await moderationService.flagContent(body);
  }

  /**
   * PHASE3-ITEM4: Review flagged content (admin only)
   */
  @Put('moderation/:moderationId/review')
  async reviewContent(
    @Param('moderationId') moderationId: string,
    @Body()
    body: {
      reviewedBy: string;
      decision: 'APPROVED' | 'REMOVED' | 'ESCALATED';
      reviewNotes?: string;
    },
  ) {
    return await moderationService.reviewContent({ moderationId, ...body });
  }

  /**
   * PHASE3-ITEM4: Get moderation queue (admin only)
   */
  @Get('moderation/queue')
  async getModerationQueue(@Query('status') status?: string, @Query('limit') limit?: number) {
    return await moderationService.getModerationQueue(status, limit);
  }

  /**
   * PHASE3-ITEM4: Get moderation statistics (admin only)
   */
  @Get('moderation/stats')
  async getModerationStats() {
    return await moderationService.getModerationStats();
  }

  /**
   * PHASE3-ITEM4: Get usage logs for monitoring
   */
  @Get('moderation/logs')
  async getUsageLogs(
    @Query('creatorId') creatorId?: string,
    @Query('userId') userId?: string,
    @Query('limit') limit?: number,
  ) {
    return await moderationService.getUsageLogs(creatorId, userId, limit);
  }

  // ─── PHASE5-ITEM1: SynthiMatesAi Webhook Endpoint ─────────────────────────

  /**
   * PHASE5-ITEM1: Receive webhook callbacks from SynthiMatesAi
   *
   * This endpoint is called by SynthiMatesAi when image/video generation completes.
   * The webhook includes the result URL or error message.
   *
   * Security: HMAC signature verification is performed to ensure authenticity.
   */
  @Post('webhooks/synthimates/generation-complete')
  async synthiMatesWebhook(
    @Body()
    payload: {
      jobId: string;
      correlationId: string;
      status: 'completed' | 'failed';
      resultUrl?: string;
      contentType: 'image' | 'video';
      errorMessage?: string;
      metadata?: Record<string, unknown>;
      completedAt: string;
      hmacSignature: string;
    },
  ) {
    return await synthiMatesWebhookService.processWebhook(payload);
  }

  /**
   * PHASE5-ITEM1: Get generation status (for debugging/polling)
   */
  @Get('generation/status/:correlationId')
  async getGenerationStatus(@Param('correlationId') correlationId: string) {
    return await synthiMatesWebhookService.getGenerationStatus(correlationId);
  }
}
