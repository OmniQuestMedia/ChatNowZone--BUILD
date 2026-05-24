// services/synthetic-twin/src/synthetic-twin.service.ts
// PHASE2-440: Safe Synthetic Twin AI image generation service
// Implements minimal viable stub for image generation with proper token deduction
// and creator earnings. Actual ML pipeline to be integrated from SynthiMatesAi.

import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';

const prisma = new PrismaClient();

export interface GenerateImageRequest {
  userId: string;
  creatorId: string;
  prompt?: string;
  organizationId: string;
  tenantId: string;
}

export interface GenerateImageResponse {
  id: string;
  correlationId: string;
  status: 'PENDING' | 'COMPLETED' | 'FAILED';
  imageUri?: string;
  tokensCharged: number;
  creatorEarningsCents: bigint;
  errorMessage?: string;
}

export class SyntheticTwinService {
  // PHASE2-440-ITEM2: Revenue sharing configuration
  // Creator gets 70% of token value, platform gets 30%
  private static readonly CREATOR_SHARE_PERCENT = 0.7;
  private static readonly PLATFORM_SHARE_PERCENT = 0.3;

  // PHASE2-440-ITEM1: Cost per AI image generation (in CZT tokens)
  // TODO: Make this configurable via GovernanceConfig
  private static readonly TOKENS_PER_GENERATION = 10;

  // Token value in cents USD (average market rate)
  // TODO: Integrate with actual token pricing from Diamond Concierge
  private static readonly CENTS_PER_TOKEN = 9;

  /**
   * PHASE2-440-ITEM1: Generate AI image for a fan using creator's synthetic twin
   *
   * Flow:
   * 1. Check creator has synthetic_twin_enabled = true
   * 2. Check fan has sufficient CZT token balance
   * 3. Deduct tokens from fan's three-bucket wallet
   * 4. Create SyntheticTwinGeneration record (PENDING)
   * 5. Create ledger entries for creator earnings
   * 6. [STUB] Trigger actual ML pipeline (placeholder for SynthiMatesAi integration)
   * 7. Update generation record to COMPLETED with image_uri
   *
   * @param request Generation request parameters
   * @returns Generation response with status and details
   */
  async generateImage(request: GenerateImageRequest): Promise<GenerateImageResponse> {
    const correlationId = `SYNTWIN-${randomUUID()}`;

    try {
      // Step 1: Verify creator has synthetic twin enabled
      const creator = await prisma.creator.findUnique({
        where: { id: request.creatorId },
        select: { id: true, synthetic_twin_enabled: true },
      });

      if (!creator) {
        throw new Error(`Creator not found: ${request.creatorId}`);
      }

      if (!creator.synthetic_twin_enabled) {
        throw new Error(`Creator ${request.creatorId} has not enabled synthetic twins`);
      }

      // Step 2: Check fan's wallet balance
      const wallet = await prisma.canonicalWallet.findUnique({
        where: { user_id: request.userId },
        select: {
          purchased_tokens: true,
          membership_tokens: true,
          bonus_tokens: true,
        },
      });

      if (!wallet) {
        throw new Error(`Wallet not found for user: ${request.userId}`);
      }

      const totalBalance = wallet.purchased_tokens + wallet.membership_tokens + wallet.bonus_tokens;

      if (totalBalance < SyntheticTwinService.TOKENS_PER_GENERATION) {
        throw new Error(
          `Insufficient balance. Required: ${SyntheticTwinService.TOKENS_PER_GENERATION}, Available: ${totalBalance}`,
        );
      }

      // Step 3: Calculate earnings split
      const totalValueCents = BigInt(
        SyntheticTwinService.TOKENS_PER_GENERATION * SyntheticTwinService.CENTS_PER_TOKEN,
      );
      const creatorEarningsCents = BigInt(
        Math.floor(Number(totalValueCents) * SyntheticTwinService.CREATOR_SHARE_PERCENT),
      );
      const platformShareCents = totalValueCents - creatorEarningsCents;

      // Step 4: Create generation record (PENDING status)
      const generation = await prisma.syntheticTwinGeneration.create({
        data: {
          correlation_id: correlationId,
          user_id: request.userId,
          creator_id: request.creatorId,
          tokens_charged: SyntheticTwinService.TOKENS_PER_GENERATION,
          creator_earnings_cents: creatorEarningsCents,
          platform_share_cents: platformShareCents,
          status: 'PENDING',
          prompt: request.prompt || null,
          reason_code: 'AI_IMAGE_GENERATION',
          rule_applied_id: 'SYNTHETIC_TWIN_v1',
          organization_id: request.organizationId,
          tenant_id: request.tenantId,
        },
      });

      // Step 5: Deduct tokens from fan's wallet using three-bucket priority
      await this.deductTokensFromWallet(
        request.userId,
        SyntheticTwinService.TOKENS_PER_GENERATION,
        correlationId,
      );

      // Step 6: Create ledger entry for creator earnings
      await this.recordCreatorEarnings(
        request.creatorId,
        request.userId,
        creatorEarningsCents,
        correlationId,
        request.organizationId,
        request.tenantId,
      );

      // Step 7: [STUB] Trigger ML pipeline
      // TODO: Integrate actual SafeSyntheticWizard pipeline from SynthiMatesAi
      // For now, simulate async generation with a placeholder
      // eslint-disable-next-line no-console
      this.simulateImageGeneration(generation.id, correlationId).catch(console.error);

      return {
        id: generation.id,
        correlationId: generation.correlation_id,
        status: generation.status as 'PENDING' | 'COMPLETED' | 'FAILED',
        tokensCharged: generation.tokens_charged,
        creatorEarningsCents: generation.creator_earnings_cents,
      };
    } catch (error) {
      // On error, create FAILED generation record for audit trail
      const failedGeneration = await prisma.syntheticTwinGeneration.create({
        data: {
          correlation_id: correlationId,
          user_id: request.userId,
          creator_id: request.creatorId,
          tokens_charged: 0,
          creator_earnings_cents: BigInt(0),
          platform_share_cents: BigInt(0),
          status: 'FAILED',
          prompt: request.prompt || null,
          error_message: error instanceof Error ? error.message : 'Unknown error',
          reason_code: 'AI_IMAGE_GENERATION_FAILED',
          rule_applied_id: 'SYNTHETIC_TWIN_v1',
          organization_id: request.organizationId,
          tenant_id: request.tenantId,
        },
      });

      return {
        id: failedGeneration.id,
        correlationId: failedGeneration.correlation_id,
        status: 'FAILED',
        tokensCharged: 0,
        creatorEarningsCents: BigInt(0),
        errorMessage: failedGeneration.error_message || undefined,
      };
    }
  }

