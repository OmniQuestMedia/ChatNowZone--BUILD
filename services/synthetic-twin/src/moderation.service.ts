// services/synthetic-twin/src/moderation.service.ts
// PHASE3-ITEM4: Admin Moderation Tools for Synthetic Content
// Provides admin review and moderation capabilities for AI-generated content.

import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';

const prisma = new PrismaClient();

export interface FlagContentRequest {
  contentType: 'IMAGE' | 'VOICE' | 'TEXT';
  generationId: string;
  creatorId: string;
  userId: string;
  contentUri: string;
  flagReason: string;
  flagSource: 'AUTO' | 'USER_REPORT';
  organizationId: string;
  tenantId: string;
}

export interface ReviewContentRequest {
  moderationId: string;
  reviewedBy: string;
  decision: 'APPROVED' | 'REMOVED' | 'ESCALATED';
  reviewNotes?: string;
}

export interface ModerationQueueResponse {
  id: string;
  correlationId: string;
  contentType: string;
  generationId: string;
  creatorId: string;
  userId: string;
  contentUri: string;
  flagReason: string;
  flagSource: string;
  moderationStatus: string;
  reviewedBy?: string;
  reviewNotes?: string;
  flaggedAt: Date;
  reviewedAt?: Date;
}

export interface ModerationStats {
  pending: number;
  approved: number;
  removed: number;
  escalated: number;
  totalFlagged: number;
  flagsBySource: {
    auto: number;
    userReport: number;
  };
  flagsByType: {
    image: number;
    voice: number;
    text: number;
  };
}

export class ModerationService {
  /**
   * PHASE3-ITEM4: Flag content for moderation review
   * Can be triggered automatically or by user report
   */
  async flagContent(request: FlagContentRequest): Promise<ModerationQueueResponse> {
    const correlationId = `MOD-${randomUUID()}`;

    const moderation = await prisma.syntheticContentModeration.create({
      data: {
        correlation_id: correlationId,
        content_type: request.contentType,
        generation_id: request.generationId,
        creator_id: request.creatorId,
        user_id: request.userId,
        content_uri: request.contentUri,
        flag_reason: request.flagReason,
        flag_source: request.flagSource,
        moderation_status: 'PENDING',
        reason_code: 'SYNTHETIC_CONTENT_REVIEW',
        rule_applied_id: 'MODERATION_v1',
        organization_id: request.organizationId,
        tenant_id: request.tenantId,
      },
    });

    return {
      id: moderation.id,
      correlationId: moderation.correlation_id,
      contentType: moderation.content_type,
      generationId: moderation.generation_id,
      creatorId: moderation.creator_id,
      userId: moderation.user_id,
      contentUri: moderation.content_uri,
      flagReason: moderation.flag_reason,
      flagSource: moderation.flag_source,
      moderationStatus: moderation.moderation_status,
      reviewedBy: moderation.reviewed_by || undefined,
      reviewNotes: moderation.review_notes || undefined,
      flaggedAt: moderation.flagged_at,
      reviewedAt: moderation.reviewed_at || undefined,
    };
  }

  /**
   * PHASE3-ITEM4: Review flagged content (admin action)
   */
  async reviewContent(request: ReviewContentRequest): Promise<ModerationQueueResponse> {
    const moderation = await prisma.syntheticContentModeration.update({
      where: { id: request.moderationId },
      data: {
        moderation_status: request.decision,
        reviewed_by: request.reviewedBy,
        review_notes: request.reviewNotes || null,
        reviewed_at: new Date(),
      },
    });

    // If content is REMOVED, we should mark the source generation as moderated
    if (request.decision === 'REMOVED') {
      await this.markContentAsModerated(
        moderation.content_type,
        moderation.generation_id,
        request.reviewNotes,
      );
    }

    return {
      id: moderation.id,
      correlationId: moderation.correlation_id,
      contentType: moderation.content_type,
      generationId: moderation.generation_id,
      creatorId: moderation.creator_id,
      userId: moderation.user_id,
      contentUri: moderation.content_uri,
      flagReason: moderation.flag_reason,
      flagSource: moderation.flag_source,
      moderationStatus: moderation.moderation_status,
      reviewedBy: moderation.reviewed_by || undefined,
      reviewNotes: moderation.review_notes || undefined,
      flaggedAt: moderation.flagged_at,
      reviewedAt: moderation.reviewed_at || undefined,
    };
  }

  /**
   * PHASE3-ITEM4: Mark source generation as moderated/removed
   */
  private async markContentAsModerated(
    contentType: string,
    generationId: string,
    moderationNotes?: string,
  ): Promise<void> {
    if (contentType === 'IMAGE') {
      // Update synthetic twin generation with moderation flag
      await prisma.syntheticTwinGeneration.update({
        where: { id: generationId },
        data: {
          status: 'FAILED',
          error_message: `Content removed by moderation: ${moderationNotes || 'Policy violation'}`,
        },
      });
    } else if (contentType === 'VOICE') {
      // Update voice chat message with moderation flag
      await prisma.voiceChatMessage.update({
        where: { id: generationId },
        data: {
          status: 'FAILED',
          error_message: `Content removed by moderation: ${moderationNotes || 'Policy violation'}`,
        },
      });
    }
  }

