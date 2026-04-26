// SenSync™ — REST controller
// Diamond-tier gated endpoints for consent management and device pairing.
import {
  Body,
  Controller,
  Delete,
  Get,
  Logger,
  Param,
  Post,
} from '@nestjs/common';
import { SenSyncService } from './sensync.service';
import type { ConsentPurposeScope, HapticDriver, MembershipTier, SenSyncMode } from './sensync.types';

@Controller('sensync')
export class SenSyncController {
  private readonly logger = new Logger(SenSyncController.name);

  constructor(private readonly senSyncService: SenSyncService) {}

  /**
   * POST /sensync/session
   * Open a SenSync™ relay session (Diamond-tier only — enforced by gateway).
   */
  @Post('session')
  openSession(
    @Body()
    body: {
      session_id: string;
      creator_id: string;
      guest_id: string;
      tier: MembershipTier;
      mode: SenSyncMode;
      driver: HapticDriver;
    },
  ) {
    this.logger.log('SenSyncController.openSession', {
      session_id: body.session_id,
      tier: body.tier,
    });
    return this.senSyncService.openSession(
      body.session_id,
      body.creator_id,
      body.guest_id,
      body.tier,
      body.mode,
      body.driver,
    );
  }

  /**
   * POST /sensync/session/:sessionId/consent
   * Record explicit opt-in consent (plain-language disclosure confirmed).
   */
  @Post('session/:sessionId/consent')
  async grantConsent(
    @Param('sessionId') sessionId: string,
    @Body()
    body: {
      guest_id: string;
      creator_id: string;
      purpose_scope?: ConsentPurposeScope;
      device_ids?: string[];
      ip_hash?: string;
      device_fingerprint?: string;
    },
  ) {
    this.logger.log('SenSyncController.grantConsent', {
      session_id: sessionId,
      guest_id: body.guest_id,
    });
    return this.senSyncService.grantConsent(
      sessionId,
      body.guest_id,
      body.creator_id,
      body.purpose_scope,
      body.device_ids,
      body.ip_hash,
      body.device_fingerprint,
    );
  }

  /**
   * DELETE /sensync/session/:sessionId/consent
   * Revoke consent immediately — stops all biometric publishing < 500 ms.
   */
  @Delete('session/:sessionId/consent')
  async revokeConsent(
    @Param('sessionId') sessionId: string,
    @Body() body: { guest_id: string; creator_id: string },
  ) {
    this.logger.log('SenSyncController.revokeConsent', {
      session_id: sessionId,
      guest_id: body.guest_id,
    });
    await this.senSyncService.revokeConsent(sessionId, body.guest_id, body.creator_id);
    return { session_id: sessionId, revoked: true };
  }

  /**
   * DELETE /sensync/session/:sessionId
   * Close session — purges all ephemeral biometric data.
   */
  @Delete('session/:sessionId')
  closeSession(@Param('sessionId') sessionId: string) {
    this.senSyncService.closeSession(sessionId);
    return { session_id: sessionId, closed: true };
  }

  /**
   * GET /sensync/session/:sessionId
   * Return ephemeral session state (BPM values excluded for privacy).
   */
  @Get('session/:sessionId')
  getSessionState(@Param('sessionId') sessionId: string) {
    const state = this.senSyncService.getSessionState(sessionId);
    if (!state) {
      return { message: 'Session not found', session_id: sessionId };
    }
    return state;
  }
}
