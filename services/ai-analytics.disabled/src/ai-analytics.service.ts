// services/ai-analytics/src/ai-analytics.service.ts
// PHASE3-ITEM3: Creator analytics for AI features
// Shows earnings from synthetic twin usage, generation counts, top performers

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface CreatorAIAnalytics {
  creatorId: string;
  // Synthetic Twin Image Generation Analytics
  syntheticTwinStats: {
    totalEarningsCents: bigint;
    totalGenerations: number;
    completedGenerations: number;
    failedGenerations: number;
    averageEarningsPerGeneration: number;
  };
  // Voice Chat Analytics
  voiceChatStats: {
    totalEarningsCents: bigint;
    totalVoiceMessages: number;
    totalTTSResponses: number;
  };
  // Combined AI Earnings
  totalAIEarningsCents: bigint;
  // Top Performing Days
  topDays: Array<{
    date: string;
    earningsCents: bigint;
    generationCount: number;
  }>;
}

export interface TopPerformingSyntheticTwin {
  creatorId: string;
  creatorName?: string;
  totalGenerations: number;
  totalEarningsCents: bigint;
  rank: number;
}

export class AIAnalyticsService {
  /**
   * PHASE3-ITEM3: Get comprehensive AI analytics for a creator
   *
   * Aggregates:
   * - Synthetic twin image generation earnings
   * - Voice chat TTS earnings
   * - Total AI-related earnings
   * - Generation counts and success rates
   */
  async getCreatorAIAnalytics(
    creatorId: string,
    startDate?: Date,
    endDate?: Date,
  ): Promise<CreatorAIAnalytics> {
    const dateFilter = {
      ...(startDate && { gte: startDate }),
      ...(endDate && { lte: endDate }),
    };

    // Synthetic Twin Image Generation Stats
    const syntheticTwinGenerations = await prisma.syntheticTwinGeneration.findMany({
      where: {
        creator_id: creatorId,
        created_at: dateFilter,
      },
    });

    const completedGenerations = syntheticTwinGenerations.filter((g) => g.status === 'COMPLETED');
    const failedGenerations = syntheticTwinGenerations.filter((g) => g.status === 'FAILED');

    const syntheticTwinEarnings = syntheticTwinGenerations.reduce(
      (sum, gen) => sum + gen.creator_earnings_cents,
      BigInt(0),
    );

    // Voice Chat Stats (from ledger)
    const voiceChatEarnings = await prisma.ledgerEntry.findMany({
      where: {
        performer_id: creatorId,
        entry_type: 'VOICE_CHAT_EARNINGS',
        created_at: dateFilter,
      },
    });

    const voiceChatTotalEarnings = voiceChatEarnings.reduce(
      (sum, entry) => sum + entry.performer_amount_cents,
      BigInt(0),
    );

    // Count voice messages sent by creator's synthetic twin
    const voiceMessages = await prisma.chatMessage.findMany({
      where: {
        sender_id: creatorId,
        sender_type: 'SYNTHETIC_TWIN',
        message_type: 'VOICE',
        created_at: dateFilter,
      },
    });

    // Calculate top performing days
    const dailyStats = await this.calculateDailyStats(
      creatorId,
      startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Default: last 30 days
      endDate || new Date(),
    );

    const totalAIEarnings = syntheticTwinEarnings + voiceChatTotalEarnings;

    return {
      creatorId,
      syntheticTwinStats: {
        totalEarningsCents: syntheticTwinEarnings,
        totalGenerations: syntheticTwinGenerations.length,
        completedGenerations: completedGenerations.length,
        failedGenerations: failedGenerations.length,
        averageEarningsPerGeneration:
          completedGenerations.length > 0
            ? Number(syntheticTwinEarnings) / completedGenerations.length
            : 0,
      },
      voiceChatStats: {
        totalEarningsCents: voiceChatTotalEarnings,
        totalVoiceMessages: voiceMessages.length,
        totalTTSResponses: voiceMessages.filter((m) => m.tts_voice_id).length,
      },
      totalAIEarningsCents: totalAIEarnings,
      topDays: dailyStats.sort((a, b) => Number(b.earningsCents - a.earningsCents)).slice(0, 7),
    };
  }

