# Flicker n'Flame Scoring (FFS) — `services/ffs/`

**Work Order:** WO-003  
**Business Plan Reference:** B.4 — Room-level telemetry  
**Rule ID:** `ROOM_HEAT_ENGINE_v2`  
**Status:** Active

---

## Purpose

The Flicker n'Flame Scoring (FFS) computes a real-time **composite heat score (0–100)** for every
live creator session.  The score is published to NATS at **1 Hz** and consumed by:

- **CreatorControl.Zone** — session suggestions and price nudges  
- **Cyrano** — suggestion weighting and category selection  
- **Integration Hub** — payout scaling and Diamond Concierge handoffs  
- **Leaderboard surface** — 10 × 10 grid sorted coolest-to-hottest

---

## Architecture

```
NATS (HZ_BPM_UPDATE, CHAT_MESSAGE_INGESTED)
        │
        ▼
 RoomHeatService.ingest(RoomHeatInput)
        │
        ├─ calculateComponents()   ← 13 weighted signals
        ├─ earlyPhaseBoost()       ← +10 % if dwell < 5 min
        ├─ dualFlameBonus()        ← up to +5 pts from partner
        ├─ resolveAntiFlickerTier() ← 3-tick confirmation rule
        │
        ├─ NATS publish (ROOM_HEAT_SAMPLE, ROOM_HEAT_TIER_CHANGED,
        │                ROOM_HEAT_PEAK, ROOM_HEAT_HOT_AND_READY,
        │                ROOM_HEAT_DUAL_FLAME_PEAK)
        │
        ├─ Prisma.roomHeatSnapshot.create()  (async)
        │
        └─ 1 Hz interval → re-emit with refreshed timestamp
```

---

## Score Composition (sum of ceilings = 100)

| Signal | Max pts | Input field |
|--------|--------:|-------------|
| Tip pressure | 15 | `tips_per_min` |
| Chat velocity | 8 | `chat_velocity_per_min` |
| Dwell | 5 | `dwell_minutes` |
| Heart reactions | 8 | `heart_reactions_per_min` |
| Private/spy viewers | 5 | `private_spy_count` |
| Heart rate delta | 12 | `heart_rate_bpm − heart_rate_baseline_bpm` |
| Eye tracking | 6 | `eye_tracking_score` (0–1) |
| Facial excitement | 7 | `facial_excitement_score` (0–1) |
| Skin exposure | 5 | `skin_exposure_score` (0–1) |
| Motion | 5 | `motion_score` (0–1) |
| Audio vocal ratio | 5 | `audio_vocal_ratio` (0–1) |
| 5-min momentum | 10 | `heat_trend_5min` |
| Hot streak | 9 | `hot_streak_ticks` |
| **Total** | **100** | |

---

## Tier Bands (canonical — DOMAIN_GLOSSARY.md)

| Tier | Score range | Payout rate |
|------|-------------|-------------|
| COLD | 0–33 | $0.075 / CZT |
| WARM | 34–60 | $0.080 / CZT |
| HOT | 61–85 | $0.085 / CZT |
| INFERNO | 86–100 | $0.090 / CZT |

---

## Anti-Flicker Rule

A tier transition is only confirmed after **3 consecutive ticks** agree on the new
tier.  This prevents rapid oscillation around a band boundary from thrashing
downstream consumers.

---

## Leaderboard Grid (10 × 10)

- Rank 0 (top-left) = **coolest** active session  
- Rank 99 (bottom-right) = **hottest** active session  
- Up to 100 concurrent sessions rendered  
- Categories: `all`, `standard`, `dual_flame`, `hot_and_ready`, `new_flames`  
- **Hot and Ready**: score ≥ 70 **and** dwell ≥ 10 min  
- **New Flames**: session started < 15 min ago

---

## NATS Topics

| Topic constant | Subject | When emitted |
|----------------|---------|--------------|
| `ROOM_HEAT_SAMPLE` | `room.heat.sample` | Every ingest (and 1 Hz re-emit) |
| `ROOM_HEAT_TIER_CHANGED` | `room.heat.tier.changed` | Tier crosses a band boundary |
| `ROOM_HEAT_PEAK` | `room.heat.peak` | Score enters INFERNO |
| `ROOM_HEAT_HOT_AND_READY` | `room.heat.hot_and_ready` | Score ≥ 70 + dwell ≥ 10 min |
| `ROOM_HEAT_DUAL_FLAME_PEAK` | `room.heat.dual_flame.peak` | Dual Flame session hits INFERNO |
| `ROOM_HEAT_LEADERBOARD_UPDATED` | `room.heat.leaderboard.updated` | ~every 10 s |
| `ROOM_HEAT_SESSION_STARTED` | `room.heat.session.started` | `startSession()` called |
| `ROOM_HEAT_SESSION_ENDED` | `room.heat.session.ended` | `endSession()` called |
| `ROOM_HEAT_ADAPTIVE_UPDATED` | `room.heat.adaptive.updated` | Adaptive weights shift after tip |

---

## REST Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/ffs/leaderboard?category=all` | 10×10 leaderboard |
| `GET` | `/ffs/session/:id` | Current score for a session |
| `POST` | `/ffs/ingest` | Ingest a telemetry frame |
| `POST` | `/ffs/session/:id/start` | Pre-register a session |
| `DELETE` | `/ffs/session/:id` | End a session |
| `POST` | `/ffs/tip-event` | Trigger adaptive learning from a tip |
| `GET` | `/ffs/adaptive-weights/:creatorId` | Read creator adaptive multipliers |

---

## Adaptive Learning

When a tip event fires (`learnFromTipEvent()`), the engine identifies which
signals were elevated (≥ 70 % of their normalisation ceiling) at tip time:

- **Elevated signals**: multiplier boosted by +2 % (capped at 1.20)  
- **Non-elevated signals**: multiplier decayed by −0.5 % (floored at 0.80)

Multipliers are persisted to `room_heat_adaptive_weights` and cached in-memory.

---

## Database Tables

| Table | Purpose |
|-------|---------|
| `room_heat_snapshots` | Append-only time-series of every heat score computed |
| `room_heat_adaptive_weights` | One row per creator — learned component multipliers |

---

## Environment Variables

See `.env.example` in this directory.