  /**
   * PHASE2-440-ITEM1: Deduct tokens from fan's wallet
   * Uses three-bucket priority: PROMOTIONAL_BONUS → MEMBERSHIP_ALLOCATION → PURCHASED
   */
  private async deductTokensFromWallet(
    userId: string,
    amount: number,
    correlationId: string,
  ): Promise<void> {
    const wallet = await prisma.canonicalWallet.findUniqueOrThrow({
      where: { user_id: userId },
    });

    let remaining = amount;
    const deductions: { bucket: string; amount: number }[] = [];

    // Priority 1: Bonus tokens
    if (wallet.bonus_tokens > 0 && remaining > 0) {
      const deduct = Math.min(wallet.bonus_tokens, remaining);
      deductions.push({ bucket: 'bonus', amount: deduct });
      remaining -= deduct;
    }

    // Priority 2: Membership tokens
    if (wallet.membership_tokens > 0 && remaining > 0) {
      const deduct = Math.min(wallet.membership_tokens, remaining);
      deductions.push({ bucket: 'membership', amount: deduct });
      remaining -= deduct;
    }

    // Priority 3: Purchased tokens
    if (wallet.purchased_tokens > 0 && remaining > 0) {
      const deduct = Math.min(wallet.purchased_tokens, remaining);
      deductions.push({ bucket: 'purchased', amount: deduct });
      remaining -= deduct;
    }

    if (remaining > 0) {
      throw new Error('Insufficient balance after deduction calculation');
    }

    // Apply deductions atomically
    const updates: Record<string, { decrement: number }> = {};
    for (const { bucket, amount: deductAmount } of deductions) {
      if (bucket === 'bonus') {
        updates.bonus_tokens = { decrement: deductAmount };
      } else if (bucket === 'membership') {
        updates.membership_tokens = { decrement: deductAmount };
      } else if (bucket === 'purchased') {
        updates.purchased_tokens = { decrement: deductAmount };
      }
    }

    await prisma.canonicalWallet.update({
      where: { user_id: userId },
      data: updates,
    });

    // Create ledger entry for the deduction
    await prisma.canonicalLedgerEntry.create({
      data: {
        wallet_id: wallet.id,
        correlation_id: correlationId,
        reason_code: 'AI_IMAGE_GENERATION_SPEND',
        amount: -amount, // Negative for debit
        bucket: deductions[0]?.bucket || 'purchased', // Primary bucket used
        metadata: { deductions },
        hash_current: correlationId, // Simplified hash for MVP
      },
    });
  }