  /**
   * PHASE3-ITEM4: Get moderation queue (pending items)
   */
  async getModerationQueue(status?: string, limit = 100): Promise<ModerationQueueResponse[]> {
    const moderations = await prisma.syntheticContentModeration.findMany({
      where: status ? { moderation_status: status } : {},
      orderBy: { flagged_at: 'desc' },
      take: limit,
    });

    return moderations.map((m) => ({
      id: m.id,
      correlationId: m.correlation_id,
      contentType: m.content_type,
      generationId: m.generation_id,
      creatorId: m.creator_id,
      userId: m.user_id,
      contentUri: m.content_uri,
      flagReason: m.flag_reason,
      flagSource: m.flag_source,
      moderationStatus: m.moderation_status,
      reviewedBy: m.reviewed_by || undefined,
      reviewNotes: m.review_notes || undefined,
      flaggedAt: m.flagged_at,
      reviewedAt: m.reviewed_at || undefined,
    }));
  }

  /**
   * PHASE3-ITEM4: Get moderation statistics
   */
  async getModerationStats(): Promise<ModerationStats> {
    const [pending, approved, removed, escalated, total, autoFlags, userReports] =
      await Promise.all([
        prisma.syntheticContentModeration.count({
          where: { moderation_status: 'PENDING' },
        }),
        prisma.syntheticContentModeration.count({
          where: { moderation_status: 'APPROVED' },
        }),
        prisma.syntheticContentModeration.count({
          where: { moderation_status: 'REMOVED' },
        }),
        prisma.syntheticContentModeration.count({
          where: { moderation_status: 'ESCALATED' },
        }),
        prisma.syntheticContentModeration.count(),
        prisma.syntheticContentModeration.count({
          where: { flag_source: 'AUTO' },
        }),
        prisma.syntheticContentModeration.count({
          where: { flag_source: 'USER_REPORT' },
        }),
      ]);

    const [imageFlags, voiceFlags, textFlags] = await Promise.all([
      prisma.syntheticContentModeration.count({
        where: { content_type: 'IMAGE' },
      }),
      prisma.syntheticContentModeration.count({
        where: { content_type: 'VOICE' },
      }),
      prisma.syntheticContentModeration.count({
        where: { content_type: 'TEXT' },
      }),
    ]);

    return {
      pending,
      approved,
      removed,
      escalated,
      totalFlagged: total,
      flagsBySource: {
        auto: autoFlags,
        userReport: userReports,
      },
      flagsByType: {
        image: imageFlags,
        voice: voiceFlags,
        text: textFlags,
      },
    };
  }

  /**
   * PHASE3-ITEM4: Get flagged content for a specific creator
   */
  async getCreatorFlaggedContent(creatorId: string): Promise<ModerationQueueResponse[]> {
    const moderations = await prisma.syntheticContentModeration.findMany({
      where: { creator_id: creatorId },
      orderBy: { flagged_at: 'desc' },
    });

    return moderations.map((m) => ({
      id: m.id,
      correlationId: m.correlation_id,
      contentType: m.content_type,
      generationId: m.generation_id,
      creatorId: m.creator_id,
      userId: m.user_id,
      contentUri: m.content_uri,
      flagReason: m.flag_reason,
      flagSource: m.flag_source,
      moderationStatus: m.moderation_status,
      reviewedBy: m.reviewed_by || undefined,
      reviewNotes: m.review_notes || undefined,
      flaggedAt: m.flagged_at,
      reviewedAt: m.reviewed_at || undefined,
    }));
  }

  /**
   * PHASE3-ITEM4: Get usage logs for synthetic twin feature
   */
  async getUsageLogs(
    creatorId?: string,
    userId?: string,
    limit = 100,
  ): Promise<
    Array<{
      id: string;
      type: 'IMAGE' | 'VOICE';
      creatorId: string;
      userId: string;
      status: string;
      tokensCharged: number;
      createdAt: Date;
    }>
  > {
    const logs: Array<{
      id: string;
      type: 'IMAGE' | 'VOICE';
      creatorId: string;
      userId: string;
      status: string;
      tokensCharged: number;
      createdAt: Date;
    }> = [];

    // Get image generations
    const images = await prisma.syntheticTwinGeneration.findMany({
      where: {
        ...(creatorId && { creator_id: creatorId }),
        ...(userId && { user_id: userId }),
      },
      orderBy: { created_at: 'desc' },
      take: limit / 2,
    });

    logs.push(
      ...images.map((img) => ({
        id: img.id,
        type: 'IMAGE' as const,
        creatorId: img.creator_id,
        userId: img.user_id,
        status: img.status,
        tokensCharged: img.tokens_charged,
        createdAt: img.created_at,
      })),
    );

    // Get voice messages
    const voices = await prisma.voiceChatMessage.findMany({
      where: {
        ...(creatorId && { creator_id: creatorId }),
        ...(userId && { user_id: userId }),
      },
      orderBy: { created_at: 'desc' },
      take: limit / 2,
    });

    logs.push(
      ...voices.map((voice) => ({
        id: voice.id,
        type: 'VOICE' as const,
        creatorId: voice.creator_id,
        userId: voice.user_id,
        status: voice.status,
        tokensCharged: voice.tokens_charged,
        createdAt: voice.created_at,
      })),
    );

    // Sort by created_at desc and limit
    logs.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    return logs.slice(0, limit);
  }
}

export const moderationService = new ModerationService();
