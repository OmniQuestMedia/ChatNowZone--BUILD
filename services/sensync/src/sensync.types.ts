// HZ: SenSync™ biometric layer — shared types
// Business Plan §HZ — Diamond-tier biometric BPM pipeline with full consent
// lifecycle, Quebec Law 25 / PIPEDA / GDPR compliance, and non-adult
// extension points (teaching, coaching, first-responder, factory safety, medical).
//
// Contract:
//   • Accepts raw BPM samples from Lovense SDK, generic WebUSB, or WebBluetooth.
//   • Diamond-tier only for hardware features; lower tiers receive TIER_DISABLED.
//   • Consent is persisted to Postgres (SenSyncConsent) — not in-memory only.
//   • Normalized BPM is published to NATS sensync.biometric.data for FFS scoring.
//   • Purge on deletion request satisfies Law 25 §28 / GDPR Art 17.

/** Domains that SenSync™ serves (adult vs non-adult verticals). */
export type SenSyncDomain =
  | 'ADULT_ENTERTAINMENT'
  | 'TEACHING'
  | 'COACHING'
  | 'FIRST_RESPONDER'
  | 'FACTORY_SAFETY'
  | 'MEDICAL';

/** Hardware bridge backends. */
export type SenSyncHardwareBridge =
  | 'LOVENSE'        // Lovense SDK
  | 'WEB_USB'        // Generic WebUSB device
  | 'WEB_BLUETOOTH'  // Generic Web Bluetooth / GATT 0x180D
  | 'PHONE_HAPTIC';  // Mobile fallback (no hardware BPM; phone only)

/** Membership tiers (canonical six-value enum per DOMAIN_GLOSSARY.md). */
export type MembershipTier =
  | 'GUEST'
  | 'VIP'
  | 'VIP_SILVER'
  | 'VIP_GOLD'
  | 'VIP_PLATINUM'
  | 'VIP_DIAMOND';

/** Consent basis codes — Law 25 / GDPR / PIPEDA. */
export type SenSyncConsentBasis =
  | 'EXPLICIT_OPT_IN'  // guest explicitly accepted via one-tap UI
  | 'REVOKED';         // guest withdrew consent

/** A single raw BPM sample from a hardware bridge. */
export interface SenSyncSample {
  sample_id: string;
  session_id: string;
  creator_id: string;
  guest_id: string;
  /** Hardware bridge that supplied this sample. */
  bridge: SenSyncHardwareBridge;
  bpm_raw: number;
  /** Millisecond epoch timestamp from the device clock. */
  captured_device_ms: number;
  /** Server-side ISO-8601 UTC receipt timestamp. */
  received_at_utc: string;
  tier: MembershipTier;
  domain: SenSyncDomain;
}

/** A BPM sample that has passed the plausibility filter. */
export interface SenSyncValidSample extends SenSyncSample {
  /** Plausibility-passed BPM; same value as raw, confirmed in [30..220]. */
  bpm_normalized: number;
}

/**
 * NATS payload published to sensync.biometric.data.
 * Consumed by FFS scoring (opt-in only).
 */
export interface SenSyncBiometricPayload {
  event_id: string;
  session_id: string;
  creator_id: string;
  guest_id: string;
  bpm_normalized: number;
  bridge: SenSyncHardwareBridge;
  domain: SenSyncDomain;
  consent_version: string;
  emitted_at_utc: string;
  rule_applied_id: string;
}

/** Persisted consent record (mirrors the SenSyncConsent Prisma model). */
export interface SenSyncConsentRecord {
  consent_id: string;
  session_id: string;
  creator_id: string;
  guest_id: string;
  consent_version: string;
  basis: SenSyncConsentBasis;
  consent_granted_at: string;
  consent_revoked_at?: string;
  ip_hash?: string;             // SHA-256 of guest IP — never raw IP
  device_fingerprint?: string;
  domain: SenSyncDomain;
  correlation_id: string;
  reason_code: string;
  rule_applied_id: string;
}

/** Plausibility rejection audit record. */
export interface SenSyncPlausibilityRejection {
  rejection_id: string;
  session_id: string;
  guest_id: string;
  bpm_raw: number;
  reason_code: 'BPM_BELOW_MIN' | 'BPM_ABOVE_MAX';
  rejected_at_utc: string;
  rule_applied_id: string;
}

/** Tier-disabled audit record — emitted when a non-Diamond tier requests hardware. */
export interface SenSyncTierDisabledEvent {
  event_id: string;
  session_id: string;
  guest_id: string;
  tier: MembershipTier;
  reason_code: 'TIER_SENSYNC_HARDWARE_DISABLED';
  occurred_at_utc: string;
  rule_applied_id: string;
}

/** Law 25 / GDPR deletion purge request. */
export interface SenSyncPurgeRequest {
  purge_id: string;
  guest_id: string;
  requested_by: string;          // actor_id initiating the purge
  requested_at_utc: string;
  correlation_id: string;
  reason_code: string;
  rule_applied_id: string;
}

/** Purge completion confirmation. */
export interface SenSyncPurgeCompleted {
  purge_id: string;
  guest_id: string;
  rows_affected: number;
  completed_at_utc: string;
  rule_applied_id: string;
}

/** Hardware connection lifecycle event. */
export interface SenSyncHardwareEvent {
  event_id: string;
  session_id: string;
  creator_id: string;
  guest_id: string;
  bridge: SenSyncHardwareBridge;
  event_type: 'CONNECTED' | 'DISCONNECTED';
  occurred_at_utc: string;
  rule_applied_id: string;
}

/** Ephemeral in-session state (cleared on closeSession). */
export interface SenSyncSessionState {
  session_id: string;
  creator_id: string;
  guest_id: string;
  tier: MembershipTier;
  domain: SenSyncDomain;
  bridge: SenSyncHardwareBridge;
  consent_granted: boolean;
  last_bpm?: number;
  last_sample_at_utc?: string;
}

/** BPM plausibility bounds — governance constant. */
export const SENSYNC_BPM_MIN = 30;
export const SENSYNC_BPM_MAX = 220;

/** Tiers permitted to use hardware biometric features. */
export const SENSYNC_HARDWARE_TIERS: readonly MembershipTier[] = [
  'VIP_DIAMOND',
] as const;

/** Current consent version string (bumped when consent language changes). */
export const SENSYNC_CONSENT_VERSION = 'SENSYNC_CONSENT_v1';

export const SENSYNC_RULE_ID = 'SENSYNC_v1';
