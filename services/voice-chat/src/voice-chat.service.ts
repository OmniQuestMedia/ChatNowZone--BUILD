// services/voice-chat/src/voice-chat.service.ts
// PHASE3-ITEM1: Voice Chat with TTS integration for Safe Synthetic Twin
// Supports microphone input, voice responses via TTS, token charging

import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';

const prisma = new PrismaClient();

export interface SendVoiceMessageRequest {
  conversationId: string;
  senderId: string;
  senderType: 'USER' | 'CREATOR' | 'SYNTHETIC_TWIN';
  voiceUri?: string;  // S3 URI to uploaded voice file
  transcript?: string; // Auto-transcription of voice
  voiceDurationMs?: number;
  ttsVoiceId?: string; // For synthetic twin responses
  organizationId: string;
  tenantId: string;
}

export interface SendVoiceMessageResponse {
  id: string;
  correlationId: string;
  conversationId: string;
  tokensCharged: number;
  status: string;
  errorMessage?: string;
}

export interface GenerateTTSRequest {
  conversationId: string;
  syntheticTwinId: string;
  textContent: string;
  voiceId?: string;
  organizationId: string;
  tenantId: string;
}

export class VoiceChatService {
  // PHASE3-ITEM1: Cost configuration for voice messages
  // TODO: Move to GovernanceConfig
  private static readonly TOKENS_PER_VOICE_MESSAGE = 5;  // CZT cost per voice message
  private static readonly TOKENS_PER_TTS_RESPONSE = 8;   // CZT cost for TTS generation
  private static readonly CREATOR_SHARE_PERCENT = 0.7;
  private static readonly CENTS_PER_TOKEN = 9;

