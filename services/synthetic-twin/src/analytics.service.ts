// services/synthetic-twin/src/analytics.service.ts
// PHASE3-ITEM3: Creator Analytics for AI Features
// Provides aggregated analytics for creators on synthetic twin usage and earnings.

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface SyntheticTwinAnalytics {
  creatorId: string;
  totalEarningsCents: bigint;
  imageGenerations: {
    total: number;
    completed: number;
    failed: number;
    earningsCents: bigint;
  };
  voiceMessages: {
    total: number;
    completed: number;
    failed: number;
    earningsCents: bigint;
  };
  groupChatMessages: {
    total: number;
    earningsCents: bigint;
  };
  topPerformers: Array<{
    type: 'IMAGE' | 'VOICE' | 'GROUP_CHAT';
    count: number;
    earningsCents: bigint;
    lastUsed: Date;
  }>;
  recentActivity: Array<{
    id: string;
    type: 'IMAGE' | 'VOICE' | 'GROUP_CHAT';
    userId: string;
    earningsCents: bigint;
    createdAt: Date;
  }>;
}

export class AnalyticsService {
  /**
   * PHASE3-ITEM3: Get comprehensive analytics for a creator's AI features
   */
  async getCreatorAnalytics(creatorId: string): Promise<SyntheticTwinAnalytics> {
    // Fetch all image generations
    const imageGenerations = await prisma.syntheticTwinGeneration.findMany({
      where: { creator_id: creatorId },
      orderBy: { created_at: 'desc' },
    });

    // Fetch all voice messages
    const voiceMessages = await prisma.voiceChatMessage.findMany({
      where: { creator_id: creatorId },
      orderBy: { created_at: 'desc' },
    });

    // Fetch all group chat earnings via ledger entries
    const groupChatEarnings = await prisma.ledgerEntry.findMany({
      where: {
        performer_id: creatorId,
        entry_type: 'GROUP_CHAT_AI_EARNINGS',
        status: 'COMPLETED',
      },
      orderBy: { created_at: 'desc' },
    });

    // Calculate image generation stats
    const imageStats = {
      total: imageGenerations.length,
      completed: imageGenerations.filter((g) => g.status === 'COMPLETED').length,
      failed: imageGenerations.filter((g) => g.status === 'FAILED').length,
      earningsCents: imageGenerations
        .filter((g) => g.status === 'COMPLETED')
        .reduce((sum, g) => sum + g.creator_earnings_cents, BigInt(0)),
    };

    // Calculate voice message stats
    const voiceStats = {
      total: voiceMessages.length,
      completed: voiceMessages.filter((v) => v.status === 'COMPLETED').length,
      failed: voiceMessages.filter((v) => v.status === 'FAILED').length,
      earningsCents: voiceMessages
        .filter((v) => v.status === 'COMPLETED')
        .reduce((sum, v) => sum + v.creator_earnings_cents, BigInt(0)),
    };

    // Calculate group chat stats
    const groupChatStats = {
      total: groupChatEarnings.length,
      earningsCents: groupChatEarnings.reduce(
        (sum, e) => sum + e.performer_amount_cents,
        BigInt(0),
      ),
    };

    // Total earnings across all AI features
    const totalEarningsCents =
      imageStats.earningsCents + voiceStats.earningsCents + groupChatStats.earningsCents;

    // Build top performers array
    const topPerformers: Array<{
      type: 'IMAGE' | 'VOICE' | 'GROUP_CHAT';
      count: number;
      earningsCents: bigint;
      lastUsed: Date;
    }> = [];

    if (imageStats.completed > 0) {
      topPerformers.push({
        type: 'IMAGE',
        count: imageStats.completed,
        earningsCents: imageStats.earningsCents,
        lastUsed: imageGenerations[0]?.created_at || new Date(),
      });
    }

    if (voiceStats.completed > 0) {
      topPerformers.push({
        type: 'VOICE',
        count: voiceStats.completed,
        earningsCents: voiceStats.earningsCents,
        lastUsed: voiceMessages[0]?.created_at || new Date(),
      });
    }

    if (groupChatStats.total > 0) {
      topPerformers.push({
        type: 'GROUP_CHAT',
        count: groupChatStats.total,
        earningsCents: groupChatStats.earningsCents,
        lastUsed: groupChatEarnings[0]?.created_at || new Date(),
      });
    }

    // Sort by earnings (highest first)
    topPerformers.sort((a, b) => Number(b.earningsCents - a.earningsCents));

    // Build recent activity (last 50 interactions across all types)
    const recentActivity: Array<{
      id: string;
      type: 'IMAGE' | 'VOICE' | 'GROUP_CHAT';
      userId: string;
      earningsCents: bigint;
      createdAt: Date;
    }> = [];

    // Add image generations
    imageGenerations
      .filter((g) => g.status === 'COMPLETED')
      .slice(0, 20)
      .forEach((g) => {
        recentActivity.push({
          id: g.id,
          type: 'IMAGE',
          userId: g.user_id,
          earningsCents: g.creator_earnings_cents,
          createdAt: g.created_at,
        });
      });

    // Add voice messages
    voiceMessages
      .filter((v) => v.status === 'COMPLETED')
      .slice(0, 20)
      .forEach((v) => {
        recentActivity.push({
          id: v.id,
          type: 'VOICE',
          userId: v.user_id,
          earningsCents: v.creator_earnings_cents,
          createdAt: v.created_at,
        });
      });

    // Add group chat earnings
    groupChatEarnings.slice(0, 20).forEach((e) => {
      recentActivity.push({
        id: e.id,
        type: 'GROUP_CHAT',
        userId: e.user_id,
        earningsCents: e.performer_amount_cents,
        createdAt: e.created_at,
      });
    });

    // Sort by date (most recent first) and take top 50
    recentActivity.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    const limitedActivity = recentActivity.slice(0, 50);

    return {
      creatorId,
      totalEarningsCents,
      imageGenerations: imageStats,
      voiceMessages: voiceStats,
      groupChatMessages: groupChatStats,
      topPerformers,
      recentActivity: limitedActivity,
    };
  }

