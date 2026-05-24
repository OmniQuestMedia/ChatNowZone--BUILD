// services/group-chat/src/group-chat.service.ts
// PHASE3-ITEM2: Group chat with synthetic twins
// Allows fans to add multiple characters (including creator synthetic twins) to one chat
// Keeps all existing performer live-stream features untouched

import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';

const prisma = new PrismaClient();

export interface CreateGroupChatRequest {
  creatorId?: string;
  title?: string;
  initialParticipants: Array<{
    participantId: string;
    participantType: 'USER' | 'SYNTHETIC_TWIN';
  }>;
  organizationId: string;
  tenantId: string;
}

export interface CreateGroupChatResponse {
  id: string;
  correlationId: string;
  conversationType: string;
  title?: string;
  participantCount: number;
}

export interface AddParticipantRequest {
  conversationId: string;
  participantId: string;
  participantType: 'USER' | 'SYNTHETIC_TWIN';
  organizationId: string;
  tenantId: string;
}

export interface SendGroupMessageRequest {
  conversationId: string;
  senderId: string;
  senderType: 'USER' | 'CREATOR' | 'SYNTHETIC_TWIN';
  messageType: 'TEXT' | 'VOICE' | 'IMAGE';
  content?: string;
  voiceUri?: string;
  organizationId: string;
  tenantId: string;
}

export class GroupChatService {
  /**
   * PHASE3-ITEM2: Create a new group chat conversation
   *
   * Flow:
   * 1. Create Conversation record with GROUP type
   * 2. Add all initial participants
   * 3. Return conversation details
   */
  async createGroupChat(request: CreateGroupChatRequest): Promise<CreateGroupChatResponse> {
    const correlationId = `GROUP-${randomUUID()}`;

    // Step 1: Create conversation
    const conversation = await prisma.conversation.create({
      data: {
        correlation_id: correlationId,
        conversation_type: 'GROUP',
        title: request.title || 'Group Chat',
        creator_id: request.creatorId || null,
        status: 'ACTIVE',
        reason_code: 'GROUP_CHAT_CREATED',
        rule_applied_id: 'GROUP_CHAT_v1',
        organization_id: request.organizationId,
        tenant_id: request.tenantId,
      },
    });

    // Step 2: Add initial participants
    for (const participant of request.initialParticipants) {
      await prisma.conversationParticipant.create({
        data: {
          conversation_id: conversation.id,
          participant_id: participant.participantId,
          participant_type: participant.participantType,
          organization_id: request.organizationId,
          tenant_id: request.tenantId,
        },
      });
    }

    return {
      id: conversation.id,
      correlationId: conversation.correlation_id,
      conversationType: conversation.conversation_type,
      title: conversation.title || undefined,
      participantCount: request.initialParticipants.length,
    };
  }

  /**
   * PHASE3-ITEM2: Add a participant to an existing group chat
   *
   * Supports adding:
   * - Additional fans (USER type)
   * - Synthetic twins (SYNTHETIC_TWIN type)
   */
  async addParticipant(request: AddParticipantRequest): Promise<void> {
    // Verify conversation exists and is a group chat
    const conversation = await prisma.conversation.findUnique({
      where: { id: request.conversationId },
      select: { id: true, conversation_type: true, status: true },
    });

    if (!conversation) {
      throw new Error(`Conversation not found: ${request.conversationId}`);
    }

    if (conversation.conversation_type !== 'GROUP') {
      throw new Error(`Cannot add participants to non-group conversation`);
    }

    if (conversation.status !== 'ACTIVE') {
      throw new Error(`Cannot add participants to inactive conversation`);
    }

    // Verify participant doesn't already exist
    const existing = await prisma.conversationParticipant.findUnique({
      where: {
        conversation_id_participant_id: {
          conversation_id: request.conversationId,
          participant_id: request.participantId,
        },
      },
    });

    if (existing && !existing.left_at) {
      throw new Error(`Participant already in conversation`);
    }

    // If participant was previously in conversation and left, re-join them
    if (existing && existing.left_at) {
      await prisma.conversationParticipant.update({
        where: { id: existing.id },
        data: {
          left_at: null,
          joined_at: new Date(),
        },
      });
    } else {
      // Add new participant
      await prisma.conversationParticipant.create({
        data: {
          conversation_id: request.conversationId,
          participant_id: request.participantId,
          participant_type: request.participantType,
          organization_id: request.organizationId,
          tenant_id: request.tenantId,
        },
      });
    }
  }

