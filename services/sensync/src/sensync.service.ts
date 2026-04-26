// HZ: SenSync™ biometric layer — core service
// Business Plan §HZ — Diamond-tier opt-in BPM pipeline with persistent consent,
// Law 25 / PIPEDA / GDPR compliance, and non-adult domain extension points.
//
// Contract:
//   • openSession: validates tier, registers ephemeral session state.
//   • grantConsent: persists SenSyncConsent to Postgres; emits NATS event.
//   • revokeConsent: marks consent revoked in DB; clears session state.
//   • submitSample: plausibility filter [30..220], normalize, publish
//     sensync.biometric.data for FFS scoring (only if consent is active).
//   • requestPurge: Law 25 §28 data deletion — writes purge_requested_at
//     on all consent rows for the guest, emits SENSYNC_PURGE_REQUESTED.
//   • Hardware tiers: only VIP_DIAMOND may use hardware bridges. Other tiers
//     receive TIER_SENSYNC_HARDWARE_DISABLED and the session is rejected.

import { BadRequestException, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { NatsService } from '../../core-api/src/nats/nats.service';
import { PrismaService } from '../../core-api/src/prisma.service';
import { NATS_TOPICS } from '../../nats/topics.registry';
import {
  SENSYNC_BPM_MAX,
  SENSYNC_BPM_MIN,
  SENSYNC_CONSENT_VERSION,
  SENSYNC_HARDWARE_TIERS,
  SENSYNC_RULE_ID,
  type MembershipTier,
  type SenSyncBiometricPayload,
  type SenSyncConsentBasis,
  type SenSyncConsentRecord,
  type SenSyncDomain,
  type SenSyncHardwareBridge,
  type SenSyncHardwareEvent,
  type SenSyncPlausibilityRejection,
  type SenSyncPurgeCompleted,
  type SenSyncPurgeRequest,
  type SenSyncSample,
  type SenSyncSessionState,
  type SenSyncTierDisabledEvent,
  type SenSyncValidSample,
} from './sensync.types';

@Injectable()
export class SenSyncService implements OnModuleInit {
  private readonly logger = new Logger(SenSyncService.name);

  /** Ephemeral in-session state — never persisted directly. */
  private readonly sessions = new Map<string, SenSyncSessionState>();

  /** Consent cache keyed by `${session_id}:${guest_id}`. */
  private readonly consentCache = new Map<string, boolean>();

  constructor(
    private readonly nats: NatsService,
    private readonly prisma: PrismaService,
  ) {}

  async onModuleInit(): Promise<void> {
    this.logger.log('SenSyncService: initialized', {
      consent_version: SENSYNC_CONSENT_VERSION,
      hardware_tiers: SENSYNC_HARDWARE_TIERS,
    });
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  /**
   * Open a SenSync session. Hardware bridge sessions are Diamond-tier only.
   * Returns the initial session state or null if tier is ineligible.
   */
  openSession(
    session_id: string,
    creator_id: string,
    guest_id: string,
    tier: MembershipTier,
    bridge: SenSyncHardwareBridge,
    domain: SenSyncDomain = 'ADULT_ENTERTAINMENT',
  ): SenSyncSessionState | null {
    // Hardware bridges (Lovense, WebUSB, WebBluetooth) require VIP_DIAMOND.
    const isHardware = bridge !== 'PHONE_HAPTIC';
    if (isHardware && !this.isTierEligible(tier)) {
      this.emitTierDisabled(session_id, guest_id, tier);
      return null;
    }

    const state: SenSyncSessionState = {
      session_id,
      creator_id,
      guest_id,
      tier,
      domain,
      bridge,
      consent_granted: false,
    };

    this.sessions.set(session_id, state);
    this.logger.log('SenSyncService: session opened', { session_id, tier, bridge, domain });
    return state;
  }

  /**
   * Grant SenSync consent for a session.
   * Persists a SenSyncConsent row to Postgres.
   * Emits SENSYNC_CONSENT_GRANTED on NATS.
   */
  async grantConsent(args: {
    session_id: string;
    creator_id: string;
    guest_id: string;
    domain?: SenSyncDomain;
    ip_hash?: string;
    device_fingerprint?: string;
    correlation_id: string;
  }): Promise<SenSyncConsentRecord> {
    const now = new Date();

    if (args.ip_hash !== undefined && !/^[0-9a-fA-F]{64}$/.test(args.ip_hash)) {
      throw new BadRequestException(
        'ip_hash must be a 64-character hex-encoded SHA-256 digest — never a raw IP address',
      );
    }

    const row = await this.prisma.senSyncConsent.create({
      data: {
        session_id: args.session_id,
        creator_id: args.creator_id,
        guest_id: args.guest_id,
        consent_version: SENSYNC_CONSENT_VERSION,
        basis: 'EXPLICIT_OPT_IN' satisfies SenSyncConsentBasis,
        consent_granted_at: now,
        ip_hash: args.ip_hash ?? null,
        device_fingerprint: args.device_fingerprint ?? null,
        domain: args.domain ?? 'ADULT_ENTERTAINMENT',
        correlation_id: args.correlation_id,
        reason_code: 'SENSYNC_CONSENT_GRANTED',
        rule_applied_id: SENSYNC_RULE_ID,
      },
    });

    // Update ephemeral session state.
    const state = this.sessions.get(args.session_id);
    if (state) state.consent_granted = true;
    this.consentCache.set(`${args.session_id}:${args.guest_id}`, true);

    const record: SenSyncConsentRecord = {
      consent_id: row.id,
      session_id: row.session_id,
      creator_id: row.creator_id,
      guest_id: row.guest_id,
      consent_version: row.consent_version,
      basis: row.basis as SenSyncConsentBasis,
      consent_granted_at: row.consent_granted_at.toISOString(),
      ip_hash: row.ip_hash ?? undefined,
      device_fingerprint: row.device_fingerprint ?? undefined,
      domain: row.domain as SenSyncDomain,
      correlation_id: row.correlation_id,
      reason_code: row.reason_code,
      rule_applied_id: row.rule_applied_id,
    };

    this.nats.publish(NATS_TOPICS.SENSYNC_CONSENT_GRANTED, {
      ...record,
    } as unknown as Record<string, unknown>);

    this.logger.log('SenSyncService: consent granted', {
      session_id: args.session_id,
      guest_id: args.guest_id,
    });

    return record;
  }

  /**
   * Revoke SenSync consent.
   * Stamps consent_revoked_at on all active consent rows for this session+guest.
   * Clears ephemeral BPM state.
   * Emits SENSYNC_CONSENT_REVOKED on NATS.
   */
  async revokeConsent(args: {
    session_id: string;
    creator_id: string;
    guest_id: string;
    correlation_id: string;
  }): Promise<void> {
    const now = new Date();

    await this.prisma.senSyncConsent.updateMany({
      where: {
        session_id: args.session_id,
        guest_id: args.guest_id,
        consent_revoked_at: null,
      },
      data: {
        consent_revoked_at: now,
        basis: 'REVOKED' satisfies SenSyncConsentBasis,
        reason_code: 'SENSYNC_CONSENT_REVOKED',
        correlation_id: args.correlation_id,
      },
    });

    // Clear ephemeral state.
    const state = this.sessions.get(args.session_id);
    if (state) {
      state.consent_granted = false;
      state.last_bpm = undefined;
      state.last_sample_at_utc = undefined;
    }
    this.consentCache.set(`${args.session_id}:${args.guest_id}`, false);

    this.nats.publish(NATS_TOPICS.SENSYNC_CONSENT_REVOKED, {
      event_id: randomUUID(),
      session_id: args.session_id,
      creator_id: args.creator_id,
      guest_id: args.guest_id,
      basis: 'REVOKED',
      revoked_at_utc: now.toISOString(),
      correlation_id: args.correlation_id,
      reason_code: 'SENSYNC_CONSENT_REVOKED',
      rule_applied_id: SENSYNC_RULE_ID,
    } as unknown as Record<string, unknown>);

    this.logger.log('SenSyncService: consent revoked', {
      session_id: args.session_id,
      guest_id: args.guest_id,
    });
  }

  /**
   * Submit a raw BPM sample.
   * 1. Plausibility filter [30..220].
   * 2. Consent check.
   * 3. Normalize (BPM passthrough — extension point for future smoothing).
   * 4. Publish sensync.biometric.data to NATS for FFS scoring.
   * Returns the normalized payload or null if rejected.
   */
  submitSample(sample: SenSyncSample): Promise<SenSyncBiometricPayload | null> {
    return this._submitSample(sample);
  }

  private async _submitSample(sample: SenSyncSample): Promise<SenSyncBiometricPayload | null> {
    // Plausibility filter.
    if (sample.bpm_raw < SENSYNC_BPM_MIN || sample.bpm_raw > SENSYNC_BPM_MAX) {
      this.rejectSample(sample);
      return null;
    }

    const state = this.sessions.get(sample.session_id);
    if (!state) {
      this.logger.warn('SenSyncService: no active session', { session_id: sample.session_id });
      return null;
    }

    // Consent gate — check ephemeral cache first, then fall back to DB so that
    // consent is honoured across process restarts and multiple service instances.
    const consentKey = `${sample.session_id}:${sample.guest_id}`;
    let hasConsent = this.consentCache.get(consentKey);
    if (!hasConsent) {
      const dbConsent = await this.prisma.senSyncConsent.findFirst({
        where: {
          session_id: sample.session_id,
          guest_id: sample.guest_id,
          consent_revoked_at: null,
          purge_requested_at: null,
        },
      });
      hasConsent = dbConsent !== null;
      this.consentCache.set(consentKey, hasConsent);
    }
    if (!hasConsent) {
      this.logger.warn('SenSyncService: sample rejected — no consent', {
        session_id: sample.session_id,
        guest_id: sample.guest_id,
      });
      return null;
    }

    const valid: SenSyncValidSample = {
      ...sample,
      bpm_normalized: sample.bpm_raw, // Extension point: smoothing/filtering here.
    };

    // Update ephemeral state.
    state.last_bpm = valid.bpm_normalized;
    state.last_sample_at_utc = new Date().toISOString();

    const payload: SenSyncBiometricPayload = {
      event_id: randomUUID(),
      session_id: valid.session_id,
      creator_id: valid.creator_id,
      guest_id: valid.guest_id,
      bpm_normalized: valid.bpm_normalized,
      bridge: valid.bridge,
      domain: valid.domain,
      consent_version: SENSYNC_CONSENT_VERSION,
      emitted_at_utc: state.last_sample_at_utc,
      rule_applied_id: SENSYNC_RULE_ID,
    };

    this.nats.publish(NATS_TOPICS.SENSYNC_BIOMETRIC_DATA, {
      ...payload,
    } as unknown as Record<string, unknown>);

    return payload;
  }

  /**
   * Close a SenSync session — purges all ephemeral state.
   */
  closeSession(session_id: string): void {
    const state = this.sessions.get(session_id);
    if (state) {
      // Remove consent cache entries for this session.
      this.consentCache.delete(`${session_id}:${state.guest_id}`);
    }
    this.sessions.delete(session_id);
    this.logger.log('SenSyncService: session closed', { session_id });
  }

  /**
   * Return current ephemeral session state.
   */
  getSessionState(session_id: string): SenSyncSessionState | undefined {
    return this.sessions.get(session_id);
  }

  /**
   * Record a hardware lifecycle event (connected/disconnected).
   * Emits SENSYNC_HARDWARE_CONNECTED or SENSYNC_HARDWARE_DISCONNECTED on NATS.
   */
  recordHardwareEvent(args: {
    session_id: string;
    creator_id: string;
    guest_id: string;
    bridge: SenSyncHardwareBridge;
    event_type: 'CONNECTED' | 'DISCONNECTED';
  }): void {
    const event: SenSyncHardwareEvent = {
      event_id: randomUUID(),
      session_id: args.session_id,
      creator_id: args.creator_id,
      guest_id: args.guest_id,
      bridge: args.bridge,
      event_type: args.event_type,
      occurred_at_utc: new Date().toISOString(),
      rule_applied_id: SENSYNC_RULE_ID,
    };

    const topic =
      args.event_type === 'CONNECTED'
        ? NATS_TOPICS.SENSYNC_HARDWARE_CONNECTED
        : NATS_TOPICS.SENSYNC_HARDWARE_DISCONNECTED;

    this.nats.publish(topic, { ...event } as unknown as Record<string, unknown>);
  }

  /**
   * Request a Law 25 / GDPR Art. 17 data purge for a guest.
   * Stamps purge_requested_at on all consent rows for the guest.
   * Emits SENSYNC_PURGE_REQUESTED on NATS.
   * Actual deletion of sensitive fields is completed asynchronously by a
   * scheduled purge job that listens on SENSYNC_PURGE_REQUESTED.
   */
  async requestPurge(args: {
    guest_id: string;
    requested_by: string;
    correlation_id: string;
    reason_code: string;
  }): Promise<SenSyncPurgeRequest> {
    const now = new Date();
    const purge_id = randomUUID();

    await this.prisma.senSyncConsent.updateMany({
      where: {
        guest_id: args.guest_id,
        purge_requested_at: null,
      },
      data: {
        purge_requested_at: now,
        reason_code: args.reason_code,
      },
    });

    const purgeRequest: SenSyncPurgeRequest = {
      purge_id,
      guest_id: args.guest_id,
      requested_by: args.requested_by,
      requested_at_utc: now.toISOString(),
      correlation_id: args.correlation_id,
      reason_code: args.reason_code,
      rule_applied_id: SENSYNC_RULE_ID,
    };

    this.nats.publish(NATS_TOPICS.SENSYNC_PURGE_REQUESTED, {
      ...purgeRequest,
    } as unknown as Record<string, unknown>);

    this.logger.log('SenSyncService: purge requested', {
      guest_id: args.guest_id,
      purge_id,
    });

    return purgeRequest;
  }

  /**
   * Complete a purge — called by the async purge job after data minimization.
   * Stamps purge_completed_at and nullifies sensitive fields (ip_hash,
   * device_fingerprint) on all pending purge rows for the guest.
   * Emits SENSYNC_PURGE_COMPLETED on NATS.
   */
  async completePurge(args: {
    purge_id: string;
    guest_id: string;
    correlation_id: string;
  }): Promise<SenSyncPurgeCompleted> {
    const now = new Date();

    const result = await this.prisma.senSyncConsent.updateMany({
      where: {
        guest_id: args.guest_id,
        purge_requested_at: { not: null },
        purge_completed_at: null,
      },
      data: {
        purge_completed_at: now,
        ip_hash: null,
        device_fingerprint: null,
        reason_code: 'SENSYNC_PURGE_COMPLETED',
      },
    });

    const purgeCompleted: SenSyncPurgeCompleted = {
      purge_id: args.purge_id,
      guest_id: args.guest_id,
      rows_affected: result.count,
      completed_at_utc: now.toISOString(),
      rule_applied_id: SENSYNC_RULE_ID,
    };

    this.nats.publish(NATS_TOPICS.SENSYNC_PURGE_COMPLETED, {
      ...purgeCompleted,
    } as unknown as Record<string, unknown>);

    this.logger.log('SenSyncService: purge completed', {
      guest_id: args.guest_id,
      rows_affected: result.count,
    });

    return purgeCompleted;
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  private isTierEligible(tier: MembershipTier): boolean {
    return (SENSYNC_HARDWARE_TIERS as readonly string[]).includes(tier);
  }

  private rejectSample(sample: SenSyncSample): void {
    const rejection: SenSyncPlausibilityRejection = {
      rejection_id: randomUUID(),
      session_id: sample.session_id,
      guest_id: sample.guest_id,
      bpm_raw: sample.bpm_raw,
      reason_code: sample.bpm_raw < SENSYNC_BPM_MIN ? 'BPM_BELOW_MIN' : 'BPM_ABOVE_MAX',
      rejected_at_utc: new Date().toISOString(),
      rule_applied_id: SENSYNC_RULE_ID,
    };

    this.nats.publish(NATS_TOPICS.SENSYNC_PLAUSIBILITY_REJECTED, {
      ...rejection,
    } as unknown as Record<string, unknown>);

    this.logger.warn('SenSyncService: plausibility rejection', rejection);
  }

  private emitTierDisabled(
    session_id: string,
    guest_id: string,
    tier: MembershipTier,
  ): void {
    const event: SenSyncTierDisabledEvent = {
      event_id: randomUUID(),
      session_id,
      guest_id,
      tier,
      reason_code: 'TIER_SENSYNC_HARDWARE_DISABLED',
      occurred_at_utc: new Date().toISOString(),
      rule_applied_id: SENSYNC_RULE_ID,
    };

    this.nats.publish(NATS_TOPICS.SENSYNC_TIER_DISABLED, {
      ...event,
    } as unknown as Record<string, unknown>);
  }
}