  /**
   * PHASE3-ITEM1: Send a voice message in a conversation
   *
   * Flow:
   * 1. Check if conversation exists and is active
   * 2. Check user's token balance if charging applies
   * 3. Create ChatMessage record with voice details
   * 4. Deduct tokens from user's wallet
   * 5. Create ledger entries for creator earnings (if synthetic twin involved)
   * 6. Return message details
   */
  async sendVoiceMessage(request: SendVoiceMessageRequest): Promise<SendVoiceMessageResponse> {
    const correlationId = `VOICE-${randomUUID()}`;

    try {
      // Step 1: Verify conversation exists
      const conversation = await prisma.conversation.findUnique({
        where: { id: request.conversationId },
        select: { id: true, status: true, creator_id: true },
      });

      if (!conversation) {
        throw new Error(`Conversation not found: ${request.conversationId}`);
      }

      if (conversation.status !== 'ACTIVE') {
        throw new Error(`Conversation is not active: ${conversation.status}`);
      }

      // Step 2: Calculate token charge (only for fan->creator or fan->synthetic twin)
      let tokensCharged = 0;
      if (request.senderType === 'USER' && conversation.creator_id) {
        tokensCharged = VoiceChatService.TOKENS_PER_VOICE_MESSAGE;

        // Check balance
        const wallet = await prisma.canonicalWallet.findUnique({
          where: { user_id: request.senderId },
          select: {
            purchased_tokens: true,
            membership_tokens: true,
            bonus_tokens: true,
          },
        });

        if (!wallet) {
          throw new Error(`Wallet not found for user: ${request.senderId}`);
        }

        const totalBalance = wallet.purchased_tokens + wallet.membership_tokens + wallet.bonus_tokens;

        if (totalBalance < tokensCharged) {
          throw new Error(
            `Insufficient balance. Required: ${tokensCharged}, Available: ${totalBalance}`,
          );
        }

        // Deduct tokens
        await this.deductTokensFromWallet(request.senderId, tokensCharged, correlationId);

        // Record creator earnings if applicable
        if (conversation.creator_id) {
          const earningsCents = BigInt(
            Math.floor(tokensCharged * VoiceChatService.CENTS_PER_TOKEN * VoiceChatService.CREATOR_SHARE_PERCENT),
          );
          await this.recordCreatorEarnings(
            conversation.creator_id,
            request.senderId,
            earningsCents,
            correlationId,
            request.organizationId,
            request.tenantId,
          );
        }
      }

      // Step 3: Create message record
      const message = await prisma.chatMessage.create({
        data: {
          correlation_id: correlationId,
          conversation_id: request.conversationId,
          sender_id: request.senderId,
          sender_type: request.senderType,
          message_type: 'VOICE',
          content: request.transcript || null,
          voice_uri: request.voiceUri || null,
          voice_duration_ms: request.voiceDurationMs || null,
          tts_voice_id: request.ttsVoiceId || null,
          tokens_charged: tokensCharged,
          status: 'SENT',
          reason_code: 'VOICE_MESSAGE_SENT',
          rule_applied_id: 'VOICE_CHAT_v1',
          organization_id: request.organizationId,
          tenant_id: request.tenantId,
        },
      });

      return {
        id: message.id,
        correlationId: message.correlation_id,
        conversationId: message.conversation_id,
        tokensCharged: message.tokens_charged,
        status: message.status,
      };
    } catch (error) {
      // On error, create FAILED message for audit trail
      const failedMessage = await prisma.chatMessage.create({
        data: {
          correlation_id: correlationId,
          conversation_id: request.conversationId,
          sender_id: request.senderId,
          sender_type: request.senderType,
          message_type: 'VOICE',
          content: request.transcript || null,
          tokens_charged: 0,
          status: 'FAILED',
          reason_code: 'VOICE_MESSAGE_FAILED',
          rule_applied_id: 'VOICE_CHAT_v1',
          organization_id: request.organizationId,
          tenant_id: request.tenantId,
        },
      });

      return {
        id: failedMessage.id,
        correlationId: failedMessage.correlation_id,
        conversationId: failedMessage.conversation_id,
        tokensCharged: 0,
        status: 'FAILED',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * PHASE3-ITEM1: Generate TTS response from synthetic twin
   *
   * Flow:
   * 1. Check creator has synthetic_twin_enabled
   * 2. Check fan's wallet balance
   * 3. Deduct tokens for TTS generation
   * 4. [STUB] Call TTS API (Banana.dev / ElevenLabs)
   * 5. Create ChatMessage with TTS audio URI
   * 6. Record creator earnings
   */
  async generateTTSResponse(request: GenerateTTSRequest): Promise<SendVoiceMessageResponse> {
    const correlationId = `TTS-${randomUUID()}`;

    try {
      // Step 1: Verify conversation and creator
      const conversation = await prisma.conversation.findUnique({
        where: { id: request.conversationId },
        include: {
          participants: {
            where: { participant_type: 'USER' },
            take: 1,
          },
        },
      });

      if (!conversation) {
        throw new Error(`Conversation not found: ${request.conversationId}`);
      }

      const fanUserId = conversation.participants[0]?.participant_id;
      if (!fanUserId) {
        throw new Error(`No fan user found in conversation`);
      }

      // Verify creator has synthetic twin enabled
      const creator = await prisma.creator.findUnique({
        where: { id: request.syntheticTwinId },
        select: { id: true, synthetic_twin_enabled: true },
      });

      if (!creator?.synthetic_twin_enabled) {
        throw new Error(`Synthetic twin not enabled for creator: ${request.syntheticTwinId}`);
      }

      // Step 2: Deduct tokens from fan
      const tokensCharged = VoiceChatService.TOKENS_PER_TTS_RESPONSE;
      await this.deductTokensFromWallet(fanUserId, tokensCharged, correlationId);

      // Step 3: [STUB] Call TTS API
      // TODO: Integrate actual Banana.dev or ElevenLabs TTS
      const ttsUri = await this.generateTTSAudio(request.textContent, request.voiceId || 'default');

      // Step 4: Create message record
      const message = await prisma.chatMessage.create({
        data: {
          correlation_id: correlationId,
          conversation_id: request.conversationId,
          sender_id: request.syntheticTwinId,
          sender_type: 'SYNTHETIC_TWIN',
          message_type: 'VOICE',
          content: request.textContent,
          voice_uri: ttsUri,
          tts_voice_id: request.voiceId || 'default',
          tokens_charged: tokensCharged,
          status: 'SENT',
          reason_code: 'TTS_RESPONSE_GENERATED',
          rule_applied_id: 'VOICE_CHAT_v1',
          organization_id: request.organizationId,
          tenant_id: request.tenantId,
        },
      });

      // Step 5: Record creator earnings
      const earningsCents = BigInt(
        Math.floor(tokensCharged * VoiceChatService.CENTS_PER_TOKEN * VoiceChatService.CREATOR_SHARE_PERCENT),
      );
      await this.recordCreatorEarnings(
        request.syntheticTwinId,
        fanUserId,
        earningsCents,
        correlationId,
        request.organizationId,
        request.tenantId,
      );

      return {
        id: message.id,
        correlationId: message.correlation_id,
        conversationId: message.conversation_id,
        tokensCharged: message.tokens_charged,
        status: message.status,
      };
    } catch (error) {
      return {
        id: '',
        correlationId,
        conversationId: request.conversationId,
        tokensCharged: 0,
        status: 'FAILED',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * [STUB] Generate TTS audio file
   * TODO: Integrate actual Banana.dev or ElevenLabs API
   */
  private async generateTTSAudio(text: string, voiceId: string): Promise<string> {
    // Simulate TTS generation delay
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Return placeholder S3 URI
    // TODO: Actually call TTS API and upload to S3
    return `s3://voice-chat/tts/${Date.now()}-${voiceId}.mp3`;
  }

  /**
   * Deduct tokens from fan's wallet (same as synthetic-twin service)
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

    // Create ledger entry
    await prisma.canonicalLedgerEntry.create({
      data: {
        wallet_id: wallet.id,
        correlation_id: correlationId,
        reason_code: 'VOICE_CHAT_SPEND',
        amount: -amount,
        bucket: deductions[0]?.bucket || 'purchased',
        metadata: { deductions },
        hash_current: correlationId,
      },
    });
  }

  /**
   * Record creator earnings from voice chat
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
        description: 'Creator earnings from voice chat with Safe Synthetic Twin',
        metadata: {
          correlation_id: correlationId,
          service: 'voice-chat',
          type: 'voice_tts_generation',
        },
      },
    });
  }

  /**
   * PHASE3-ITEM1: Get conversation messages (for displaying chat history)
   */
  async getConversationMessages(
    conversationId: string,
    limit = 100,
  ): Promise<Array<{
    id: string;
    senderId: string;
    senderType: string;
    messageType: string;
    content?: string;
    voiceUri?: string;
    voiceDurationMs?: number;
    tokensCharged: number;
    createdAt: Date;
  }>> {
    const messages = await prisma.chatMessage.findMany({
      where: { conversation_id: conversationId },
      orderBy: { created_at: 'desc' },
      take: limit,
    });

    return messages.map((msg) => ({
      id: msg.id,
      senderId: msg.sender_id,
      senderType: msg.sender_type,
      messageType: msg.message_type,
      content: msg.content || undefined,
      voiceUri: msg.voice_uri || undefined,
      voiceDurationMs: msg.voice_duration_ms || undefined,
      tokensCharged: msg.tokens_charged,
      createdAt: msg.created_at,
    }));
  }
}

export const voiceChatService = new VoiceChatService();