  /**
   * PHASE3-ITEM3: Get usage statistics for a specific time period
   */
  async getUsageStats(
    creatorId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<{
    imageCount: number;
    voiceCount: number;
    groupChatMessageCount: number;
    totalEarningsCents: bigint;
  }> {
    const imageCount = await prisma.syntheticTwinGeneration.count({
      where: {
        creator_id: creatorId,
        status: 'COMPLETED',
        created_at: {
          gte: startDate,
          lte: endDate,
        },
      },
    });

    const voiceCount = await prisma.voiceChatMessage.count({
      where: {
        creator_id: creatorId,
        status: 'COMPLETED',
        created_at: {
          gte: startDate,
          lte: endDate,
        },
      },
    });

    const groupChatMessageCount = await prisma.ledgerEntry.count({
      where: {
        performer_id: creatorId,
        entry_type: 'GROUP_CHAT_AI_EARNINGS',
        status: 'COMPLETED',
        created_at: {
          gte: startDate,
          lte: endDate,
        },
      },
    });

    // Calculate total earnings in period
    const imageEarnings = await prisma.syntheticTwinGeneration.aggregate({
      where: {
        creator_id: creatorId,
        status: 'COMPLETED',
        created_at: {
          gte: startDate,
          lte: endDate,
        },
      },
      _sum: {
        creator_earnings_cents: true,
      },
    });

    const voiceEarnings = await prisma.voiceChatMessage.aggregate({
      where: {
        creator_id: creatorId,
        status: 'COMPLETED',
        created_at: {
          gte: startDate,
          lte: endDate,
        },
      },
      _sum: {
        creator_earnings_cents: true,
      },
    });

    const groupChatEarnings = await prisma.ledgerEntry.aggregate({
      where: {
        performer_id: creatorId,
        entry_type: 'GROUP_CHAT_AI_EARNINGS',
        status: 'COMPLETED',
        created_at: {
          gte: startDate,
          lte: endDate,
        },
      },
      _sum: {
        performer_amount_cents: true,
      },
    });

    const totalEarningsCents =
      (imageEarnings._sum.creator_earnings_cents || BigInt(0)) +
      (voiceEarnings._sum.creator_earnings_cents || BigInt(0)) +
      (groupChatEarnings._sum.performer_amount_cents || BigInt(0));

    return {
      imageCount,
      voiceCount,
      groupChatMessageCount,
      totalEarningsCents,
    };
  }
}

export const analyticsService = new AnalyticsService();
