# Cyrano — ASSUMPTIONS.md

## A001 — In-Process Memory Only (Layer 1)
`SessionMemoryStore` is an in-process Map. A process restart clears all
facts and arcs. Layer 2 will introduce a Prisma-backed persistent store.
Callers must accept the possibility of a cold-memory start after restart.

## A002 — One Active Persona Per Session
`PersonaManager` enforces a single active persona per `session_id`.
Activating a new persona for the same session overwrites the prior
activation. Personas must be registered via `PersonaManager.register()`
before they can be activated.

## A003 — Suggestion Copy Is Template-Based (Layer 1)
`buildCopy()` returns short template strings parameterised by category
and heat tier. Layer 2 will replace this with LLM-generated copy refined
by persona tone and guest history.

## A004 — Latency Measured from Frame Receipt
`latency_ms` in each `CyranoSuggestion` measures time from
`frame.captured_at_utc` to emit. Clock skew between the calling service
and the Cyrano process is not corrected.

## A005 — No Guest Visibility Guarantee
Cyrano enforces invisibility by design: suggestions are published to
`CYRANO_SUGGESTION_EMITTED` only. The creator panel consumes this topic.
Cyrano itself does not control UI rendering — the panel must never expose
suggestions to the guest-facing stream.

## A006 — Heat Tier Is Caller-Provided
Cyrano does not subscribe to Flicker n'Flame Scoring directly. The `CyranoInputFrame`
must include a valid `heat` object. In production, the Integration Hub
composes the frame from Flicker n'Flame Scoring snapshots and session telemetry.

## A007 — Category Weight Matrix Is Static
`CATEGORY_TIER_WEIGHTS` is a compile-time constant. Retuning requires a
code change and redeploy. A future governance-controlled config table
will allow runtime adjustment without redeploy.