  /**
   * Calculate daily earnings stats
   */
  private async calculateDailyStats(
    creatorId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<
    Array<{
      date: string;
      earningsCents: bigint;
      generationCount: number;
    }>
  > {
    // Get all generations in date range
    const generations = await prisma.syntheticTwinGeneration.findMany({
      where: {
        creator_id: creatorId,
        status: 'COMPLETED',
        created_at: {
          gte: startDate,
          lte: endDate,
        },
      },
      orderBy: {
        created_at: 'asc',
      },
    });

    // Group by day
    const dailyMap = new Map<string, { earningsCents: bigint; count: number }>();

    for (const gen of generations) {
      const dateKey = gen.created_at.toISOString().split('T')[0]; // YYYY-MM-DD
      const existing = dailyMap.get(dateKey) || { earningsCents: BigInt(0), count: 0 };

      dailyMap.set(dateKey, {
        earningsCents: existing.earningsCents + gen.creator_earnings_cents,
        count: existing.count + 1,
      });
    }

    return Array.from(dailyMap.entries()).map(([date, stats]) => ({
      date,
      earningsCents: stats.earningsCents,
      generationCount: stats.count,
    }));
  }

  /**
   * PHASE3-ITEM3: Get top performing synthetic twins (leaderboard)
   *
   * Returns top creators ranked by:
   * - Total generations
   * - Total earnings
   */
  async getTopPerformingSyntheticTwins(
    limit = 10,
    startDate?: Date,
    endDate?: Date,
  ): Promise<TopPerformingSyntheticTwin[]> {
    const dateFilter = {
      ...(startDate && { gte: startDate }),
      ...(endDate && { lte: endDate }),
    };

    // Aggregate by creator
    const generationsByCreator = await prisma.syntheticTwinGeneration.groupBy({
      by: ['creator_id'],
      where: {
        status: 'COMPLETED',
        created_at: dateFilter,
      },
      _count: {
        id: true,
      },
      _sum: {
        creator_earnings_cents: true,
      },
      orderBy: {
        _sum: {
          creator_earnings_cents: 'desc',
        },
      },
      take: limit,
    });

    // Get creator IDs (names not available in current Creator model)
    const _creatorIds = generationsByCreator.map((g) => g.creator_id);

    return generationsByCreator.map((gen, index) => ({
      creatorId: gen.creator_id,
      creatorName: undefined, // Creator name not available - would need user profile service
      totalGenerations: gen._count.id,
      totalEarningsCents: gen._sum.creator_earnings_cents || BigInt(0),
      rank: index + 1,
    }));
  }

  /**
   * PHASE3-ITEM3: Get recent AI activity for a creator (for dashboard feed)
   */
  async getRecentAIActivity(
    creatorId: string,
    limit = 20,
  ): Promise<
    Array<{
      id: string;
      type: 'IMAGE_GENERATION' | 'VOICE_MESSAGE';
      userId: string;
      earningsCents: bigint;
      timestamp: Date;
      status: string;
    }>
  > {
    // Get recent image generations
    const imageGenerations = await prisma.syntheticTwinGeneration.findMany({
      where: {
        creator_id: creatorId,
      },
      orderBy: {
        created_at: 'desc',
      },
      take: limit,
    });

    // Get recent voice chat earnings
    const voiceEarnings = await prisma.ledgerEntry.findMany({
      where: {
        performer_id: creatorId,
        entry_type: 'VOICE_CHAT_EARNINGS',
      },
      orderBy: {
        created_at: 'desc',
      },
      take: limit,
    });

    const activities = [
      ...imageGenerations.map((gen) => ({
        id: gen.id,
        type: 'IMAGE_GENERATION' as const,
        userId: gen.user_id,
        earningsCents: gen.creator_earnings_cents,
        timestamp: gen.created_at,
        status: gen.status,
      })),
      ...voiceEarnings.map((entry) => ({
        id: entry.id,
        type: 'VOICE_MESSAGE' as const,
        userId: entry.user_id,
        earningsCents: entry.performer_amount_cents,
        timestamp: entry.created_at,
        status: 'COMPLETED',
      })),
    ];

    // Sort by timestamp descending
    activities.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    return activities.slice(0, limit);
  }

  /**
   * PHASE3-ITEM3: Get aggregated platform-wide AI stats (admin view)
   */
  async getPlatformAIStats(): Promise<{
    totalCreatorsWithAIEnabled: number;
    totalImageGenerations: number;
    totalVoiceMessages: number;
    totalAIEarningsCents: bigint;
    averageGenerationsPerCreator: number;
  }> {
    // Count creators with synthetic twin enabled
    const creatorsWithAI = await prisma.creator.count({
      where: {
        synthetic_twin_enabled: true,
      },
    });

    // Total image generations
    const totalGenerations = await prisma.syntheticTwinGeneration.count({
      where: {
        status: 'COMPLETED',
      },
    });

    // Total voice messages
    const totalVoiceMessages = await prisma.chatMessage.count({
      where: {
        message_type: 'VOICE',
        sender_type: 'SYNTHETIC_TWIN',
      },
    });

    // Total AI earnings (synthetic twin + voice)
    const syntheticTwinEarnings = await prisma.syntheticTwinGeneration.aggregate({
      _sum: {
        creator_earnings_cents: true,
      },
      where: {
        status: 'COMPLETED',
      },
    });

    const voiceChatEarnings = await prisma.ledgerEntry.aggregate({
      _sum: {
        performer_amount_cents: true,
      },
      where: {
        entry_type: 'VOICE_CHAT_EARNINGS',
      },
    });

    const totalEarnings =
      (syntheticTwinEarnings._sum.creator_earnings_cents || BigInt(0)) +
      (voiceChatEarnings._sum.performer_amount_cents || BigInt(0));

    return {
      totalCreatorsWithAIEnabled: creatorsWithAI,
      totalImageGenerations: totalGenerations,
      totalVoiceMessages,
      totalAIEarningsCents: totalEarnings,
      averageGenerationsPerCreator: creatorsWithAI > 0 ? totalGenerations / creatorsWithAI : 0,
    };
  }
}

export const aiAnalyticsService = new AIAnalyticsService();
