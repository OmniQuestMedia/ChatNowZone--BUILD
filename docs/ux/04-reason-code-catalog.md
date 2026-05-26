# 04 — Reason Code Catalog

**Status:** ALPHA-FROZEN 2026-04-28 (V1 enumeration; updates via `GOV:` directive)
**Purpose:** Every `reason_code` the system can return on a UI-relevant surface, with a recommended user-facing copy slot.

`reason_code` is a required field on every financial / audit / gate
write. Wireframes use it as the lookup key into this catalog to render
user-facing copy. The same `reason_code` may surface in different
contexts (e.g. `STEP_UP_REQUIRED` is returned by RBAC, by GateGuard,
and by Compliance) — the copy slot is consistent regardless of source.

---

## Catalog format

| `reason_code` | Surface(s) where it appears | Recommended user-facing copy slot |
| ------------- | --------------------------- | --------------------------------- |

The "copy slot" is a structural prompt, not the final marketing copy.
Marketing copy is owned by Creative — they fill the slot with brand
voice. Engineering owns the `reason_code` mapping.

---

## Identity, age, and geo

| `reason_code`               | Surface(s)                          | Copy slot                                                        |
| --------------------------- | ----------------------------------- | ---------------------------------------------------------------- |
| `KYC_REQUIRED`              | Token purchase, paid-tier upgrade   | "Verify your identity to continue. → [start KYC]"                |
| `KYC_PENDING`               | Token purchase, paid-tier upgrade   | "Your verification is being reviewed (typically X minutes)."     |
| `KYC_FAILED`                | Token purchase, paid-tier upgrade   | "We couldn't verify your identity. → [contact support]"          |
| `AGE_VERIFICATION_REQUIRED` | Adult content gate, paid tier       | "Confirm you are of legal age to continue."                      |
| `AGE_REVERIFY_DUE`          | VIP+ session start                  | "Your age verification is due to renew. → [reverify]"            |
| `SOVEREIGN_CAC_BLOCK`       | Any adult-content surface           | "This content is not available in your region."                  |
| `GEO_BLOCKED`               | Any restricted-jurisdiction surface | "This service is not available in your location."                |
| `DOMAIN_BLOCKED`            | Sign-up                             | "We can't accept registrations from this email domain."          |
| `EMAIL_DOMAIN_BLOCKED`      | Sign-up                             | "This email provider isn't supported. → [use a different email]" |
| `EMAIL_VERIFIED`            | Sign-up                             | "Email confirmed." (toast / inline confirmation)                 |

---

## Authorization, RBAC, step-up

| `reason_code`       | Surface(s)                                                                                                  | Copy slot                                                   |
| ------------------- | ----------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| `STEP_UP_REQUIRED`  | Operator destructive actions, NCII suppression, legal hold, WORM export, rate-card config, geo-block modify | "Confirm with your second factor to continue." (modal)      |
| `STEP_UP_DENIED`    | Same                                                                                                        | "Verification failed. → [try again] (X attempts remaining)" |
| `RBAC_INSUFFICIENT` | Any restricted action                                                                                       | "You don't have access to this action." (no detail leakage) |
| `LEGAL_HOLD_ACTIVE` | Any mutation on a held entity                                                                               | "This account is under legal hold. Contact compliance."     |

---

## Wallet, ledger, payment

| `reason_code`                   | Surface(s)                              | Copy slot                                                                   |
| ------------------------------- | --------------------------------------- | --------------------------------------------------------------------------- |
| `LEDGER_INSUFFICIENT_BUCKETS`   | Spend intent                            | "You need X more CZT to complete this. → [add tokens] · [safety-net offer]" |
| `IDEMPOTENCY_REPLAY`            | Any retried mutation                    | "We already processed an earlier attempt — refresh to see the result."      |
| `IDEMPOTENCY_DIVERGENT_PAYLOAD` | Retried mutation with different payload | "This request differs from an earlier attempt. → [refresh and try again]"   |
| `RATE_LIMITED_PER_SECOND`       | Any rate-limited endpoint               | "Too many requests. Try again in X seconds." (auto-retry with backoff)      |
| `MONTHLY_STIPEND`               | Wallet history row                      | "Monthly membership stipend."                                               |
| `WELCOME_CREDIT`                | Wallet history row                      | "Welcome credit." (when active per `welcome_credit_active` flag)            |
| `PIXEL_LEGACY_SIGNING_BONUS`    | Creator earnings                        | "Pixel Legacy signing bonus."                                               |
| `LOYALTY_REWARD_OFFER`          | Wallet, gift surface                    | "Loyalty reward — claim within X days."                                     |

