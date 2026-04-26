// SenSync™ — shared types
// Business Plan §SenSync — consent-first biometric relay for consenting guests.
// Exceeds Quebec Law 25, GDPR Article 9, CCPA/CPRA, and biometric privacy regs.

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
  | 'BIDIRECTIONAL'    // guest ↔ creator — each receives the other's BPM
  | 'CREATOR_TO_GUEST' // only creator BPM flows to guest device
  | 'GUEST_TO_CREATOR' // only guest BPM flows to creator device
  | 'COMBINED';        // "feel as one" — BPM averaged, both feel the mean

/** Haptic driver backend (Lovense primary per spec §5.2). */
export type HapticDriver =
  | 'LOVENSE'         // Lovense Connect SDK (WebSocket) — primary partner
  | 'WEBUSB'          // Generic WebUSB bridge
  | 'BLE'             // Generic Bluetooth Low Energy bridge
  | 'BUTTPLUG_IO'     // Buttplug.io adapter
  | 'HA_BUTTPLUG'     // HA-Buttplug adapter
  | 'PHONE_HAPTIC';   // mobile fallback

/** Consent basis codes — Law 25 / GDPR Article 9. */
export type ConsentBasis =
  | 'EXPLICIT_OPT_IN' // explicit one-tap consent with plain-language disclosure
  | 'REVOKED';        // guest withdrew consent

/** Consent purpose scope — what the data is used for. */
export type ConsentPurposeScope =
  | 'FFS_SCORING'     // feeds Flicker n'Flame score
  | 'CYRANO'          // Cyrano™ suggestion weighting
  | 'HAPTIC_FEEDBACK' // haptic command dispatch
  | 'ALL';            // all of the above

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

/** A BPM sample that has passed the plausibility filter (30–220 BPM). */
export interface SenSyncValidSample extends SenSyncSample {
  bpm_filtered: number;
}

/** Relay event broadcast to participating devices. */
export interface SenSyncRelayEvent {
  relay_id: string;
  session_id: string;
  creator_id: string;
  guest_id: string;
  mode: SenSyncMode;
  bpm_relayed: number;
  driver: HapticDriver;
  relayed_at_utc: string;
  rule_applied_id: string;
}

/** Combined-mode BPM event — arithmetic mean of creator + guest. */
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

/**
 * Consent grant record — persisted to sensync_consents table.
 * Raw BPM data is NEVER persisted (ephemeral session-memory only).
 */
export interface SenSyncConsentRecord {
  consent_id: string;
  session_id: string;
  creator_id: string;
  guest_id?: string;          // null for creator self-pairing
  basis: ConsentBasis;
  consent_version: string;    // version of the consent disclosure text shown
  purpose_scope: ConsentPurposeScope;
  device_ids: string[];       // device identifiers (non-biometric hardware IDs)
  ip_hash?: string;           // SHA-256 of guest IP — never raw IP
  device_fingerprint?: string;
  granted_at: string;         // ISO-8601 UTC
  revoked_at?: string;        // ISO-8601 UTC; null until revoked
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

/** In-session ephemeral state — never persisted to disk. */
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

/** Haptic dispatch command sent downstream to device drivers. */
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

/** Consent version — bump when disclosure text changes. */
export const SENSYNC_CONSENT_VERSION = '1.0';

/** Rule ID — bump on governance event. */
export const SENSYNC_RULE_ID = 'SENSYNC_v1';

/** Maximum revocation latency (ms) — per spec §5.3. */
export const SENSYNC_MAX_REVOCATION_LATENCY_MS = 500;
