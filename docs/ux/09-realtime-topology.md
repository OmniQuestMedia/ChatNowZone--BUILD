# 09 — Real-Time Event Topology

**Status:** ALPHA-FROZEN 2026-04-28
**Purpose:** Tell wireframes which surfaces are NATS-driven (live updates, no pull-to-refresh) vs request/response.

CNZ enforces an invariant: **chat and haptic events must flow over NATS.
REST polling is forbidden** for those concerns. Several other surfaces
are NATS-driven for latency or auditability reasons. This file
enumerates them so wireframes design the right behavior.

---

## Authoritative source

NATS topic registry: [`services/nats/topics.registry.ts`](../../services/nats/topics.registry.ts).

If a topic name is needed in a wireframe annotation, copy it from the
registry — never invent.

---

## NATS-driven surfaces (live updates required)

These surfaces must update without user action. A wireframe must show
the live-data behavior, not a refresh button.

### Chat + haptic (REST polling forbidden)

| Surface                        | Topics                                                                                                                                 |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| Live stream viewer (chat lane) | `chat.ingest.raw`, `chat.response.outbound`, `chat.broadcast.staggered`                                                                |
| HeartZone / SenSync biometric  | `hz.bpm.update`, `hz.haptic.trigger`, `hz.wish.fulfilled`, `sensync.bpm.update`, `sensync.haptic.dispatched`, `heartsync.combined.bpm` |
| Geo translation overlay        | `geo.tip.translated`                                                                                                                   |

### Creator surface (live)

| Surface                          | Topics                                                                                                     |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| FFS meter on `/creator/control`  | `ffs.scored`                                                                                               |
| Cyrano whisper feed (Creator L1) | `cyrano.*` (registry)                                                                                      |
| Session monitoring panel         | `chat.*`, `sensync.*` aggregated                                                                           |
| Bijou seat / dwell signals       | `bijou.dwell.tick`, `bijou.seat.opened`, `bijou.standby.alert`, `bijou.camera.violation`, `bijou.ejection` |
| ShowZone signals                 | `showzone.dwell.tick`, `showzone.seat.opened`, `showzone.show.ended`                                       |

### Admin / operator surface (live)

| Surface                                    | Topics                   |
| ------------------------------------------ | ------------------------ |
| `/admin/diamond` GateGuard feed            | `gateguard.*` (registry) |
| `/admin/diamond` Welfare panel             | `wgs.*` (registry)       |
| `/admin/diamond` audit chain rows          | `audit.immutable.*`      |
| `/admin/recovery` open-case table          | recovery audit topics    |
| `/admin/diamond` Diamond Concierge handoff | integration-hub topics   |
| Geo-block enforcement log                  | `geo.block.enforced`     |

### Cyrano L2 standalone

| Surface               | Topics                                   |
| --------------------- | ---------------------------------------- |
| Whisper console       | `cyrano.layer2.session.*`                |
| Session minutes gauge | (Server-side decrement; pushed via NATS) |

### SenSync (consent + device)

| Surface                  | Topics                                                                                                                   |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------ |
| Device connection status | `sensync.device.connected`, `sensync.device.disconnected`, `sensync.hardware.connected`, `sensync.hardware.disconnected` |
| Consent state            | `sensync.consent.granted`, `sensync.consent.revoked`                                                                     |

---

## Request/response surfaces (no live updates required)

These surfaces use HTTP request/response. Wireframes can use refresh
patterns or stale-while-revalidate fetches.

| Surface                              | Reasoning                                                                                                                                                      |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/wallet` initial load               | Snapshot view; `generated_at_utc` shown. Polling not required at load — the wallet is request/response on action, NATS-driven on long-running session if open. |
| `/tokens` bundle list                | Static REDBOOK rate-card data; rarely changes.                                                                                                                 |
| `/diamond/purchase` quote            | Quote is generated on demand; not live. The quote _expiry_ is shown to the user, not pushed.                                                                   |
| Account settings                     | Static profile.                                                                                                                                                |
| Billing history                      | Snapshot view with pagination.                                                                                                                                 |
| Earnings / payout history (creator)  | Snapshot view; pagination.                                                                                                                                     |
| KYC / age verification flow          | Wizard; transitions are user-driven, not server-pushed.                                                                                                        |
| Game UIs (dice, slot machine, wheel) | Game outcomes use `game.outcome` topic for _recording_, but the user-facing animation is request/response.                                                     |

If a surface is in this list, the wireframe should **not** show a "live"
indicator or animate updates without user action — it would imply
behavior the system doesn't deliver.

---

## Hybrid surfaces (initial fetch + live deltas)

Some surfaces fetch a snapshot, then subscribe to deltas:

| Surface            | Initial fetch                   | NATS deltas                                                   |
| ------------------ | ------------------------------- | ------------------------------------------------------------- |
| Live stream viewer | Stream metadata + chat backlog  | `chat.broadcast.staggered`, `hz.haptic.trigger`, `ffs.scored` |
| `/creator/control` | Session snapshot + FFS baseline | `ffs.scored`, `cyrano.*`, `chat.*`, `sensync.*`               |
| `/admin/diamond`   | Liquidity view + open queue     | `gateguard.*`, `wgs.*`, `audit.immutable.*`                   |

For these surfaces, wireframes show:

- Initial loading state (skeleton or spinner)
- Loaded snapshot with `generated_at_utc`
- Subsequent updates animating in (subtle highlight on changed rows)
- Connection-state indicator near the live region

---

## Reconnect / backoff UX

Detailed in [`06-idempotency-ratelimit.md`](06-idempotency-ratelimit.md). Summary:

| State                    | Wireframe                                 |
| ------------------------ | ----------------------------------------- |
| `CONNECTED`              | (No banner)                               |
| `RECONNECTING` < 30s     | Subtle dot / fade near affected widget    |
| `RECONNECTING` > 30s     | Banner: "Reconnecting to live updates…"   |
| `DISCONNECTED` (gave up) | Banner: "Live updates paused. → [reload]" |
| `RECOVERED`              | 2s toast: "Reconnected"                   |

---

## Topic-name discipline

- Wireframe annotations may **reference** a topic name when documenting which field updates from where.
- Wireframes do **not** dictate topic strings. Engineering controls the registry.
- New surfaces that need new topics require a `NATS:` directive that adds the topic to `services/nats/topics.registry.ts` and references it from the page builder render plan.

---

## Forbidden patterns

- ❌ REST polling for chat or haptic.
- ❌ "Refresh chat" buttons on the live viewer.
- ❌ Showing live indicators on request/response surfaces.
- ❌ Silent NATS reconnects (no UI cue).
- ❌ Inventing topic names not in the registry.