  /**
   * PHASE3-ITEM2: Remove a participant from a group chat
   */
  async removeParticipant(conversationId: string, participantId: string): Promise<void> {
    const participant = await prisma.conversationParticipant.findUnique({
      where: {
        conversation_id_participant_id: {
          conversation_id: conversationId,
          participant_id: participantId,
        },
      },
    });

    if (!participant) {
      throw new Error(`Participant not found in conversation`);
    }

    // Mark as left (append-only pattern)
    await prisma.conversationParticipant.update({
      where: { id: participant.id },
      data: {
        left_at: new Date(),
      },
    });
  }

  /**
   * PHASE3-ITEM2: Send a message in a group chat
   *
   * Can be sent by:
   * - Fan (USER)
   * - Creator (CREATOR)
   * - Synthetic Twin (SYNTHETIC_TWIN)
   */
  async sendGroupMessage(request: SendGroupMessageRequest): Promise<{
    id: string;
    correlationId: string;
  }> {
    const correlationId = `GMSG-${randomUUID()}`;

    // Verify conversation exists
    const conversation = await prisma.conversation.findUnique({
      where: { id: request.conversationId },
      select: { id: true, status: true },
    });

    if (!conversation) {
      throw new Error(`Conversation not found: ${request.conversationId}`);
    }

    if (conversation.status !== 'ACTIVE') {
      throw new Error(`Conversation is not active`);
    }

    // Verify sender is a participant
    const participant = await prisma.conversationParticipant.findUnique({
      where: {
        conversation_id_participant_id: {
          conversation_id: request.conversationId,
          participant_id: request.senderId,
        },
      },
    });

    if (!participant || participant.left_at) {
      throw new Error(`Sender is not a participant in this conversation`);
    }

    // Create message
    const message = await prisma.chatMessage.create({
      data: {
        correlation_id: correlationId,
        conversation_id: request.conversationId,
        sender_id: request.senderId,
        sender_type: request.senderType,
        message_type: request.messageType,
        content: request.content || null,
        voice_uri: request.voiceUri || null,
        tokens_charged: 0, // No additional charge for text messages in group
        status: 'SENT',
        reason_code: 'GROUP_MESSAGE_SENT',
        rule_applied_id: 'GROUP_CHAT_v1',
        organization_id: request.organizationId,
        tenant_id: request.tenantId,
      },
    });

    return {
      id: message.id,
      correlationId: message.correlation_id,
    };
  }

  /**
   * PHASE3-ITEM2: Get group chat details with participants
   */
  async getGroupChat(conversationId: string): Promise<{
    id: string;
    title?: string;
    status: string;
    participants: Array<{
      participantId: string;
      participantType: string;
      joinedAt: Date;
      isActive: boolean;
    }>;
    messageCount: number;
  }> {
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        participants: true,
        messages: {
          select: { id: true },
        },
      },
    });

    if (!conversation) {
      throw new Error(`Conversation not found: ${conversationId}`);
    }

    return {
      id: conversation.id,
      title: conversation.title || undefined,
      status: conversation.status,
      participants: conversation.participants.map((p) => ({
        participantId: p.participant_id,
        participantType: p.participant_type,
        joinedAt: p.joined_at,
        isActive: !p.left_at,
      })),
      messageCount: conversation.messages.length,
    };
  }

  /**
   * PHASE3-ITEM2: List all group chats for a user
   */
  async listGroupChatsForUser(
    userId: string,
    limit = 50,
  ): Promise<
    Array<{
      id: string;
      title?: string;
      participantCount: number;
      lastMessageAt?: Date;
    }>
  > {
    // Find all conversations where user is a participant
    const participations = await prisma.conversationParticipant.findMany({
      where: {
        participant_id: userId,
        participant_type: 'USER',
        left_at: null,
      },
      include: {
        conversation: {
          include: {
            participants: true,
            messages: {
              orderBy: { created_at: 'desc' },
              take: 1,
            },
          },
        },
      },
      take: limit,
      orderBy: {
        joined_at: 'desc',
      },
    });

    return participations
      .filter((p) => p.conversation.conversation_type === 'GROUP')
      .map((p) => ({
        id: p.conversation.id,
        title: p.conversation.title || undefined,
        participantCount: p.conversation.participants.filter((x) => !x.left_at).length,
        lastMessageAt: p.conversation.messages[0]?.created_at,
      }));
  }
}

export const groupChatService = new GroupChatService();
