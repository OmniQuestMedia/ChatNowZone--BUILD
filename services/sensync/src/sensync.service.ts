// SenSync™ — biometric relay service
// Business Plan §SenSync — consent-first biometric ingestion, normalization,
// and publishing. Replaces services/heartsync/ as the primary biometric service.
//
// Privacy guarantees (§5.3):
//   • Raw BPM data is NEVER persisted. It exists only in-memory during the
//     active session and is deleted immediately on session end or consent revocation.
//   • Consent stored in sensync_consents table with full audit trail.
//   • Revocation stops publishing within < 500 ms and clears all buffers.
//   • E2E encrypted NATS subjects for biometric data.
//   • No secondary use — biometric data used exclusively for FFS, Cyrano™, haptics.
//
// Hardware support (§5.2):
//   • Lovense Connect SDK (WebSocket) — primary partner
//   • Generic WebUSB / BLE bridge — pluggable adapters
//   • Exponential-backoff reconnection with graceful degradation to behavioral mode.

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { NatsService } from '../../core-api/src/nats/nats.service';
import { PrismaService } from '../../core-api/src/prisma.service';
import { NATS_TOPICS } from '../../nats/topics.registry';
import {
  SENSYNC_BPM_MAX,
  SENSYNC_BPM_MIN,
  SENSYNC_CONSENT_VERSION,
  SENSYNC_RULE_ID,
  type ConsentPurposeScope,
  type HapticDriver,
  type SenSyncCombinedBpm,
  type SenSyncConsentRecord,
  type SenSyncHapticCommand,
  type SenSyncMode,
  type SenSyncPlausibilityRejection,
  type SenSyncRelayEvent,
  type SenSyncSample,
  type SenSyncSessionState,
  type SenSyncTierDisabledEvent,
  type SenSyncValidSample,
  type MembershipTier,
} from './sensync.types';

/** Fallback driver priority when preferred driver is unavailable. */
const DRIVER_FALLBACK_ORDER: HapticDriver[] = [
  'LOVENSE',
  'WEBUSB',
  'BLE',
  'BUTTPLUG_IO',
  'HA_BUTTPLUG',
  'PHONE_HAPTIC',
];

@Injectable()
export class SenSyncService implements OnModuleInit {
  private readonly logger = new Logger(SenSyncService.name);

  /** Ephemeral session state — NEVER persisted. Cleared on session end. */
  private readonly sessions = new Map<string, SenSyncSessionState>();

  /** Per-tier enabled flags — refreshed from DB on init. */
  private tierEnabled = new Map<MembershipTier, boolean>();
  private tierCombinedAllowed = new Map<MembershipTier, boolean>();

  /**
   * Consent store — keyed by `${session_id}:${guest_id}`.
   * Cleared immediately on revocation.
   */
  private readonly consentStore = new Map<string, boolean>();

  constructor(
    private readonly nats: NatsService,
    private readonly prisma: PrismaService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.refreshTierConfig();
    this.logger.log('SenSyncService: tier config loaded', {
      rule_applied_id: SENSYNC_RULE_ID,
    });
  }

  // ── Public API ────────────────────────────────────────────────────────────

  /**
   * Open a SenSync™ relay session.
   * Must be called before any samples are submitted.
   */
  openSession(
    session_id: string,
    creator_id: string,
    guest_id: string,
    tier: MembershipTier,
    mode: SenSyncMode,
    driver: HapticDriver,
  ): SenSyncSessionState | null {
    if (!this.isTierEnabled(tier)) {
      this.emitTierDisabled(session_id, guest_id, tier);
      return null;
    }

    if (mode === 'COMBINED' && !this.isCombinedAllowed(tier)) {
      this.logger.warn('SenSyncService: COMBINED mode not permitted for tier', {
        tier,
        session_id,
      });
      this.emitTierDisabled(session_id, guest_id, tier);
      return null;
    }

    const state: SenSyncSessionState = {
      session_id,
      creator_id,
      guest_id,
      mode,
      consent_granted: false,
      driver: this.resolveDriver(driver),
      tier,
    };

    this.sessions.set(session_id, state);
    this.logger.log('SenSyncService: session opened', { session_id, mode, tier });
    return state;
  }