---

## GateGuard + Welfare Guardian

| `reason_code`            | Surface(s)                           | Copy slot                                                                          |
| ------------------------ | ------------------------------------ | ---------------------------------------------------------------------------------- |
| `GATEGUARD_DENY`         | Any GateGuard-pre-processed mutation | (Use the more specific WGS code below — `GATEGUARD_DENY` is the umbrella)          |
| `SOFT_NUDGE`             | WGS band 40–69                       | (Banner) "Take a moment — does this still feel right?" — non-blocking, dismissible |
| `COOL_DOWN`              | WGS band 70–89                       | (Modal, 5-min countdown, non-dismissible) "Let's pause for 5 minutes."             |
| `HARD_DECLINE_HCZ`       | WGS band 90+                         | (Full-screen) "We've paused this session. → [talk to a real person from HCZ]"      |
| `WELFARE_GUARDIAN_PAUSE` | Same as COOL_DOWN                    | (Same as COOL_DOWN copy slot)                                                      |

---

## Cyrano (Layer 2)

| `reason_code`                                             | Surface(s)                         | Copy slot                                                                   |
| --------------------------------------------------------- | ---------------------------------- | --------------------------------------------------------------------------- |
| `TIER_AUTHORIZED`                                         | Cyrano session establish (success) | (No user-facing copy; internal grant)                                       |
| `TIER_INSUFFICIENT`                                       | Cyrano denial page                 | "Cyrano is available to VIPs. → [see tier comparison]"                      |
| `NO_SESSION`                                              | Cyrano middleware redirect         | (Implicit — leads to welcome or denial page)                                |
| `SESSION_EXPIRED`                                         | Cyrano middleware redirect         | "Your Cyrano session ended. → [start new session] · [purchase more access]" |
| `NO_USER_CONTEXT`                                         | Cyrano edge                        | "Please re-enter via ChatNow.Zone."                                         |
| `CYRANO_MEMORY_PURGED`                                    | Cyrano session start               | (No user-facing copy; internal log)                                         |
| `PROMPT_OK`                                               | Cyrano whisper card                | (No user-facing copy; success)                                              |
| `PROMPT_REQUEST_INVALID`                                  | Cyrano whisper card                | "We couldn't generate a suggestion for that. → [try again]"                 |
| `NO_CATEGORY_MATCH`                                       | Cyrano whisper card                | (Silent — fall through to next category)                                    |
| `NO_RULE_APPLIED`                                         | Cyrano whisper card                | (Silent — fall through)                                                     |
| `LATENCY_EXCEEDED`                                        | Cyrano whisper card                | (Silent on the user surface; logged for ops)                                |
| `PERSONA_INACTIVE`                                        | Cyrano persona switcher            | "This persona is paused. → [reactivate]"                                    |
| `API_KEY_INVALID` / `API_KEY_MISSING` / `API_KEY_REVOKED` | Cyrano L4 enterprise               | "Authentication failed. → [contact support]"                                |

---

## Recovery

