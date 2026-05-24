// services/synthetic-twin/src/voice-chat.service.ts
// PHASE3-ITEM1: Voice Chat Integration with Safe Synthetic Twin TTS pipeline
// Implements voice message support with proper token deduction and creator earnings.
// Uses existing Banana.dev / ElevenLabs TTS integration (stub for MVP).

import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';

const prisma = new PrismaClient();

export interface SendVoiceMessageRequest {
  userId: string;
  creatorId: string;
  inputAudioUri?: string;
  inputTranscript?: string;
  organizationId: string;
  tenantId: string;
}

export interface VoiceMessageResponse {
  id: string;
  correlationId: string;
  status: 'PENDING' | 'COMPLETED' | 'FAILED';
  inputAudioUri?: string;
  outputAudioUri?: string;
  inputTranscript?: string;
  outputTranscript?: string;
  tokensCharged: number;
  creatorEarningsCents: bigint;
  errorMessage?: string;
}

export class VoiceChatService {
  // PHASE3-ITEM1: Revenue sharing configuration (same as image generation)
  private static readonly CREATOR_SHARE_PERCENT = 0.7;
  private static readonly PLATFORM_SHARE_PERCENT = 0.3;

  // PHASE3-ITEM1: Cost per voice interaction (in CZT tokens)
  // Voice is more expensive than images due to TTS processing
  private static readonly TOKENS_PER_VOICE_MESSAGE = 15;

  // Token value in cents USD (average market rate)
  private static readonly CENTS_PER_TOKEN = 9;

  /**
   * PHASE3-ITEM1: Send voice message and receive synthetic twin TTS response
   *
   * Flow:
   * 1. Check creator has synthetic_twin_enabled = true
   * 2. Check fan has sufficient CZT token balance
   * 3. Deduct tokens from fan's three-bucket wallet
   * 4. Create VoiceChatMessage record (PENDING)
   * 5. Create ledger entries for creator earnings
   * 6. [STUB] Transcribe input audio (if needed)
   * 7. [STUB] Generate TTS response via Banana.dev / ElevenLabs
   * 8. Update record to COMPLETED with audio URIs and transcripts
   */
  async sendVoiceMessage(request: SendVoiceMessageRequest): Promise<VoiceMessageResponse> {
    const correlationId = `VOICE-${randomUUID()}`;

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

      if (totalBalance < VoiceChatService.TOKENS_PER_VOICE_MESSAGE) {
        throw new Error(
          `Insufficient balance. Required: ${VoiceChatService.TOKENS_PER_VOICE_MESSAGE}, Available: ${totalBalance}`,
        );
      }

      // Step 3: Calculate earnings split
      const totalValueCents = BigInt(
        VoiceChatService.TOKENS_PER_VOICE_MESSAGE * VoiceChatService.CENTS_PER_TOKEN,
      );
      const creatorEarningsCents = BigInt(
        Math.floor(Number(totalValueCents) * VoiceChatService.CREATOR_SHARE_PERCENT),
      );
      const platformShareCents = totalValueCents - creatorEarningsCents;

      // Step 4: Create voice message record (PENDING status)
      const voiceMessage = await prisma.voiceChatMessage.create({
        data: {
          correlation_id: correlationId,
          user_id: request.userId,
          creator_id: request.creatorId,
          input_audio_uri: request.inputAudioUri || null,
          input_transcript: request.inputTranscript || null,
          tokens_charged: VoiceChatService.TOKENS_PER_VOICE_MESSAGE,
          creator_earnings_cents: creatorEarningsCents,
          platform_share_cents: platformShareCents,
          status: 'PENDING',
          reason_code: 'AI_VOICE_CHAT',
          rule_applied_id: 'VOICE_CHAT_v1',
          organization_id: request.organizationId,
          tenant_id: request.tenantId,
        },
      });

      // Step 5: Deduct tokens from fan's wallet
      await this.deductTokensFromWallet(
        request.userId,
        VoiceChatService.TOKENS_PER_VOICE_MESSAGE,
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

      // Step 7: [STUB] Process voice message (transcription + TTS response)
      // TODO: Integrate actual speech-to-text and TTS pipeline
      this.processVoiceMessage(voiceMessage.id, correlationId, request.inputTranscript).catch(
        () => {
          // Background processing - errors logged in processVoiceMessage
        },
      );

      return {
        id: voiceMessage.id,
        correlationId: voiceMessage.correlation_id,
        status: voiceMessage.status as 'PENDING' | 'COMPLETED' | 'FAILED',
        inputAudioUri: voiceMessage.input_audio_uri || undefined,
        tokensCharged: voiceMessage.tokens_charged,
        creatorEarningsCents: voiceMessage.creator_earnings_cents,
      };
    } catch (error) {
      // On error, create FAILED record for audit trail
      const failedMessage = await prisma.voiceChatMessage.create({
        data: {
          correlation_id: correlationId,
          user_id: request.userId,
          creator_id: request.creatorId,
          input_audio_uri: request.inputAudioUri || null,
          input_transcript: request.inputTranscript || null,
          tokens_charged: 0,
          creator_earnings_cents: BigInt(0),
          platform_share_cents: BigInt(0),
          status: 'FAILED',
          error_message: error instanceof Error ? error.message : 'Unknown error',
          reason_code: 'AI_VOICE_CHAT_FAILED',
          rule_applied_id: 'VOICE_CHAT_v1',
          organization_id: request.organizationId,
          tenant_id: request.tenantId,
        },
      });

      return {
        id: failedMessage.id,
        correlationId: failedMessage.correlation_id,
        status: 'FAILED',
        tokensCharged: 0,
        creatorEarningsCents: BigInt(0),
        errorMessage: failedMessage.error_message || undefined,
      };
    }
  }