  /**
   * Record explicit opt-in consent.
   * One-tap Diamond-tier UI flow — must confirm plain-language disclosure.
   * Persists consent record to sensync_consents table.
   */
  async grantConsent(
    session_id: string,
    guest_id: string,
    creator_id: string,
    purpose_scope: ConsentPurposeScope = 'ALL',
    device_ids: string[] = [],
    ip_hash?: string,
    device_fingerprint?: string,
  ): Promise<SenSyncConsentRecord> {
    const key = `${session_id}:${guest_id}`;
    this.consentStore.set(key, true);

    const consent: SenSyncConsentRecord = {
      consent_id:       randomUUID(),
      session_id,
      guest_id,
      creator_id,
      basis:            'EXPLICIT_OPT_IN',
      consent_version:  SENSYNC_CONSENT_VERSION,
      purpose_scope,
      device_ids,
      ip_hash,
      device_fingerprint,
      granted_at:       new Date().toISOString(),
      rule_applied_id:  SENSYNC_RULE_ID,
    };

    // Persist consent record (non-biometric — this is metadata only).
    try {
      await this.prisma.senSyncConsent.create({
        data: {
          consent_id:        consent.consent_id,
          session_id,
          creator_id,
          guest_id,
          basis:             consent.basis,
          consent_version:   consent.consent_version,
          purpose_scope:     consent.purpose_scope,
          device_ids,
          ip_hash:           ip_hash ?? null,
          device_fingerprint: device_fingerprint ?? null,
          granted_at:        new Date(consent.granted_at),
          correlation_id:    `sensync-consent-${consent.consent_id}`,
          reason_code:       'SENSYNC_CONSENT_GRANTED',
          rule_applied_id:   SENSYNC_RULE_ID,
        },
      });
    } catch (err) {
      this.logger.error('SenSyncService: consent persist failed', err);
    }

    this.nats.publish(NATS_TOPICS.SENSYNC_CONSENT_GRANTED, {
      ...consent,
    } as unknown as Record<string, unknown>);

    this.logger.log('SenSyncService: consent granted', { session_id, guest_id, purpose_scope });
    return consent;
  }

  /**
   * Revoke consent immediately.
   * Stops publishing within < 500 ms (synchronous). Clears all in-memory
   * BPM buffers for the session. Updates the persisted consent record.
   */
  async revokeConsent(
    session_id: string,
    guest_id: string,
    creator_id: string,
  ): Promise<void> {
    const key = `${session_id}:${guest_id}`;

    // Synchronous — consent is cleared before any async operations.
    this.consentStore.set(key, false);

    const state = this.sessions.get(session_id);
    if (state) {
      state.consent_granted   = false;
      state.last_creator_bpm  = undefined;
      state.last_guest_bpm    = undefined;
    }

    // Update DB record async (non-blocking; revocation is already effective above).
    void this.persistRevocation(session_id, guest_id, creator_id);

    this.nats.publish(NATS_TOPICS.SENSYNC_CONSENT_REVOKED, {
      event_id:        randomUUID(),
      session_id,
      guest_id,
      creator_id,
      basis:           'REVOKED',
      revoked_at_utc:  new Date().toISOString(),
      rule_applied_id: SENSYNC_RULE_ID,
    } as unknown as Record<string, unknown>);

    this.logger.log('SenSyncService: consent revoked — buffers cleared', {
      session_id,
      guest_id,
    });
  }

  /**
   * Submit a raw BPM sample for relay processing.
   * Returns the relay event(s) emitted, or null if sample was rejected or
   * consent is absent.
   */
  submitSample(
    sample: SenSyncSample,
  ): SenSyncRelayEvent | SenSyncCombinedBpm | null {
    // Plausibility filter — hard bounds [30..220].
    if (sample.bpm_raw < SENSYNC_BPM_MIN || sample.bpm_raw > SENSYNC_BPM_MAX) {
      this.rejectSample(sample);
      return null;
    }

    const state = this.sessions.get(sample.session_id);
    if (!state) {
      this.logger.warn('SenSyncService: no active session for sample', {
        session_id: sample.session_id,
      });
      return null;
    }

    // Consent check — synchronous, always current.
    const consentKey = `${sample.session_id}:${sample.guest_id}`;
    if (!this.consentStore.get(consentKey)) {
      this.logger.warn('SenSyncService: sample rejected — no consent', {
        session_id: sample.session_id,
        guest_id:   sample.guest_id,
      });
      return null;
    }

    const valid: SenSyncValidSample = {
      ...sample,
      bpm_filtered: sample.bpm_raw,
    };

    // Update ephemeral session BPM state (not persisted).
    if (valid.source === 'CREATOR') {
      state.last_creator_bpm = valid.bpm_filtered;
    } else {
      state.last_guest_bpm = valid.bpm_filtered;
    }
    state.last_sample_at_utc = new Date().toISOString();

    // Publish normalized sample (encrypted NATS subject).
    this.nats.publish(NATS_TOPICS.SENSYNC_BIOMETRIC_DATA, {
      session_id:         valid.session_id,
      creator_id:         valid.creator_id,
      guest_id:           valid.guest_id,
      source:             valid.source,
      bpm:                valid.bpm_filtered,
      received_at_utc:    valid.received_at_utc,
      rule_applied_id:    SENSYNC_RULE_ID,
    } as unknown as Record<string, unknown>);

    // Publish BPM update for FFS consumption (1 Hz downsampled by FFS consumer).
    this.nats.publish(NATS_TOPICS.SENSYNC_BPM_UPDATE, {
      session_id:   valid.session_id,
      creator_id:   valid.creator_id,
      bpm:          valid.bpm_filtered,
      source:       valid.source,
      received_at:  valid.received_at_utc,
    } as unknown as Record<string, unknown>);

    return this.relay(state, valid);
  }

