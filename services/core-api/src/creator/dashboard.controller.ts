// WO: WO-INIT-001
// PHASE7-ITEM1: Enhanced Creator Dashboard with AI Earnings Integration
import { Injectable } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { analyticsService } from '../../../synthetic-twin/src/analytics.service';

const prisma = new PrismaClient();

export interface DashboardSummary {
  creatorId: string;
  totalEarningsCents: bigint;
  pendingPayoutCents: bigint;
  activeContracts: number;
  recentTipCount: number;
  // PHASE7: AI synthetic twin earnings
  aiFeatures: {
    enabled: boolean;
    totalAiEarningsCents: bigint;
    imageGenerations: {
      total: number;
      completed: number;
      earningsCents: bigint;
    };
    voiceMessages: {
      total: number;
      completed: number;
      earningsCents: bigint;
    };
    groupChatMessages: {
      total: number;
      earningsCents: bigint;
    };
    topPerformingFeature: 'IMAGE' | 'VOICE' | 'GROUP_CHAT' | null;
  };
}

export interface CreatorAiSettings {
  creatorId: string;
  syntheticTwinEnabled: boolean;
}

@Injectable()
export class DashboardController {
  /**
   * PHASE7-ITEM1: Get comprehensive dashboard summary including AI earnings
   */
  async getSummary(creatorId: string): Promise<DashboardSummary> {
    // Get creator settings
    const creator = await prisma.creator.findUnique({
      where: { id: creatorId },
      select: { synthetic_twin_enabled: true },
    });

    // Get AI analytics if enabled
    let aiAnalytics;
    if (creator?.synthetic_twin_enabled) {
      aiAnalytics = await analyticsService.getCreatorAnalytics(creatorId);
    }

    // Get traditional earnings from ledger
    const ledgerEntries = await prisma.ledgerEntry.findMany({
      where: {
        performer_id: creatorId,
        status: 'COMPLETED',
      },
      select: {
        performer_amount_cents: true,
        entry_type: true,
      },
    });

    const totalTraditionalEarnings = ledgerEntries
      .filter((e) => !e.entry_type.includes('SYNTHETIC_TWIN') && !e.entry_type.includes('AI'))
      .reduce((sum, e) => sum + e.performer_amount_cents, BigInt(0));

    const totalAiEarnings = aiAnalytics?.totalEarningsCents || BigInt(0);
    const totalEarningsCents = totalTraditionalEarnings + totalAiEarnings;

    // Determine top performing AI feature
    let topPerformingFeature: 'IMAGE' | 'VOICE' | 'GROUP_CHAT' | null = null;
    if (aiAnalytics && aiAnalytics.topPerformers.length > 0) {
      topPerformingFeature = aiAnalytics.topPerformers[0].type;
    }

    return {
      creatorId,
      totalEarningsCents,
      pendingPayoutCents: BigInt(0), // TODO: Implement pending payout calculation
      activeContracts: 0, // TODO: Implement active contracts count
      recentTipCount: 0, // TODO: Implement recent tip count
      aiFeatures: {
        enabled: creator?.synthetic_twin_enabled || false,
        totalAiEarningsCents: totalAiEarnings,
        imageGenerations: {
          total: aiAnalytics?.imageGenerations.total || 0,
          completed: aiAnalytics?.imageGenerations.completed || 0,
          earningsCents: aiAnalytics?.imageGenerations.earningsCents || BigInt(0),
        },
        voiceMessages: {
          total: aiAnalytics?.voiceMessages.total || 0,
          completed: aiAnalytics?.voiceMessages.completed || 0,
          earningsCents: aiAnalytics?.voiceMessages.earningsCents || BigInt(0),
        },
        groupChatMessages: {
          total: aiAnalytics?.groupChatMessages.total || 0,
          earningsCents: aiAnalytics?.groupChatMessages.earningsCents || BigInt(0),
        },
        topPerformingFeature,
      },
    };
  }

  /**
   * PHASE7-ITEM1: Toggle AI synthetic twin feature for creator
   */
  async toggleAiFeature(creatorId: string, enabled: boolean): Promise<CreatorAiSettings> {
    const updatedCreator = await prisma.creator.update({
      where: { id: creatorId },
      data: { synthetic_twin_enabled: enabled },
      select: { id: true, synthetic_twin_enabled: true },
    });

    return {
      creatorId: updatedCreator.id,
      syntheticTwinEnabled: updatedCreator.synthetic_twin_enabled,
    };
  }

  /**
   * PHASE7-ITEM1: Request payout for accumulated earnings
   */
  async requestPayout(
    creatorId: string,
    amountCents: bigint,
  ): Promise<{
    payoutId: string;
    status: string;
    amountCents: bigint;
  }> {
    // TODO: Implement actual payout request logic
    // This should integrate with the existing payout system
    // For now, return a stub response
    return {
      payoutId: `PAYOUT-${Date.now()}`,
      status: 'PENDING',
      amountCents,
    };
  }
}
