// services/admin-moderation/src/admin-moderation.service.ts
// PHASE3-ITEM4: Admin moderation tools for synthetic AI content
// Protected routes for reviewing and moderating AI-generated content

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface FlaggedContent {
  id: string;
  type: 'SYNTHETIC_IMAGE' | 'VOICE_MESSAGE' | 'CHAT_MESSAGE';
  contentId: string;
  creatorId: string;
  userId: string;
  flagReason: string;
  flaggedAt: Date;
  status: 'PENDING' | 'REVIEWED' | 'REMOVED';
  reviewedBy?: string;
  reviewedAt?: Date;
}

export interface SyntheticContentUsageLog {
  id: string;
  userId: string;
  creatorId: string;
  type: 'IMAGE_GENERATION' | 'VOICE_CHAT' | 'GROUP_CHAT';
  tokensCharged: number;
  timestamp: Date;
  status: string;
}

export class AdminModerationService {
  /**
   * PHASE3-ITEM4: Get flagged synthetic twin images for review
   */
  async getFlaggedSyntheticImages(
    status?: 'PENDING' | 'REVIEWED' | 'REMOVED',
    limit = 50,
  ): Promise<
    Array<{
      id: string;
      imageUri?: string;
      creatorId: string;
      userId: string;
      prompt?: string;
      createdAt: Date;
      status: string;
    }>
  > {
    // In a real implementation, there would be a separate FlaggedContent table
    // For MVP, we'll return recent synthetic twin generations that failed
    // or can be manually reviewed
    const generations = await prisma.syntheticTwinGeneration.findMany({
      where: {
        ...(status === 'REMOVED' ? { status: 'FAILED' } : {}),
        ...(status === 'PENDING' ? { status: 'COMPLETED' } : {}),
      },
      orderBy: {
        created_at: 'desc',
      },
      take: limit,
    });

    return generations.map((gen) => ({
      id: gen.id,
      imageUri: gen.image_uri || undefined,
      creatorId: gen.creator_id,
      userId: gen.user_id,
      prompt: gen.prompt || undefined,
      createdAt: gen.created_at,
      status: gen.status,
    }));
  }

  /**
   * PHASE3-ITEM4: Remove flagged synthetic content
   *
   * Marks content as FAILED/REMOVED and prevents further display
   */
  async removeSyntheticContent(
    contentId: string,
    contentType: 'IMAGE' | 'VOICE' | 'CHAT',
    reason: string,
    adminUserId: string,
  ): Promise<{ success: boolean }> {
    if (contentType === 'IMAGE') {
      // Mark synthetic twin generation as failed
      await prisma.syntheticTwinGeneration.update({
        where: { id: contentId },
        data: {
          status: 'FAILED',
          error_message: `Removed by admin: ${reason}`,
          updated_at: new Date(),
        },
      });
    } else if (contentType === 'VOICE' || contentType === 'CHAT') {
      // Mark chat message as failed
      await prisma.chatMessage.update({
        where: { id: contentId },
        data: {
          status: 'FAILED',
          updated_at: new Date(),
        },
      });
    }

    // TODO: Create audit log entry for admin action
    // This would normally go to a separate AdminActionLog table

    return { success: true };
  }

  /**
   * PHASE3-ITEM4: Get synthetic content usage logs for monitoring
   */
  async getSyntheticContentUsageLogs(
    limit = 100,
    userId?: string,
    creatorId?: string,
  ): Promise<SyntheticContentUsageLog[]> {
    // Get image generations
    const imageGenerations = await prisma.syntheticTwinGeneration.findMany({
      where: {
        ...(userId && { user_id: userId }),
        ...(creatorId && { creator_id: creatorId }),
      },
      orderBy: {
        created_at: 'desc',
      },
      take: limit / 2, // Half from images
    });

    // Get voice chat messages
    const voiceMessages = await prisma.chatMessage.findMany({
      where: {
        message_type: 'VOICE',
        ...(userId && { sender_id: userId }),
        ...(creatorId && {
          conversation: {
            creator_id: creatorId,
          },
        }),
      },
      orderBy: {
        created_at: 'desc',
      },
      take: limit / 2, // Half from voice
    });

    const logs: SyntheticContentUsageLog[] = [
      ...imageGenerations.map((gen) => ({
        id: gen.id,
        userId: gen.user_id,
        creatorId: gen.creator_id,
        type: 'IMAGE_GENERATION' as const,
        tokensCharged: gen.tokens_charged,
        timestamp: gen.created_at,
        status: gen.status,
      })),
      ...voiceMessages.map((msg) => ({
        id: msg.id,
        userId: msg.sender_id,
        creatorId: msg.sender_id, // Simplified - would need conversation lookup
        type: 'VOICE_CHAT' as const,
        tokensCharged: msg.tokens_charged,
        timestamp: msg.created_at,
        status: msg.status,
      })),
    ];

    // Sort by timestamp descending
    logs.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    return logs.slice(0, limit);
  }

