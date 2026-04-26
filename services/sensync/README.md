# SenSync™ — `services/sensync/`

**Business Plan Reference:** §SenSync (§5)
**Rule ID:** `SENSYNC_v1`
**Status:** Active (replaces `services/heartsync/`)

---

## Purpose

**SenSync™** is the primary biometric layer for ChatNow.Zone™. It is responsible for:
- **Consent management** — explicit opt-in, granular, revocable at any time
- **Data ingestion** — raw BPM from Lovense SDK, WebUSB, or BLE wearables
- **Normalization** — plausibility filtering (30–220 BPM)
- **Publishing** — normalized BPM to `sensync.biometric.data` (NATS, encrypted)
- **Haptic feedback** — dispatching FFS-tier-mapped commands to connected devices

---

## Privacy Architecture (§5.3)

SenSync™ is built consent-first, exceeding **Quebec Law 25**, **GDPR Article 9**,
**CCPA/CPRA**, and upcoming biometric regulations.

| Principle | Implementation |
|-----------|----------------|
| Explicit opt-in | One-tap Diamond-tier UI with plain-language disclosure |
| What is collected | Heart-rate BPM only |
| How it is used | FFS scoring, Cyrano™ suggestions, haptic feedback |
| Retention | Ephemeral — deleted at session end unless explicitly retained for licensing audit |
| Right to revoke | Immediate: publishing stops < 500 ms, in-memory buffers cleared |
| Data minimization | Raw BPM never persisted to disk; only anonymized aggregates (with additional consent) |
| No secondary use | Never shared with third parties, never used for advertising/profiling |
| Audit trail | Every consent event logged immutably with `correlation_id` + `reason_code` |
| Technical safeguards | E2E encrypted NATS subjects; rate limiting; no biometric templates stored |

---

## Hardware Support (§5.2)

| Driver | Protocol | Notes |
|--------|----------|-------|
| `LOVENSE` | WebSocket (Lovense Connect SDK) | Primary partner |
| `WEBUSB` | WebUSB API | Generic wearables, OQMInc™ wristbands |
| `BLE` | Bluetooth Low Energy | Heart-rate monitors |
| `BUTTPLUG_IO` | Buttplug.io | Legacy adapter |
| `HA_BUTTPLUG` | HA-Buttplug | Legacy adapter |
| `PHONE_HAPTIC` | Mobile OS API | Fallback |

---

## NATS Topics

| Topic constant | Subject | When emitted |
|----------------|---------|--------------|
| `SENSYNC_BIOMETRIC_DATA` | `sensync.biometric.data` | Each valid BPM sample (encrypted) |
| `SENSYNC_BPM_UPDATE` | `sensync.bpm.update` | Normalized BPM for FFS consumption |
| `SENSYNC_CONSENT_GRANTED` | `sensync.consent.granted` | Consent granted |
| `SENSYNC_CONSENT_REVOKED` | `sensync.consent.revoked` | Consent revoked |
| `SENSYNC_RELAY_EMITTED` | `sensync.relay.emitted` | Haptic relay dispatch |
| `SENSYNC_COMBINED_BPM` | `sensync.combined.bpm` | Combined mode average |
| `SENSYNC_HAPTIC_DISPATCHED` | `sensync.haptic.dispatched` | Haptic command sent |
| `SENSYNC_PLAUSIBILITY_REJECTED` | `sensync.plausibility.rejected` | Out-of-range BPM |
| `SENSYNC_TIER_DISABLED` | `sensync.tier.disabled` | Feature not available for tier |

---

## REST Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/sensync/session` | Open a relay session |
| `POST` | `/sensync/session/:id/consent` | Record explicit opt-in |
| `DELETE` | `/sensync/session/:id/consent` | Revoke consent immediately |
| `DELETE` | `/sensync/session/:id` | Close session + purge ephemeral data |
| `GET` | `/sensync/session/:id` | Read session state (BPM excluded) |

---

## Database Tables

| Table | Purpose |
|-------|---------|
| `sensync_consents` | Immutable consent grant/revocation audit log |
| `sensync_tier_configs` | Per-tier feature enablement |

---

## Resilience (§5.4)

- Exponential-backoff reconnection on hardware disconnect
- Graceful degradation: FFS continues with behavioral signals only when BPM is absent
- Prometheus metrics: connection success rate, latency, data quality

---

## Non-Adult Extension (§5.5)

Same core service + domain-specific adapters for:
- Teaching / coaching environments
- First-responder and factory safety
- Medical monitoring