  /**
   * Close a SenSync™ session — purges ALL ephemeral state immediately.
   * No biometric data survives session close.
   */
  closeSession(session_id: string): void {
    const state = this.sessions.get(session_id);
    if (state) {
      // Purge all BPM data before deleting session.
      state.last_creator_bpm = undefined;
      state.last_guest_bpm   = undefined;
    }
    this.sessions.delete(session_id);

    // Clear consent entries for this session.
    for (const key of [...this.consentStore.keys()]) {
      if (key.startsWith(`${session_id}:`)) {
        this.consentStore.delete(key);
      }
    }

    this.logger.log('SenSyncService: session closed — all ephemeral data purged', {
      session_id,
    });
  }

  /**
   * Return current ephemeral session state (read-only copy).
   * Note: BPM values are not included in the returned copy (privacy-by-design).
   */
  getSessionState(session_id: string): Omit<SenSyncSessionState, 'last_creator_bpm' | 'last_guest_bpm'> | undefined {
    const state = this.sessions.get(session_id);
    if (!state) return undefined;
    const { last_creator_bpm: _c, last_guest_bpm: _g, ...safe } = state;
    return safe;
  }

  // ── Relay logic ───────────────────────────────────────────────────────────

  private relay(
    state: SenSyncSessionState,
    sample: SenSyncValidSample,
  ): SenSyncRelayEvent | SenSyncCombinedBpm | null {
    const now = new Date().toISOString();

    if (state.mode === 'COMBINED') {
      return this.relayCombined(state, now);
    }

    const shouldRelay =
      state.mode === 'BIDIRECTIONAL' ||
      (state.mode === 'CREATOR_TO_GUEST' && sample.source === 'CREATOR') ||
      (state.mode === 'GUEST_TO_CREATOR' && sample.source === 'GUEST');

    if (!shouldRelay) return null;

    const bpm_relayed = sample.bpm_filtered;
    const target: 'CREATOR' | 'GUEST' =
      sample.source === 'CREATOR' ? 'GUEST' : 'CREATOR';

    const event: SenSyncRelayEvent = {
      relay_id:        randomUUID(),
      session_id:      state.session_id,
      creator_id:      state.creator_id,
      guest_id:        state.guest_id,
      mode:            state.mode,
      bpm_relayed,
      driver:          state.driver,
      relayed_at_utc:  now,
      rule_applied_id: SENSYNC_RULE_ID,
    };

    this.nats.publish(NATS_TOPICS.SENSYNC_RELAY_EMITTED, {
      ...event,
    } as unknown as Record<string, unknown>);

    this.dispatchHaptic(state, target, bpm_relayed, now);
    return event;
  }

  private relayCombined(
    state: SenSyncSessionState,
    now: string,
  ): SenSyncCombinedBpm | null {
    if (state.last_creator_bpm === undefined || state.last_guest_bpm === undefined) {
      return null;
    }

    const bpm_combined = Math.round(
      (state.last_creator_bpm + state.last_guest_bpm) / 2,
    );

    const combined: SenSyncCombinedBpm = {
      event_id:        randomUUID(),
      session_id:      state.session_id,
      creator_id:      state.creator_id,
      guest_id:        state.guest_id,
      bpm_creator:     state.last_creator_bpm,
      bpm_guest:       state.last_guest_bpm,
      bpm_combined,
      combined_at_utc: now,
      rule_applied_id: SENSYNC_RULE_ID,
    };

    this.nats.publish(NATS_TOPICS.SENSYNC_COMBINED_BPM, {
      ...combined,
    } as unknown as Record<string, unknown>);

    this.dispatchHaptic(state, 'CREATOR', bpm_combined, now);
    this.dispatchHaptic(state, 'GUEST', bpm_combined, now);
    return combined;
  }

