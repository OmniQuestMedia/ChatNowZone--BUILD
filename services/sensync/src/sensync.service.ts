// HZ: SenSync™ biometric relay service
// Business Plan §HZ — bidirectional haptic + BPM relay for consenting guests.
//
// Contract:
//   • Accepts raw BPM samples from Lovense / Buttplug.io / ha-buttplug /
//     phone haptic drivers.
//   • Applies plausibility filter (30–220 BPM). Out-of-range samples are
//     rejected with an audit-only NATS event.
//   • Per-tier enablement checked against SenSyncTierConfig (in-memory
//     cache; refreshed on module init).
//   • Three relay modes: BIDIRECTIONAL, CREATOR_TO_GUEST, GUEST_TO_CREATOR.
//     COMBINED mode averages both BPMs ("feel as one").
//   • Ephemeral session state only — no BPM values persisted to Postgres.
//   • Consent checked before relay — guest must have EXPLICIT_OPT_IN basis.
//   • Sampling cadence jitter: 1.5–3 s (handled by caller/gateway).

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { NatsService } from '../../core-api/src/nats/nats.service';
import { PrismaService } from '../../core-api/src/prisma.service';
import { NATS_TOPICS } from '../../nats/topics.registry';
import {
  SENSYNC_BPM_MAX,
  SENSYNC_BPM_MIN,
  SENSYNC_RULE_ID,
  type HapticDriver,
  type SenSyncCombinedBpm,
  type SenSyncConsent,
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
  'BUTTPLUG_IO',
  'HA_BUTTPLUG',
  'PHONE_HAPTIC',
];

@Injectable()
export class SenSyncService implements OnModuleInit {
  private readonly logger = new Logger(SenSyncService.name);

  /** Ephemeral session state — never persisted. Cleared on session end. */
  private readonly sessions = new Map<string, SenSyncSessionState>();

  /** Per-tier enabled flags — refreshed from DB on init. */
  private tierEnabled = new Map<MembershipTier, boolean>();
  private tierCombinedAllowed = new Map<MembershipTier, boolean>();

  /** Consent store — keyed by `${session_id}:${guest_id}`. */
  private readonly consentStore = new Map<string, boolean>();

  constructor(
    private readonly nats: NatsService,
    private readonly prisma: PrismaService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.refreshTierConfig();
    this.logger.log('SenSyncService: tier config loaded');
  }

  // ── Public API ────────────────────────────────────────────────────────────

  /**
   * Open a SenSync™ relay session.
   * Must be called before any samples are submitted.
   * Returns the initial session state.
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
      this.logger.warn('SenSyncService: COMBINED mode not permitted for tier', { tier, session_id });
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
   * Record guest consent for biometric relay.
   * Must be called before samples are relayed.
   * Emits SENSYNC_CONSENT_GRANTED on NATS.
   */
  grantConsent(
    session_id: string,
    guest_id: string,
    creator_id: string,
    ip_hash?: string,
    device_fingerprint?: string,
  ): SenSyncConsent {
    const key = `${session_id}:${guest_id}`;
    this.consentStore.set(key, true);

    const consent: SenSyncConsent = {
      consent_id: randomUUID(),
      session_id,
      guest_id,
      creator_id,
      basis: 'EXPLICIT_OPT_IN',
      ip_hash,
      device_fingerprint,
      issued_at_utc: new Date().toISOString(),
      rule_applied_id: SENSYNC_RULE_ID,
    };

    this.nats.publish(NATS_TOPICS.SENSYNC_CONSENT_GRANTED, {
      ...consent,
    } as unknown as Record<string, unknown>);

    this.logger.log('SenSyncService: consent granted', { session_id, guest_id });
    return consent;
  }

  /**
   * Revoke guest consent for biometric relay.
   * Clears all buffered BPM state for the session.
   * Emits SENSYNC_CONSENT_REVOKED on NATS.
   */
  revokeConsent(session_id: string, guest_id: string, creator_id: string): void {
    const key = `${session_id}:${guest_id}`;
    this.consentStore.set(key, false);

    const state = this.sessions.get(session_id);
    if (state) {
      state.consent_granted = false;
      state.last_creator_bpm = undefined;
      state.last_guest_bpm = undefined;
    }

    this.nats.publish(NATS_TOPICS.SENSYNC_CONSENT_REVOKED, {
      event_id: randomUUID(),
      session_id,
      guest_id,
      creator_id,
      basis: 'REVOKED',
      revoked_at_utc: new Date().toISOString(),
      rule_applied_id: SENSYNC_RULE_ID,
    } as unknown as Record<string, unknown>);

    this.logger.log('SenSyncService: consent revoked', { session_id, guest_id });
  }