  /**
   * PHASE2-440-ITEM2: Record creator earnings from synthetic twin generation
   */
  private async recordCreatorEarnings(
    creatorId: string,
    userId: string,
    earningsCents: bigint,
    correlationId: string,
    _organizationId: string,
    _tenantId: string,
  ): Promise<void> {
    // Create ledger entry for creator earnings
    await prisma.ledgerEntry.create({
      data: {
        transaction_ref: `SYNTWIN-EARN-${correlationId}`,
        idempotency_key: `${correlationId}-creator-earnings`,
        user_id: userId,
        performer_id: creatorId,
        entry_type: 'SYNTHETIC_TWIN_EARNINGS',
        status: 'COMPLETED',
        gross_amount_cents: earningsCents,
        fee_amount_cents: BigInt(0),
        net_amount_cents: earningsCents,
        performer_amount_cents: earningsCents,
        platform_amount_cents: BigInt(0),
        description: 'Creator earnings from Safe Synthetic Twin AI image generation',
        metadata: {
          correlation_id: correlationId,
          service: 'synthetic-twin',
          type: 'ai_image_generation',
        },
      },
    });
  }

  /**
   * [STUB] Simulate image generation
   * TODO: Replace with actual SafeSyntheticWizard ML pipeline integration
   */
  private async simulateImageGeneration(
    generationId: string,
    correlationId: string,
  ): Promise<void> {
    // Simulate async generation delay (2-5 seconds)
    await new Promise((resolve) => setTimeout(resolve, 2000 + Math.random() * 3000));

    // Update to COMPLETED with placeholder image URI
    // TODO: Replace with actual S3/storage URI from ML pipeline
    await prisma.syntheticTwinGeneration.update({
      where: { id: generationId },
      data: {
        status: 'COMPLETED',
        image_uri: `s3://synthetic-twins/${correlationId}/generated.png`,
        updated_at: new Date(),
      },
    });
  }

  /**
   * PHASE2-440-ITEM5: Get generation history for a user
   */
  async getGenerationHistory(userId: string, limit = 50): Promise<GenerateImageResponse[]> {
    const generations = await prisma.syntheticTwinGeneration.findMany({
      where: { user_id: userId },
      orderBy: { created_at: 'desc' },
      take: limit,
    });

    return generations.map((gen) => ({
      id: gen.id,
      correlationId: gen.correlation_id,
      status: gen.status as 'PENDING' | 'COMPLETED' | 'FAILED',
      imageUri: gen.image_uri || undefined,
      tokensCharged: gen.tokens_charged,
      creatorEarningsCents: gen.creator_earnings_cents,
      errorMessage: gen.error_message || undefined,
    }));
  }

  /**
   * PHASE2-440-ITEM2: Get creator earnings from synthetic twins
   */
  async getCreatorEarnings(
    creatorId: string,
    limit = 100,
  ): Promise<{
    totalEarningsCents: bigint;
    generationCount: number;
    recentGenerations: Array<{
      id: string;
      userId: string;
      tokensCharged: number;
      earningsCents: bigint;
      createdAt: Date;
    }>;
  }> {
    const generations = await prisma.syntheticTwinGeneration.findMany({
      where: {
        creator_id: creatorId,
        status: 'COMPLETED',
      },
      orderBy: { created_at: 'desc' },
      take: limit,
    });

    const totalEarningsCents = generations.reduce(
      (sum, gen) => sum + gen.creator_earnings_cents,
      BigInt(0),
    );

    return {
      totalEarningsCents,
      generationCount: generations.length,
      recentGenerations: generations.map((gen) => ({
        id: gen.id,
        userId: gen.user_id,
        tokensCharged: gen.tokens_charged,
        earningsCents: gen.creator_earnings_cents,
        createdAt: gen.created_at,
      })),
    };
  }
}

export const syntheticTwinService = new SyntheticTwinService();
