// services/synthetic-twin/src/group-chat.service.ts
// PHASE3-ITEM2: Group Chat with Synthetic Twins
// Allows fans to create group chats that include multiple participants including
// creator synthetic twins. Synthetic twin messages charge tokens per interaction.

import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';

const prisma = new PrismaClient();

export interface CreateGroupChatRequest {
  name: string;
  hostUserId: string;
  organizationId: string;
  tenantId: string;
}

export interface AddParticipantRequest {
  sessionId: string;
  participantType: 'USER' | 'CREATOR' | 'SYNTHETIC_TWIN';
  userId?: string;
  creatorId?: string;
  displayName: string;
}

export interface SendGroupMessageRequest {
  sessionId: string;
  participantId: string;
  content: string;
  messageType?: 'TEXT' | 'VOICE' | 'IMAGE';
  mediaUri?: string;
}

export interface GroupChatSessionResponse {
  id: string;
  correlationId: string;
  name: string;
  hostUserId: string;
  status: string;
  participantCount: number;
  createdAt: Date;
}

export interface GroupChatMessageResponse {
  id: string;
  correlationId: string;
  sessionId: string;
  participantId: string;
  participantName: string;
  participantType: string;
  content: string;
  messageType: string;
  mediaUri?: string;
  tokensCharged: number;
  createdAt: Date;
}

export class GroupChatService {
  // PHASE3-ITEM2: Cost per AI-generated message in group chat
  private static readonly TOKENS_PER_AI_MESSAGE = 5;
  private static readonly CREATOR_SHARE_PERCENT = 0.7;
  private static readonly CENTS_PER_TOKEN = 9;

  /**
   * PHASE3-ITEM2: Create a new group chat session
   */
  async createGroupChat(request: CreateGroupChatRequest): Promise<GroupChatSessionResponse> {
    const correlationId = `GROUP-${randomUUID()}`;

    const session = await prisma.groupChatSession.create({
      data: {
        correlation_id: correlationId,
        name: request.name,
        host_user_id: request.hostUserId,
        status: 'ACTIVE',
        reason_code: 'GROUP_CHAT_SESSION',
        rule_applied_id: 'GROUP_CHAT_v1',
        organization_id: request.organizationId,
        tenant_id: request.tenantId,
      },
      include: {
        participants: true,
      },
    });

    // Automatically add host as first participant
    await this.addParticipant({
      sessionId: session.id,
      participantType: 'USER',
      userId: request.hostUserId,
      displayName: 'Host',
    });

    return {
      id: session.id,
      correlationId: session.correlation_id,
      name: session.name,
      hostUserId: session.host_user_id,
      status: session.status,
      participantCount: 1,
      createdAt: session.created_at,
    };
  }

  /**
   * PHASE3-ITEM2: Add participant to group chat (including synthetic twins)
   */
  async addParticipant(request: AddParticipantRequest): Promise<void> {
    // Verify session exists and is active
    const session = await prisma.groupChatSession.findUniqueOrThrow({
      where: { id: request.sessionId },
    });

    if (session.status !== 'ACTIVE') {
      throw new Error(`Session ${request.sessionId} is not active`);
    }

    // If adding a synthetic twin, verify creator has it enabled
    if (request.participantType === 'SYNTHETIC_TWIN') {
      if (!request.creatorId) {
        throw new Error('Creator ID required for SYNTHETIC_TWIN participant type');
      }

      const creator = await prisma.creator.findUnique({
        where: { id: request.creatorId },
        select: { synthetic_twin_enabled: true },
      });

      if (!creator?.synthetic_twin_enabled) {
        throw new Error(`Creator ${request.creatorId} does not have synthetic twin enabled`);
      }
    }

    await prisma.groupChatParticipant.create({
      data: {
        session_id: request.sessionId,
        participant_type: request.participantType,
        user_id: request.userId || null,
        creator_id: request.creatorId || null,
        display_name: request.displayName,
        status: 'ACTIVE',
        reason_code: 'GROUP_CHAT_PARTICIPANT',
        rule_applied_id: 'GROUP_CHAT_v1',
      },
    });
  }

  /**
   * PHASE3-ITEM2: Send message in group chat
   * If message is from synthetic twin, deducts tokens from host user
   */
  async sendMessage(request: SendGroupMessageRequest): Promise<GroupChatMessageResponse> {
    const correlationId = `MSG-${randomUUID()}`;

    // Get participant info to determine if this is a synthetic twin message
    const participant = await prisma.groupChatParticipant.findUniqueOrThrow({
      where: { id: request.participantId },
      include: { session: true },
    });

    let tokensCharged = 0;

    // If synthetic twin is sending, charge host user tokens
    if (participant.participant_type === 'SYNTHETIC_TWIN' && participant.creator_id) {
      tokensCharged = GroupChatService.TOKENS_PER_AI_MESSAGE;

      // Deduct tokens from host user's wallet
      const hostUserId = participant.session.host_user_id;
      await this.deductTokensForAIMessage(hostUserId, participant.creator_id, correlationId);
    }

    // Create message record
    const message = await prisma.groupChatMessage.create({
      data: {
        correlation_id: correlationId,
        session_id: request.sessionId,
        participant_id: request.participantId,
        content: request.content,
        message_type: request.messageType || 'TEXT',
        media_uri: request.mediaUri || null,
        tokens_charged: tokensCharged,
        reason_code: 'GROUP_CHAT_MESSAGE',
        rule_applied_id: 'GROUP_CHAT_v1',
      },
    });

    return {
      id: message.id,
      correlationId: message.correlation_id,
      sessionId: message.session_id,
      participantId: message.participant_id,
      participantName: participant.display_name,
      participantType: participant.participant_type,
      content: message.content,
      messageType: message.message_type,
      mediaUri: message.media_uri || undefined,
      tokensCharged: message.tokens_charged,
      createdAt: message.created_at,
    };
  }

