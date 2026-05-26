# 06 — Idempotency + Rate-Limit Envelope

**Status:** ALPHA-FROZEN 2026-04-28
**Purpose:** What the UI must do on `correlation_id` collision, on 429, on NATS reconnect.

CNZ enforces idempotency at every financial / audit / gate write. The
envelope is non-negotiable; wireframes that ignore it will produce
double-charges, ghost transactions, or stuck retries in production.

---

## The `correlation_id` contract

**Every mutation request the UI initiates must carry a client-generated `correlation_id`.**

- Format: 64-character string (UUID v4 is acceptable; longer prefixed
  forms also accepted — see `services/core-api/src/common/correlation.ts`).
- Generation: client-side, **once per intent**. If the user clicks
  "Pay" three times, all three clicks carry the **same** `correlation_id`.
- Persistence: stored in a session-scoped store (e.g. React state +
  sessionStorage) keyed by intent. Cleared only on success or explicit cancel.
- Propagation: included in the request body or `x-correlation-id`
  header per endpoint convention.

**Wireframes must show the correlation_id on operator surfaces** (one-line, copy-to-clipboard) wherever a row corresponds to a financial or audit event. End-user surfaces never display it.

---

## Replay outcomes

The server returns one of three outcomes for any retried mutation:

| HTTP                                                 | Meaning                                                 | UI behavior                                                                                                                           |
| ---------------------------------------------------- | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| **200** with no `replay` flag                        | Fresh write succeeded                                   | Render success state.                                                                                                                 |
| **200** with `replay: true` and identical payload    | Idempotent replay — server returned the original result | Render success state. **Do not show "duplicate" or "already done" copy** — that confuses users. The state is correct; show it.        |
| **409** `reason_code: IDEMPOTENCY_DIVERGENT_PAYLOAD` | Same `correlation_id` was used with a different payload | Show divergence error: "This request differs from an earlier attempt. → [refresh and try again]" — wireframe must include this state. |

The 409 path commonly fires when:

- The user edits a form mid-retry (e.g. types in the amount, then retries).
- Two browser tabs share a `correlation_id` from sessionStorage and one tab edited locally.
- A flaky network caused a partial submit; the user reloaded and re-typed values.

**Recovery action:** the UI clears the stored `correlation_id` for that
intent and starts fresh (new id, new request). This is a single click /
tap — wireframe needs the affordance.

---

## 429 handling (rate limit)

Returned `reason_code: RATE_LIMITED_PER_SECOND` (or similar). Headers
include `Retry-After` (seconds).

UI behavior:

- **Auto-retry once** with exponential backoff (1s, then 2s, then 4s — three attempts max).
- During retry, wireframe shows a non-blocking spinner / "retrying…" state, **not** an error toast (the user didn't fail; the system asked for a moment).
- After three failures, surface: "We're rate-limited right now. Try again in {Retry-After} seconds."
- For destructive actions (spend, recovery accept, step-up grant): **never auto-retry**. Show the wait-time and let the user re-trigger.

---

## NATS subscription drops

NATS-driven surfaces (chat, haptic, FFS meter, GateGuard alerts — see
[`09-realtime-topology.md`](09-realtime-topology.md)) reconnect with
exponential backoff on disconnect.

UI behavior:

| Connection state            | UX surface                                                                                     |
| --------------------------- | ---------------------------------------------------------------------------------------------- |
| `CONNECTED`                 | (No banner; live data flows)                                                                   |
| `RECONNECTING` (within 30s) | Subtle indicator near the affected widget — small dot or fade pattern. Do **not** lock the UI. |
| `RECONNECTING` (> 30s)      | Promote to a full banner: "Reconnecting to live updates…"                                      |
| `DISCONNECTED` (gave up)    | Banner: "Live updates paused. → [reload]"                                                      |
| `RECOVERED`                 | Brief toast: "Reconnected" — auto-dismiss in 2s                                                |

**Forbidden:** silent failure. NATS-driven widgets that go stale
without a connection-state cue are a P0 wireframe violation.

---

## NATS topic bind discipline

Wireframes do not specify topic strings. They specify **which presenter
field** updates from real-time vs request/response. The mapping topic →
field lives in the page builder render plan, not in the wireframe.

If a wireframe shows live updates on a field, [`09-realtime-topology.md`](09-realtime-topology.md) must list it as NATS-driven.

---

## Cyrano L4 enterprise envelope (out-of-scope for Alpha UI but bound to same rules)

Cyrano L4 is an enterprise B2B Whisper API (deferred Year 3+; see
`docs/DOMAIN_GLOSSARY.md`). It uses API-key auth and the same
`correlation_id` envelope. Alpha wireframes do not include L4 surfaces —
flagged here only because L4 reason codes (`API_KEY_INVALID`,
`API_KEY_MISSING`, `API_KEY_REVOKED`) appear in the §04 catalog and
designers may wonder why.

---

## Anti-patterns (don't ship these)

- ❌ Generating a new `correlation_id` on each retry.
- ❌ Showing "duplicate transaction" / "already processed" on 200 idempotent replay.
- ❌ Auto-retrying spend / recovery / step-up requests without user re-trigger.
- ❌ Silent NATS reconnects with no UI cue.
- ❌ Hiding the `correlation_id` on operator surfaces.
- ❌ Displaying the `correlation_id` on end-user surfaces.