  /**
   * Submit a raw BPM sample for relay processing.
   * Returns the relay event(s) emitted, or null if sample was rejected.
   */
  submitSample(sample: SenSyncSample): SenSyncRelayEvent | SenSyncCombinedBpm | null {
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

    // Consent check.
    const consentKey = `${sample.session_id}:${sample.guest_id}`;
    if (!this.consentStore.get(consentKey)) {
      this.logger.warn('SenSyncService: sample rejected — no consent', {
        session_id: sample.session_id,
        guest_id: sample.guest_id,
      });
      return null;
    }

    const valid: SenSyncValidSample = {
      ...sample,
      bpm_filtered: sample.bpm_raw,
    };

    // Update session ephemeral BPM state.
    if (valid.source === 'CREATOR') {
      state.last_creator_bpm = valid.bpm_filtered;
    } else {
      state.last_guest_bpm = valid.bpm_filtered;
    }
    state.last_sample_at_utc = new Date().toISOString();

    // Emit sample-received event.
    this.nats.publish(NATS_TOPICS.SENSYNC_SAMPLE_RECEIVED, {
      ...valid,
    } as unknown as Record<string, unknown>);

    return this.relay(state, valid);
  }

  /**
   * Close a SenSync™ session — purges all ephemeral state.
   */
  closeSession(session_id: string): void {
    this.sessions.delete(session_id);
    this.logger.log('SenSyncService: session closed', { session_id });
  }

  /**
   * Return current ephemeral session state (read-only copy).
   */
  getSessionState(session_id: string): SenSyncSessionState | undefined {
    return this.sessions.get(session_id);
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

    // Determine direction.
    const shouldRelay =
      state.mode === 'BIDIRECTIONAL' ||
      (state.mode === 'CREATOR_TO_GUEST' && sample.source === 'CREATOR') ||
      (state.mode === 'GUEST_TO_CREATOR' && sample.source === 'GUEST');

    if (!shouldRelay) return null;

    const bpm_relayed = sample.bpm_filtered;
    const target: 'CREATOR' | 'GUEST' =
      sample.source === 'CREATOR' ? 'GUEST' : 'CREATOR';

    const event: SenSyncRelayEvent = {
      relay_id: randomUUID(),
      session_id: state.session_id,
      creator_id: state.creator_id,
      guest_id: state.guest_id,
      mode: state.mode,
      bpm_relayed,
      driver: state.driver,
      relayed_at_utc: now,
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
      // Not enough data for combined mode yet.
      return null;
    }

    const bpm_combined = Math.round(
      (state.last_creator_bpm + state.last_guest_bpm) / 2,
    );

    const combined: SenSyncCombinedBpm = {
      event_id: randomUUID(),
      session_id: state.session_id,
      creator_id: state.creator_id,
      guest_id: state.guest_id,
      bpm_creator: state.last_creator_bpm,
      bpm_guest: state.last_guest_bpm,
      bpm_combined,
      combined_at_utc: now,
      rule_applied_id: SENSYNC_RULE_ID,
    };

    this.nats.publish(NATS_TOPICS.SENSYNC_COMBINED_BPM, {
      ...combined,
    } as unknown as Record<string, unknown>);

    // Dispatch to both parties.
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
      command_id: randomUUID(),
      session_id: state.session_id,
      target,
      guest_id: state.guest_id,
      creator_id: state.creator_id,
      bpm,
      driver: state.driver,
      dispatched_at_utc: now,
      rule_applied_id: SENSYNC_RULE_ID,
    };

    this.nats.publish(NATS_TOPICS.SENSYNC_HAPTIC_DISPATCHED, {
      ...cmd,
    } as unknown as Record<string, unknown>);

    this.nats.publish(NATS_TOPICS.HZ_HAPTIC_TRIGGER, {
      ...cmd,
    } as unknown as Record<string, unknown>);
  }

  // ── Plausibility rejection ─────────────────────────────────────────────────

  private rejectSample(sample: SenSyncSample): void {
    const rejection: SenSyncPlausibilityRejection = {
      rejection_id: randomUUID(),
      session_id: sample.session_id,
      guest_id: sample.guest_id,
      source: sample.source,
      bpm_raw: sample.bpm_raw,
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
      event_id: randomUUID(),
      session_id,
      guest_id,
      tier,
      reason_code: 'TIER_SENSYNC_DISABLED',
      occurred_at_utc: new Date().toISOString(),
      rule_applied_id: SENSYNC_RULE_ID,
    };

    this.nats.publish(NATS_TOPICS.SENSYNC_TIER_DISABLED, {
      ...event,
    } as unknown as Record<string, unknown>);
  }

  // ── Driver resolution ─────────────────────────────────────────────────────

  private resolveDriver(preferred: HapticDriver): HapticDriver {
    // In production the availability of a driver is determined at runtime
    // (device capability negotiation). Here we return preferred if known,
    // else fall back down the priority chain.
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
   * Called on module init. Can be called again by operators without restart.
   */
  async refreshTierConfig(): Promise<void> {
    const rows = await this.prisma.senSyncTierConfig.findMany();
    this.tierEnabled.clear();
    this.tierCombinedAllowed.clear();

    for (const row of rows) {
      this.tierEnabled.set(row.tier as MembershipTier, row.enabled);
      this.tierCombinedAllowed.set(row.tier as MembershipTier, row.combined_mode);
    }

    this.logger.log('SenSyncService: tier config refreshed', {
      count: rows.length,
    });
  }
}