  /**
   * PHASE3-ITEM4: Get synthetic twin usage statistics for admin dashboard
   */
  async getSyntheticTwinUsageStats(): Promise<{
    totalGenerations: number;
    generationsLast24h: number;
    totalVoiceMessages: number;
    voiceMessagesLast24h: number;
    failureRate: number;
    totalTokensCharged: number;
  }> {
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // Total generations
    const totalGenerations = await prisma.syntheticTwinGeneration.count();

    // Generations last 24h
    const generationsLast24h = await prisma.syntheticTwinGeneration.count({
      where: {
        created_at: {
          gte: yesterday,
        },
      },
    });

    // Failed generations
    const failedGenerations = await prisma.syntheticTwinGeneration.count({
      where: {
        status: 'FAILED',
      },
    });

    // Voice messages
    const totalVoiceMessages = await prisma.chatMessage.count({
      where: {
        message_type: 'VOICE',
      },
    });

    const voiceMessagesLast24h = await prisma.chatMessage.count({
      where: {
        message_type: 'VOICE',
        created_at: {
          gte: yesterday,
        },
      },
    });

    // Total tokens charged
    const tokensAgg = await prisma.syntheticTwinGeneration.aggregate({
      _sum: {
        tokens_charged: true,
      },
    });

    return {
      totalGenerations,
      generationsLast24h,
      totalVoiceMessages,
      voiceMessagesLast24h,
      failureRate: totalGenerations > 0 ? failedGenerations / totalGenerations : 0,
      totalTokensCharged: tokensAgg._sum.tokens_charged || 0,
    };
  }

  /**
   * PHASE3-ITEM4: Search for specific user's synthetic content activity
   */
  async searchUserSyntheticActivity(
    userId: string,
  ): Promise<{
    totalGenerations: number;
    totalVoiceMessages: number;
    totalTokensSpent: number;
    recentActivity: Array<{
      type: string;
      timestamp: Date;
      status: string;
    }>;
  }> {
    const imageGenerations = await prisma.syntheticTwinGeneration.findMany({
      where: {
        user_id: userId,
      },
      orderBy: {
        created_at: 'desc',
      },
    });

    const voiceMessages = await prisma.chatMessage.findMany({
      where: {
        sender_id: userId,
        sender_type: 'USER',
        message_type: 'VOICE',
      },
      orderBy: {
        created_at: 'desc',
      },
    });

    const totalTokensSpent =
      imageGenerations.reduce((sum, gen) => sum + gen.tokens_charged, 0) +
      voiceMessages.reduce((sum, msg) => sum + msg.tokens_charged, 0);

    const recentActivity = [
      ...imageGenerations.slice(0, 10).map((gen) => ({
        type: 'IMAGE_GENERATION',
        timestamp: gen.created_at,
        status: gen.status,
      })),
      ...voiceMessages.slice(0, 10).map((msg) => ({
        type: 'VOICE_MESSAGE',
        timestamp: msg.created_at,
        status: msg.status,
      })),
    ].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    return {
      totalGenerations: imageGenerations.length,
      totalVoiceMessages: voiceMessages.length,
      totalTokensSpent,
      recentActivity: recentActivity.slice(0, 20),
    };
  }
}

export const adminModerationService = new AdminModerationService();
