// PHASE3-ITEM4: Admin moderation service stub
// NOTE: This service is scaffolded but not fully implemented.
// Prisma models chatMessage, conversation, conversationParticipant do not exist yet.
// This stub prevents TypeScript compilation errors during testing pass.

import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class AdminModerationService {
  private readonly logger = new Logger(AdminModerationService.name);

  constructor() {
    this.logger.warn('AdminModerationService is a stub - not fully implemented');
  }

  // Stub methods - to be implemented when Prisma models are added
  async getChatMessages() {
    throw new Error('AdminModerationService.getChatMessages not implemented');
  }

  async moderateContent() {
    throw new Error('AdminModerationService.moderateContent not implemented');
  }

  async flagMessage() {
    throw new Error('AdminModerationService.flagMessage not implemented');
  }
}