  /**
   * PHASE3-ITEM2: Deduct tokens for AI-generated message in group chat
   */
  private async deductTokensForAIMessage(
    userId: string,
    creatorId: string,
    correlationId: string,
  ): Promise<void> {
    const wallet = await prisma.canonicalWallet.findUniqueOrThrow({
      where: { user_id: userId },
    });

    const amount = GroupChatService.TOKENS_PER_AI_MESSAGE;
    let remaining = amount;
    const deductions: { bucket: string; amount: number }[] = [];

    // Three-bucket priority
    if (wallet.bonus_tokens > 0 && remaining > 0) {
      const deduct = Math.min(wallet.bonus_tokens, remaining);
      deductions.push({ bucket: 'bonus', amount: deduct });
      remaining -= deduct;
    }

    if (wallet.membership_tokens > 0 && remaining > 0) {
      const deduct = Math.min(wallet.membership_tokens, remaining);
      deductions.push({ bucket: 'membership', amount: deduct });
      remaining -= deduct;
    }

    if (wallet.purchased_tokens > 0 && remaining > 0) {
      const deduct = Math.min(wallet.purchased_tokens, remaining);
      deductions.push({ bucket: 'purchased', amount: deduct });
      remaining -= deduct;
    }

    if (remaining > 0) {
      throw new Error('Insufficient balance for AI message');
    }

    // Apply deductions
    const updates: Record<string, { decrement: number }> = {};
    for (const { bucket, amount: deductAmount } of deductions) {
      if (bucket === 'bonus') updates.bonus_tokens = { decrement: deductAmount };
      else if (bucket === 'membership') updates.membership_tokens = { decrement: deductAmount };
      else if (bucket === 'purchased') updates.purchased_tokens = { decrement: deductAmount };
    }

    await prisma.canonicalWallet.update({
      where: { user_id: userId },
      data: updates,
    });

    // Create ledger entry for deduction
    await prisma.canonicalLedgerEntry.create({
      data: {
        wallet_id: wallet.id,
        correlation_id: correlationId,
        reason_code: 'AI_GROUP_CHAT_SPEND',
        amount: -amount,
        bucket: deductions[0]?.bucket || 'purchased',
        metadata: { deductions },
        hash_current: correlationId,
      },
    });

    // Record creator earnings
    const totalValueCents = BigInt(amount * GroupChatService.CENTS_PER_TOKEN);
    const creatorEarningsCents = BigInt(
      Math.floor(Number(totalValueCents) * GroupChatService.CREATOR_SHARE_PERCENT),
    );

    await prisma.ledgerEntry.create({
      data: {
        transaction_ref: `GROUP-EARN-${correlationId}`,
        idempotency_key: `${correlationId}-creator-earnings`,
        user_id: userId,
        performer_id: creatorId,
        entry_type: 'GROUP_CHAT_AI_EARNINGS',
        status: 'COMPLETED',
        gross_amount_cents: creatorEarningsCents,
        fee_amount_cents: BigInt(0),
        net_amount_cents: creatorEarningsCents,
        performer_amount_cents: creatorEarningsCents,
        platform_amount_cents: BigInt(0),
        description: 'Creator earnings from group chat AI messages',
        metadata: {
          correlation_id: correlationId,
          service: 'group-chat',
          type: 'ai_group_message',
        },
      },
    });
  }

  /**
   * PHASE3-ITEM2: Get group chat messages
   */
  async getMessages(sessionId: string, limit = 100): Promise<GroupChatMessageResponse[]> {
    const messages = await prisma.groupChatMessage.findMany({
      where: { session_id: sessionId },
      orderBy: { created_at: 'desc' },
      take: limit,
      include: {
        session: {
          include: {
            participants: {
              where: { status: 'ACTIVE' },
            },
          },
        },
      },
    });

    return messages.map((msg) => {
      const participant = msg.session.participants.find((p) => p.id === msg.participant_id);
      return {
        id: msg.id,
        correlationId: msg.correlation_id,
        sessionId: msg.session_id,
        participantId: msg.participant_id,
        participantName: participant?.display_name || 'Unknown',
        participantType: participant?.participant_type || 'USER',
        content: msg.content,
        messageType: msg.message_type,
        mediaUri: msg.media_uri || undefined,
        tokensCharged: msg.tokens_charged,
        createdAt: msg.created_at,
      };
    });
  }

  /**
   * PHASE3-ITEM2: Get user's group chat sessions
   */
  async getUserSessions(userId: string): Promise<GroupChatSessionResponse[]> {
    const sessions = await prisma.groupChatSession.findMany({
      where: {
        OR: [
          { host_user_id: userId },
          {
            participants: {
              some: {
                user_id: userId,
                status: 'ACTIVE',
              },
            },
          },
        ],
      },
      include: {
        participants: {
          where: { status: 'ACTIVE' },
        },
      },
      orderBy: { created_at: 'desc' },
    });

    return sessions.map((session) => ({
      id: session.id,
      correlationId: session.correlation_id,
      name: session.name,
      hostUserId: session.host_user_id,
      status: session.status,
      participantCount: session.participants.length,
      createdAt: session.created_at,
    }));
  }
}

export const groupChatService = new GroupChatService();
