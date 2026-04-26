// HZ: SenSync™ biometric relay — shared types
// Business Plan §HZ — bidirectional haptic + BPM relay for consenting guests.

/** All membership tiers supported by the platform. */
export type MembershipTier =
  | 'GUEST'
  | 'VIP'
  | 'VIP_SILVER'
  | 'VIP_SILVER_BULLET'
  | 'VIP_GOLD'
  | 'VIP_PLATINUM'
  | 'VIP_DIAMOND';

/** SenSync™ relay transmission mode. */
export type SenSyncMode =
  | 'BIDIRECTIONAL' // guest ↔ creator — each receives the other's BPM
  | 'CREATOR_TO_GUEST' // only creator BPM flows to guest device
  | 'GUEST_TO_CREATOR'  // only guest BPM flows to creator device
  | 'COMBINED';        // "feel as one" — BPM averaged, both feel the mean

/** Haptic driver backend. */
export type HapticDriver =
  | 'LOVENSE'
  | 'BUTTPLUG_IO'
  | 'HA_BUTTPLUG'
  | 'PHONE_HAPTIC'; // mobile fallback

/** Consent basis codes — Law 25 / GDPR. */
export type ConsentBasis =
  | 'EXPLICIT_OPT_IN'   // guest explicitly accepted
  | 'REVOKED';          // guest withdrew consent

/** A single raw BPM sample from a device. */
export interface SenSyncSample {
  sample_id: string;
  session_id: string;
  creator_id: string;
  guest_id: string;
  /** Source actor: 'CREATOR' or 'GUEST'. */
  source: 'CREATOR' | 'GUEST';
  bpm_raw: number;
  /** Millisecond epoch timestamp from the device clock. */
  captured_device_ms: number;
  /** Server-side ISO-8601 UTC receipt timestamp. */
  received_at_utc: string;
  driver: HapticDriver;
  tier: MembershipTier;
}

/** A BPM sample that has passed the plausibility filter. */
export interface SenSyncValidSample extends SenSyncSample {
  bpm_filtered: number; // same as raw, confirmed in [30..220]
}

/** Relay event broadcast to participating devices. */
export interface SenSyncRelayEvent {
  relay_id: string;
  session_id: string;
  creator_id: string;
  guest_id: string;
  mode: SenSyncMode;
  /** BPM value relayed to the remote party. */
  bpm_relayed: number;
  /** Driver selected for this relay. */
  driver: HapticDriver;
  /** ISO-8601 UTC of relay dispatch. */
  relayed_at_utc: string;
  rule_applied_id: string;
}

/** Combined-mode BPM event — arithmetic mean of creator + guest samples. */
export interface SenSyncCombinedBpm {
  event_id: string;
  session_id: string;
  creator_id: string;
  guest_id: string;
  bpm_creator: number;
  bpm_guest: number;
  bpm_combined: number;
  combined_at_utc: string;
  rule_applied_id: string;
}

/** Consent grant or revocation record. */
export interface SenSyncConsent {
  consent_id: string;
  session_id: string;
  guest_id: string;
  creator_id: string;
  basis: ConsentBasis;
  ip_hash?: string;         // SHA-256 of guest IP — never raw IP
  device_fingerprint?: string;
  issued_at_utc: string;
  rule_applied_id: string;
}

/** Plausibility rejection audit record. */
export interface SenSyncPlausibilityRejection {
  rejection_id: string;
  session_id: string;
  guest_id: string;
  source: 'CREATOR' | 'GUEST';
  bpm_raw: number;
  reason_code: 'BPM_BELOW_MIN' | 'BPM_ABOVE_MAX';
  rejected_at_utc: string;
  rule_applied_id: string;
}

/** Tier-disabled rejection audit record. */
export interface SenSyncTierDisabledEvent {
  event_id: string;
  session_id: string;
  guest_id: string;
  tier: MembershipTier;
  reason_code: 'TIER_SENSYNC_DISABLED';
  occurred_at_utc: string;
  rule_applied_id: string;
}

/** In-session state tracked ephemerally per session. */
export interface SenSyncSessionState {
  session_id: string;
  creator_id: string;
  guest_id: string;
  mode: SenSyncMode;
  consent_granted: boolean;
  last_creator_bpm?: number;
  last_guest_bpm?: number;
  last_sample_at_utc?: string;
  driver: HapticDriver;
  tier: MembershipTier;
}

/** Haptic dispatch command sent downstream. */
export interface SenSyncHapticCommand {
  command_id: string;
  session_id: string;
  target: 'CREATOR' | 'GUEST';
  guest_id: string;
  creator_id: string;
  bpm: number;
  driver: HapticDriver;
  dispatched_at_utc: string;
  rule_applied_id: string;
}

/** BPM plausibility bounds — governance constant. */
export const SENSYNC_BPM_MIN = 30;
export const SENSYNC_BPM_MAX = 220;

/** Random sampling interval bounds (milliseconds). */
export const SENSYNC_SAMPLE_INTERVAL_MIN_MS = 1_500;
export const SENSYNC_SAMPLE_INTERVAL_MAX_MS = 3_000;

export const SENSYNC_RULE_ID = 'SENSYNC_v1';
