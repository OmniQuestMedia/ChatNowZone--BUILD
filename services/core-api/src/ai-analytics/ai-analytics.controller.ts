// services/core-api/src/ai-analytics/ai-analytics.controller.ts
// PHASE3-ITEM3: REST API controller for creator AI analytics

import { Controller, Get, Param, Query } from '@nestjs/common';
import { aiAnalyticsService } from '../../../ai-analytics/src/ai-analytics.service';

/**
 * PHASE3-ITEM3: AI Analytics API Controller
 *
 * Endpoints:
 * - GET /ai-analytics/creator/:creatorId - Get creator AI analytics
 * - GET /ai-analytics/top-performers - Get top performing synthetic twins
 * - GET /ai-analytics/creator/:creatorId/activity - Get recent AI activity
 * - GET /ai-analytics/platform - Get platform-wide AI stats (admin)
 */
@Controller('ai-analytics')
export class AIAnalyticsController {
  /**
   * PHASE3-ITEM3: Get comprehensive AI analytics for a creator
   *
   * Query params:
   * - startDate?: ISO date string
   * - endDate?: ISO date string
   */
  @Get('creator/:creatorId')
  async getCreatorAnalytics(
    @Param('creatorId') creatorId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return await aiAnalyticsService.getCreatorAIAnalytics(
      creatorId,
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined,
    );
  }

  /**
   * PHASE3-ITEM3: Get top performing synthetic twins leaderboard
   *
   * Query params:
   * - limit?: number (default 10)
   * - startDate?: ISO date string
   * - endDate?: ISO date string
   */
  @Get('top-performers')
  async getTopPerformers(
    @Query('limit') limit?: number,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return await aiAnalyticsService.getTopPerformingSyntheticTwins(
      limit,
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined,
    );
  }

  /**
   * PHASE3-ITEM3: Get recent AI activity for creator dashboard
   *
   * Query params:
   * - limit?: number (default 20)
   */
  @Get('creator/:creatorId/activity')
  async getRecentActivity(@Param('creatorId') creatorId: string, @Query('limit') limit?: number) {
    return await aiAnalyticsService.getRecentAIActivity(creatorId, limit);
  }

  /**
   * PHASE3-ITEM3: Get platform-wide AI statistics (admin only)
   */
  @Get('platform')
  async getPlatformStats() {
    return await aiAnalyticsService.getPlatformAIStats();
  }
}
