// services/core-api/src/admin-moderation/admin-moderation.controller.ts
// PHASE3-ITEM4: REST API controller for admin moderation of synthetic AI content
// Protected routes - should be behind RBAC/admin-only middleware

import { Controller, Get, Post, Delete, Body, Param, Query } from '@nestjs/common';
import { adminModerationService } from '../../../admin-moderation/src/admin-moderation.service';

/**
 * PHASE3-ITEM4: Admin Moderation API Controller
 *
 * IMPORTANT: All endpoints should be protected with admin-only RBAC middleware
 *
 * Endpoints:
 * - GET /admin/moderation/flagged-images - Get flagged synthetic images
 * - DELETE /admin/moderation/content/:contentId - Remove flagged content
 * - GET /admin/moderation/usage-logs - Get usage logs
 * - GET /admin/moderation/stats - Get platform stats
 * - GET /admin/moderation/user/:userId - Search user activity
 */
@Controller('admin/moderation')
export class AdminModerationController {
  /**
   * PHASE3-ITEM4: Get flagged synthetic twin images for review
   *
   * Query params:
   * - status?: 'PENDING' | 'REVIEWED' | 'REMOVED'
   * - limit?: number (default 50)
   */
  @Get('flagged-images')
  async getFlaggedImages(
    @Query('status') status?: 'PENDING' | 'REVIEWED' | 'REMOVED',
    @Query('limit') limit?: number,
  ) {
    return await adminModerationService.getFlaggedSyntheticImages(status, limit);
  }

  /**
   * PHASE3-ITEM4: Remove flagged synthetic content
   *
   * Request body:
   * {
   *   contentType: 'IMAGE' | 'VOICE' | 'CHAT',
   *   reason: string,
   *   adminUserId: string
   * }
   */
  @Delete('content/:contentId')
  async removeContent(
    @Param('contentId') contentId: string,
    @Body()
    body: {
      contentType: 'IMAGE' | 'VOICE' | 'CHAT';
      reason: string;
      adminUserId: string;
    },
  ) {
    return await adminModerationService.removeSyntheticContent(
      contentId,
      body.contentType,
      body.reason,
      body.adminUserId,
    );
  }

  /**
   * PHASE3-ITEM4: Get synthetic content usage logs
   *
   * Query params:
   * - limit?: number (default 100)
   * - userId?: string
   * - creatorId?: string
   */
  @Get('usage-logs')
  async getUsageLogs(
    @Query('limit') limit?: number,
    @Query('userId') userId?: string,
    @Query('creatorId') creatorId?: string,
  ) {
    return await adminModerationService.getSyntheticContentUsageLogs(limit, userId, creatorId);
  }

  /**
   * PHASE3-ITEM4: Get platform-wide synthetic twin usage statistics
   */
  @Get('stats')
  async getStats() {
    return await adminModerationService.getSyntheticTwinUsageStats();
  }

  /**
   * PHASE3-ITEM4: Search for specific user's synthetic content activity
   */
  @Get('user/:userId')
  async searchUserActivity(@Param('userId') userId: string) {
    return await adminModerationService.searchUserSyntheticActivity(userId);
  }
}