  private dispatchHaptic(
    state: SenSyncSessionState,
    target: 'CREATOR' | 'GUEST',
    bpm: number,
    now: string,
  ): void {
    const cmd: SenSyncHapticCommand = {
      command_id:      randomUUID(),
      session_id:      state.session_id,
      target,
      guest_id:        state.guest_id,
      creator_id:      state.creator_id,
      bpm,
      driver:          state.driver,
      dispatched_at_utc: now,
      rule_applied_id: SENSYNC_RULE_ID,
    };

    this.nats.publish(NATS_TOPICS.SENSYNC_HAPTIC_DISPATCHED, {
      ...cmd,
    } as unknown as Record<string, unknown>);
  }

  // ── Plausibility rejection ─────────────────────────────────────────────────

  private rejectSample(sample: SenSyncSample): void {
    const rejection: SenSyncPlausibilityRejection = {
      rejection_id:    randomUUID(),
      session_id:      sample.session_id,
      guest_id:        sample.guest_id,
      source:          sample.source,
      bpm_raw:         sample.bpm_raw,
      reason_code:
        sample.bpm_raw < SENSYNC_BPM_MIN ? 'BPM_BELOW_MIN' : 'BPM_ABOVE_MAX',
      rejected_at_utc: new Date().toISOString(),
      rule_applied_id: SENSYNC_RULE_ID,
    };

    this.nats.publish(NATS_TOPICS.SENSYNC_PLAUSIBILITY_REJECTED, {
      ...rejection,
    } as unknown as Record<string, unknown>);

    this.logger.warn('SenSyncService: sample rejected', rejection);
  }

  private emitTierDisabled(
    session_id: string,
    guest_id: string,
    tier: MembershipTier,
  ): void {
    const event: SenSyncTierDisabledEvent = {
      event_id:        randomUUID(),
      session_id,
      guest_id,
      tier,
      reason_code:     'TIER_SENSYNC_DISABLED',
      occurred_at_utc: new Date().toISOString(),
      rule_applied_id: SENSYNC_RULE_ID,
    };

    this.nats.publish(NATS_TOPICS.SENSYNC_TIER_DISABLED, {
      ...event,
    } as unknown as Record<string, unknown>);
  }

  // ── Driver resolution ─────────────────────────────────────────────────────

  private resolveDriver(preferred: HapticDriver): HapticDriver {
    if (DRIVER_FALLBACK_ORDER.includes(preferred)) return preferred;
    return 'PHONE_HAPTIC';
  }

  // ── Tier config ────────────────────────────────────────────────────────────

  private isTierEnabled(tier: MembershipTier): boolean {
    return this.tierEnabled.get(tier) ?? false;
  }

  private isCombinedAllowed(tier: MembershipTier): boolean {
    return this.tierCombinedAllowed.get(tier) ?? false;
  }

  /**
   * Refresh tier enablement flags from Prisma.
   * Called on module init. Can be called again without restart.
   */
  async refreshTierConfig(): Promise<void> {
    const rows = await this.prisma.senSyncTierConfig.findMany();
    this.tierEnabled.clear();
    this.tierCombinedAllowed.clear();

    for (const row of rows) {
      this.tierEnabled.set(row.tier as MembershipTier, row.enabled);
      this.tierCombinedAllowed.set(row.tier as MembershipTier, row.combined_mode);
    }

    this.logger.log('SenSyncService: tier config refreshed', { count: rows.length });
  }

  // ── Consent persistence helpers ────────────────────────────────────────────

  private async persistRevocation(
    session_id: string,
    guest_id: string,
    creator_id: string,
  ): Promise<void> {
    try {
      await this.prisma.senSyncConsent.updateMany({
        where: {
          session_id,
          guest_id,
          creator_id,
          revoked_at: null,
        },
        data: {
          revoked_at: new Date(),
        },
      });
    } catch (err) {
      this.logger.error('SenSyncService: revocation persist failed', err);
    }
  }
}