  /**
   * PHASE3-ITEM1: Deduct tokens from fan's wallet
   * Reuses three-bucket priority: PROMOTIONAL_BONUS → MEMBERSHIP_ALLOCATION → PURCHASED
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
        reason_code: 'AI_VOICE_CHAT_SPEND',
        amount: -amount,
        bucket: deductions[0]?.bucket || 'purchased',
        metadata: { deductions },
        hash_current: correlationId,
      },
    });
  }

  /**
   * PHASE3-ITEM1: Record creator earnings from voice chat
   */
  private async recordCreatorEarnings(
    creatorId: string,
    userId: string,
    earningsCents: bigint,
    correlationId: string,
    _organizationId: string,
    _tenantId: string,
  ): Promise<void> {
    await prisma.ledgerEntry.create({
      data: {
        transaction_ref: `VOICE-EARN-${correlationId}`,
        idempotency_key: `${correlationId}-creator-earnings`,
        user_id: userId,
        performer_id: creatorId,
        entry_type: 'VOICE_CHAT_EARNINGS',
        status: 'COMPLETED',
        gross_amount_cents: earningsCents,
        fee_amount_cents: BigInt(0),
        net_amount_cents: earningsCents,
        performer_amount_cents: earningsCents,
        platform_amount_cents: BigInt(0),
        description: 'Creator earnings from Safe Synthetic Twin voice chat',
        metadata: {
          correlation_id: correlationId,
          service: 'voice-chat',
          type: 'ai_voice_message',
        },
      },
    });
  }

  /**
   * [STUB] Process voice message - transcription + TTS response
   * TODO: Integrate actual Banana.dev / ElevenLabs TTS pipeline
   */
  private async processVoiceMessage(
    messageId: string,
    correlationId: string,
    inputTranscript?: string,
  ): Promise<void> {
    // Simulate async processing delay
    await new Promise((resolve) => setTimeout(resolve, 2000 + Math.random() * 3000));

    // Step 1: [STUB] Transcribe input audio if not provided
    const transcript = inputTranscript || 'Transcribed fan message (stub)';

    // Step 2: [STUB] Generate synthetic twin response text
    const responseText = `Thank you for your message! This is a synthetic twin response.`;

    // Step 3: [STUB] Generate TTS audio via Banana.dev / ElevenLabs
    const outputAudioUri = `s3://voice-chat/${correlationId}/response.mp3`;

    // Update to COMPLETED with output
    await prisma.voiceChatMessage.update({
      where: { id: messageId },
      data: {
        status: 'COMPLETED',
        input_transcript: transcript,
        output_transcript: responseText,
        output_audio_uri: outputAudioUri,
        updated_at: new Date(),
      },
    });
  }

  /**
   * PHASE3-ITEM1: Get voice chat history for a user
   */
  async getVoiceHistory(userId: string, limit = 50): Promise<VoiceMessageResponse[]> {
    const messages = await prisma.voiceChatMessage.findMany({
      where: { user_id: userId },
      orderBy: { created_at: 'desc' },
      take: limit,
    });

    return messages.map((msg) => ({
      id: msg.id,
      correlationId: msg.correlation_id,
      status: msg.status as 'PENDING' | 'COMPLETED' | 'FAILED',
      inputAudioUri: msg.input_audio_uri || undefined,
      outputAudioUri: msg.output_audio_uri || undefined,
      inputTranscript: msg.input_transcript || undefined,
      outputTranscript: msg.output_transcript || undefined,
      tokensCharged: msg.tokens_charged,
      creatorEarningsCents: msg.creator_earnings_cents,
      errorMessage: msg.error_message || undefined,
    }));
  }
}

export const voiceChatService = new VoiceChatService();