| `reason_code`                                           | Surface(s)                          | Copy slot                                                    |
| ------------------------------------------------------- | ----------------------------------- | ------------------------------------------------------------ |
| `RECOVERY_WINDOW_OPEN`                                  | Wallet, /admin/recovery             | (Banner) "Your recovery window is open. → [explore options]" |
| `EXPIRY_LAPSED`                                         | Wallet, audit                       | "This block expired and was redistributed per policy."       |
| `EXTENSION_MISSED`                                      | Wallet                              | "The extension window passed. → [contact support]"           |
| `RECOVERY_3_5THS_REQUIRES_OVERRIDE`                     | /admin/recovery                     | "This refund requires CEO override."                         |
| `ACCEPT_WINDOW_EXPIRED` / `CONFIRMATION_WINDOW_EXPIRED` | Recovery / Diamond Concierge offers | "This offer has expired."                                    |

---

## Live operations (NATS-driven)

| `reason_code`                       | Surface(s)                                     | Copy slot                                     |
| ----------------------------------- | ---------------------------------------------- | --------------------------------------------- |
| `B_LOCK_CUTOFF`                     | Bijou seat lock                                | "Seat lock cut off. → [retry seat]"           |
| `BIJOU_DWELL_CREDIT`                | Bijou earnings row                             | "Dwell credit (Bijou)."                       |
| `CAMERA_GRACE_EXPIRED`              | Bijou camera violation                         | "Camera grace period ended — session paused." |
| `GAME_PLAY`                         | Game session log                               | "Game played."                                |
| `NOT_SELECTED_IN_LOTTERY`           | Pixel Legacy lottery (if used)                 | "Not selected this round. → [next round]"     |
| `GEO_PRICE_OFFER`                   | Token purchase (jurisdiction-specific pricing) | (Inline in offer card)                        |
| `GEMSTONE_QUEUED` / `GEMSTONE_SENT` | Gift panel                                     | "Gift queued / Gift sent."                    |

---

## Bill 149 + compliance

| `reason_code`                         | Surface(s)                                            | Copy slot                                                          |
| ------------------------------------- | ----------------------------------------------------- | ------------------------------------------------------------------ |
| `BILL_149_DISCLOSURE_REQUIRED`        | Any AI-generated creator output (`CREATOR_AUTO=true`) | "AI-assisted." (visible prefix on every relevant output — see §10) |
| `DSA_DE_MEMBER_STATE_STRICT`          | EU jurisdiction surfaces                              | (Jurisdictional notice)                                            |
| `GDPR_NON_EU_CROSS_BORDER`            | Cross-border processing notice                        | (Jurisdictional notice)                                            |
| `CONTRACT_SIGNED` / `CONTRACT_UPLOAD` | Creator onboarding                                    | "Contract signed / uploaded."                                      |
| `ONBOARDING_COMPLETE`                 | Creator onboarding finish                             | "You're all set."                                                  |
| `CREATOR_AFFILIATED`                  | Studio onboarding                                     | "Affiliated with [studio]."                                        |

---

## SenSync (HeartSync biometric)

| `reason_code`                     | Surface(s)       | Copy slot                                    |
| --------------------------------- | ---------------- | -------------------------------------------- |
| `SENSYNC_CONSENT_GRANTED`         | SenSync settings | "Heart-rate sharing enabled."                |
| `SENSYNC_CONSENT_REVOKED`         | SenSync settings | "Heart-rate sharing turned off."             |
| `SENSYNC_CONSENT_EXPIRED`         | SenSync settings | "Your heart-rate consent expired. → [renew]" |
| `BPM_BELOW_MIN` / `BPM_ABOVE_MAX` | SenSync session  | (Silent on user surface; logs to ops)        |
| `ANOMALY_BPM_DELTA_EXCEEDED`      | SenSync session  | (Silent on user surface; logs to ops)        |

---

## Updates to this catalog

This V1 enumeration is a **best-effort scan** of the current codebase
(2026-04-28). New `reason_code` values introduced post-Alpha-freeze
require a `GOV:` directive that adds the row here in the same PR.

CI gate: a future ship-gate check will fail if a `reason_code` is
returned on a UI surface but not catalogued here. Until that gate
exists, designers should treat any unfamiliar `reason_code` as a
pre-Alpha drift and flag it in their review.
