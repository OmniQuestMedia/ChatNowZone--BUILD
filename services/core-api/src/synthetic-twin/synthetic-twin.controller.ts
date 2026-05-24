// services/core-api/src/synthetic-twin/synthetic-twin.controller.ts
// PHASE2-440: REST API controller for Safe Synthetic Twin image generation

import { Controller, Post, Get, Body, Param, Query } from '@nestjs/common';
import { syntheticTwinService } from '../../../synthetic-twin/src/synthetic-twin.service';

/**
 * PHASE2-440: Safe Synthetic Twin API Controller
 *
 * Endpoints:
 * - POST /synthetic-twin/generate - Generate AI image
 * - GET /synthetic-twin/history/:userId - Get generation history for fan
 * - GET /synthetic-twin/earnings/:creatorId - Get creator earnings
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
}
