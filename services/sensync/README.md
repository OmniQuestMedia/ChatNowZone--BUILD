# SenSync™ — Biometric Relay Service

**Service prefix:** `HZ:`  
**Domain:** HeartZone / biometrics  
**Path:** `services/sensync/`

## Purpose

SenSync™ is the real-time biometric relay layer for ChatNow.Zone. It
receives raw BPM samples from connected haptic devices, validates them,
and relays them between consenting creators and guests to enable
synchronised haptic feedback.

## Supported Membership Tiers

| Tier | Default Enabled | Combined Mode |
|------|----------------|--------------|
| GUEST | ✗ | ✗ |
| VIP | ✓ | ✗ |
| VIP_SILVER | ✓ | ✗ |
| VIP_SILVER_BULLET | ✓ | ✓ |
| VIP_GOLD | ✓ | ✓ |
| VIP_PLATINUM | ✓ | ✓ |
| VIP_DIAMOND | ✓ | ✓ |

Per-tier flags are stored in `sensync_tier_configs` and can be toggled
without a deployment. Call `POST /sensync/tier-config/refresh` after
a DB change.

## Relay Modes

| Mode | Description |
|------|-------------|
| `BIDIRECTIONAL` | Guest ↔ Creator — each receives the other's BPM |
| `CREATOR_TO_GUEST` | Only creator BPM flows to guest device |
| `GUEST_TO_CREATOR` | Only guest BPM flows to creator device |
| `COMBINED` | "Feel as one" — arithmetic mean of both BPMs sent to both parties |

## Supported Haptic Drivers

1. **Lovense** — primary Bluetooth/USB driver
2. **Buttplug.io** — cross-device protocol
3. **ha-buttplug** — Home Assistant integration
4. **Phone Haptic** — mobile fallback (vibration API)

Driver is resolved per-session. If the preferred driver is unavailable,
SenSync™Service falls back through the priority list to `PHONE_HAPTIC`.

## Plausibility Filter

BPM samples outside **30–220 BPM** are silently rejected:
- Rejection emitted on `sensync.plausibility.rejected`
- No relay dispatched
- No error returned to caller — audit only

## Consent Model (Law 25 / GDPR)

- Guest must call `POST /sensync/consent/grant` before any BPM relay.
- `ip_hash` is SHA-256 of the guest IP — raw IP never stored.
- Consent can be revoked at any time via `POST /sensync/consent/revoke`.
- Revocation clears all ephemeral BPM state immediately.
- Consent events emitted on `sensync.consent.granted` / `sensync.consent.revoked`.

## REST Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/sensync/sessions` | Open a relay session |
| DELETE | `/sensync/sessions/:id` | Close a relay session |
| GET | `/sensync/sessions/:id` | Get ephemeral session state |
| POST | `/sensync/consent/grant` | Grant biometric relay consent |
| POST | `/sensync/consent/revoke` | Revoke consent |
| POST | `/sensync/samples` | Submit a BPM sample |
| POST | `/sensync/tier-config/refresh` | Reload tier config from DB |

## NATS Topics Emitted

| Topic | When |
|-------|------|
| `sensync.sample.received` | Valid sample accepted |
| `sensync.relay.emitted` | BPM relayed (non-combined modes) |
| `sensync.combined.bpm` | Combined BPM computed |
| `sensync.consent.granted` | Guest consented |
| `sensync.consent.revoked` | Guest revoked consent |
| `sensync.haptic.dispatched` | Haptic command sent |
| `sensync.plausibility.rejected` | Sample out of 30–220 range |
| `sensync.tier.disabled` | Session open rejected due to tier config |
| `hz.haptic.trigger` | Mirrored on legacy HZ topic for downstream |

## Ephemeral Data Only

No BPM values are written to Postgres. `SenSync™SessionState` lives
in-process memory and is purged on `closeSession()` or process restart.
This is a deliberate privacy design decision (Law 25 / GDPR minimisation).

## Sampling Cadence

Sampling interval jitter (1.5–3 s) is enforced by the caller / device
gateway, not by this service. SenSync™Service is stateless with respect
to timing — it processes each sample as presented.
