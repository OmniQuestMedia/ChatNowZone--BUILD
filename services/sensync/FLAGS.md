# SenSync™ — FLAGS.md

## FLAG-001: COMBINED_MODE_DEFAULT_OFF
**Default:** `combined_mode = false` for all tiers.  
**Intent:** "Feel as one" is an opt-in premium feature; operators must
explicitly enable it per tier via `sensync_tier_configs`.

## FLAG-002: GUEST_TIER_DEFAULT_DISABLED
**Default:** `enabled = false` for GUEST tier.  
**Intent:** Biometric relay requires at minimum a VIP membership. Guests
(unauthenticated or free-tier) cannot participate in SenSync™.

## FLAG-003: PLAUSIBILITY_BOUNDS_30_220
**Values:** min = 30 BPM, max = 220 BPM.  
**Intent:** Medical-grade resting/peak range. Samples outside this window
are considered device error or spoofed data and are silently discarded.
To adjust, update `SENSYNC_BPM_MIN` and `SENSYNC_BPM_MAX` in
`sensync.types.ts` and redeploy.

## FLAG-004: CONSENT_REQUIRED_BEFORE_RELAY
**Default:** Enforced always.  
**Intent:** Law 25 / GDPR compliance. BPM relay will not fire unless the
guest has an active `EXPLICIT_OPT_IN` consent record in the session.
This flag cannot be disabled — it is a governance invariant.

## FLAG-005: HAPTIC_DRIVER_FALLBACK_ORDER
**Order:** LOVENSE → BUTTPLUG_IO → HA_BUTTPLUG → PHONE_HAPTIC.  
**Intent:** Ensures maximum device compatibility. PHONE_HAPTIC is always
available as a last-resort fallback on mobile clients.
