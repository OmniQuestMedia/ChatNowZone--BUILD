// HZ: SenSync™ REST controller — session management + consent endpoints
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
  HapticDriver,
  SenSyncCombinedBpm,
  SenSyncConsent,
  SenSyncMode,
  SenSyncRelayEvent,
  SenSyncSample,
  SenSyncSessionState,
  MembershipTier,
} from './sensync.types';

// ── REST DTOs ─────────────────────────────────────────────────────────────────

export interface OpenSessionDto {
  session_id: string;
  creator_id: string;
  guest_id: string;
  tier: MembershipTier;
  mode: SenSyncMode;
  driver: HapticDriver;
}

export interface GrantConsentDto {
  session_id: string;
  guest_id: string;
  creator_id: string;
  ip_hash?: string;
  device_fingerprint?: string;
}

export interface RevokeConsentDto {
  session_id: string;
  guest_id: string;
  creator_id: string;
}

export interface SubmitSampleDto {
  session_id: string;
  creator_id: string;
  guest_id: string;
  source: 'CREATOR' | 'GUEST';
  bpm_raw: number;
  driver: HapticDriver;
  tier: MembershipTier;
}

export interface RefreshTierConfigDto {
  /** Operator auth token — validated by caller middleware. */
  operator_id: string;
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
      dto.mode,
      dto.driver,
    );
    if (!state) {
      return { error: 'SENSYNC_TIER_DISABLED_OR_COMBINED_NOT_PERMITTED' };
    }
    return state;
  }

  /** POST /sensync/consent/grant */
  @Post('consent/grant')
  grantConsent(@Body() dto: GrantConsentDto): SenSyncConsent {
    return this.senSync.grantConsent(
      dto.session_id,
      dto.guest_id,
      dto.creator_id,
      dto.ip_hash,
      dto.device_fingerprint,
    );
  }

  /** POST /sensync/consent/revoke */
  @Post('consent/revoke')
  revokeConsent(@Body() dto: RevokeConsentDto): { ok: true } {
    this.senSync.revokeConsent(dto.session_id, dto.guest_id, dto.creator_id);
    return { ok: true };
  }

  /** POST /sensync/samples */
  @Post('samples')
  submitSample(@Body() dto: SubmitSampleDto): SenSyncRelayEvent | SenSyncCombinedBpm | { ok: false; reason: string } {
    const sample: SenSyncSample = {
      sample_id: randomUUID(),
      session_id: dto.session_id,
      creator_id: dto.creator_id,
      guest_id: dto.guest_id,
      source: dto.source,
      bpm_raw: dto.bpm_raw,
      captured_device_ms: Date.now(),
      received_at_utc: new Date().toISOString(),
      driver: dto.driver,
      tier: dto.tier,
    };

    const result = this.senSync.submitSample(sample);
    if (!result) {
      return { ok: false, reason: 'SAMPLE_REJECTED_OR_NO_SESSION' };
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
  getSession(@Param('session_id') session_id: string): SenSyncSessionState | { error: string } {
    const state = this.senSync.getSessionState(session_id);
    if (!state) {
      return { error: 'SESSION_NOT_FOUND' };
    }
    return state;
  }

  /** POST /sensync/tier-config/refresh */
  @Post('tier-config/refresh')
  async refreshTierConfig(@Body() _dto: RefreshTierConfigDto): Promise<{ ok: true }> {
    await this.senSync.refreshTierConfig();
    return { ok: true };
  }
}


