# Cyrano — Whisper Copilot Service

**Service prefix:** `CYR:`  
**Domain:** Creator coaching / AI suggestion layer  
**Path:** `services/cyrano/`

## Purpose

Cyrano is the invisible whisper copilot for ChatNow.Zone creators. It
evaluates real-time session telemetry (room heat, dwell, silence, guest
history) and surfaces context-weighted suggestions to the creator's panel.
Suggestions are never visible to the guest.

## Architecture

Cyrano Layer 1 is a deterministic, rule-based engine. Layer 2 (LLM
refinement) is a planned follow-up.

### Components

| File | Role |
|------|------|
| `cyrano.service.ts` | Core suggestion engine — category selection, weight computation, copy generation |
| `persona.manager.ts` | Creator persona registry + session activation |
| `session-memory.store.ts` | In-process (creator_id, guest_id) durable fact + arc store |
| `cyrano.types.ts` | Shared TypeScript contracts |
| `cyrano.module.ts` | NestJS module wiring |

## Suggestion Categories

| Category | When to Surface |
|----------|----------------|
| `CAT_SESSION_OPEN` | Session start (COLD heat, OPENING phase) |
| `CAT_ENGAGEMENT` | Mid-session flow maintenance |
| `CAT_ESCALATION` | HOT / INFERNO heat — intimacy escalation |
| `CAT_NARRATIVE` | Arc reinforcement |
| `CAT_CALLBACK` | ≥2 durable facts on record + WARM/HOT phase |
| `CAT_RECOVERY` | Silence ≥ 60 s or COLD heat in mid-session |
| `CAT_MONETIZATION` | HOT+ heat, untipped guest, or PEAK phase |
| `CAT_SESSION_CLOSE` | CLOSING phase or INFERNO heat winding down |

## Latency SLOs

| Target | Value |
|--------|-------|
| Ideal | < 2 000 ms |
| Hard cutoff | < 4 000 ms |

Suggestions exceeding the hard cutoff are silently discarded. A
`CYRANO_SUGGESTION_DROPPED` NATS event is emitted for audit.

## Persona Model

Each creator may register multiple personas. Exactly one persona is
active per session. Tone and style notes from the active persona feed
into suggestion copy templates.

## Session Memory

`SessionMemoryStore` maintains (creator_id, guest_id)-scoped facts and
narrative arcs across sessions. Facts drive `CAT_CALLBACK` suggestions.
In Layer 1, storage is in-process; Layer 2 will persist to Prisma.

## NATS Topics Emitted

| Topic | When |
|-------|------|
| `cyrano.suggestion.emitted` | Valid suggestion dispatched |
| `cyrano.suggestion.dropped` | Suggestion discarded (latency or no match) |
| `cyrano.memory.updated` | Durable fact updated (emitted by caller) |

## Integration

Cyrano is consumed by the Integration Hub (`services/integration-hub/`),
which subscribes to ffs and session events and forwards
`CyranoInputFrame` objects to `CyranoService.suggest()`.

Cyrano is **not** directly exposed via REST — suggestions flow exclusively
through the creator's copilot panel via NATS.
