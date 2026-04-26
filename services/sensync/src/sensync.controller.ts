// HZ: SenSync™ REST controller — session lifecycle, consent, samples, purge
import {
  Body,
  Controller,
  Delete,
  Get,
  Logger,
  Param,
  Post,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { SenSyncService } from './sensync.service';
import type {
  MembershipTier,
  SenSyncBiometricPayload,
  SenSyncConsentRecord,
  SenSyncDomain,
  SenSyncHardwareBridge,
  SenSyncPurgeRequest,
  SenSyncSample,
  SenSyncSessionState,
} from './sensync.types';

// ── REST DTOs ─────────────────────────────────────────────────────────────────

export interface OpenSessionDto {
  session_id: string;
  creator_id: string;
  guest_id: string;
  tier: MembershipTier;
  bridge: SenSyncHardwareBridge;
  domain?: SenSyncDomain;
}

export interface GrantConsentDto {
  session_id: string;
  creator_id: string;
  guest_id: string;
  domain?: SenSyncDomain;
  ip_hash?: string;
  device_fingerprint?: string;
  correlation_id: string;
}

export interface RevokeConsentDto {
  session_id: string;
  creator_id: string;
  guest_id: string;
  correlation_id: string;
}

export interface SubmitSampleDto {
  session_id: string;
  creator_id: string;
  guest_id: string;
  bridge: SenSyncHardwareBridge;
  bpm_raw: number;
  tier: MembershipTier;
  domain?: SenSyncDomain;
}

export interface HardwareEventDto {
  session_id: string;
  creator_id: string;
  guest_id: string;
  bridge: SenSyncHardwareBridge;
  event_type: 'CONNECTED' | 'DISCONNECTED';
}

export interface PurgeRequestDto {
  guest_id: string;
  requested_by: string;
  correlation_id: string;
  reason_code: string;
}

export interface PurgeCompleteDto {
  purge_id: string;
  guest_id: string;
  correlation_id: string;
}

// ── Controller ────────────────────────────────────────────────────────────────

@Controller('sensync')
export class SenSyncController {
  private readonly logger = new Logger(SenSyncController.name);

  constructor(private readonly senSync: SenSyncService) {}

  /** POST /sensync/sessions */
  @Post('sessions')
  openSession(@Body() dto: OpenSessionDto): SenSyncSessionState | { error: string } {
    const state = this.senSync.openSession(
      dto.session_id,
      dto.creator_id,
      dto.guest_id,
      dto.tier,
      dto.bridge,
      dto.domain,
    );
    if (!state) {
      return { error: 'SENSYNC_TIER_HARDWARE_DISABLED' };
    }
    return state;
  }

  /** POST /sensync/consent/grant */
  @Post('consent/grant')
  async grantConsent(@Body() dto: GrantConsentDto): Promise<SenSyncConsentRecord> {
    return this.senSync.grantConsent({
      session_id: dto.session_id,
      creator_id: dto.creator_id,
      guest_id: dto.guest_id,
      domain: dto.domain,
      ip_hash: dto.ip_hash,
      device_fingerprint: dto.device_fingerprint,
      correlation_id: dto.correlation_id,
    });
  }

  /** POST /sensync/consent/revoke */
  @Post('consent/revoke')
  async revokeConsent(@Body() dto: RevokeConsentDto): Promise<{ ok: true }> {
    await this.senSync.revokeConsent({
      session_id: dto.session_id,
      creator_id: dto.creator_id,
      guest_id: dto.guest_id,
      correlation_id: dto.correlation_id,
    });
    return { ok: true };
  }

  /** POST /sensync/samples */
  @Post('samples')
  async submitSample(
    @Body() dto: SubmitSampleDto,
  ): Promise<SenSyncBiometricPayload | { ok: false; reason: string }> {
    const sample: SenSyncSample = {
      sample_id: randomUUID(),
      session_id: dto.session_id,
      creator_id: dto.creator_id,
      guest_id: dto.guest_id,
      bridge: dto.bridge,
      bpm_raw: dto.bpm_raw,
      captured_device_ms: Date.now(),
      received_at_utc: new Date().toISOString(),
      tier: dto.tier,
      domain: dto.domain ?? 'ADULT_ENTERTAINMENT',
    };

    const result = await this.senSync.submitSample(sample);
    if (!result) {
      return { ok: false, reason: 'SAMPLE_REJECTED_OR_NO_CONSENT' };
    }
    return result;
  }

  /** DELETE /sensync/sessions/:session_id */
  @Delete('sessions/:session_id')
  closeSession(@Param('session_id') session_id: string): { ok: true } {
    this.senSync.closeSession(session_id);
    return { ok: true };
  }

  /** GET /sensync/sessions/:session_id */
  @Get('sessions/:session_id')
  getSession(
    @Param('session_id') session_id: string,
  ): SenSyncSessionState | { error: string } {
    const state = this.senSync.getSessionState(session_id);
    if (!state) return { error: 'SESSION_NOT_FOUND' };
    return state;
  }

  /** POST /sensync/hardware-events */
  @Post('hardware-events')
  recordHardwareEvent(@Body() dto: HardwareEventDto): { ok: true } {
    this.senSync.recordHardwareEvent({
      session_id: dto.session_id,
      creator_id: dto.creator_id,
      guest_id: dto.guest_id,
      bridge: dto.bridge,
      event_type: dto.event_type,
    });
    return { ok: true };
  }

  /**
   * POST /sensync/purge/request
   * Law 25 §28 / GDPR Art. 17 deletion request.
   * Must be called by an authenticated operator acting on guest's behalf.
   */
  @Post('purge/request')
  async requestPurge(@Body() dto: PurgeRequestDto): Promise<SenSyncPurgeRequest> {
    return this.senSync.requestPurge({
      guest_id: dto.guest_id,
      requested_by: dto.requested_by,
      correlation_id: dto.correlation_id,
      reason_code: dto.reason_code,
    });
  }

  /**
   * POST /sensync/purge/complete
   * Called by the async purge job after sensitive-field nullification.
   */
  @Post('purge/complete')
  async completePurge(@Body() dto: PurgeCompleteDto) {
    return this.senSync.completePurge({
      purge_id: dto.purge_id,
      guest_id: dto.guest_id,
      correlation_id: dto.correlation_id,
    });
  }
}
