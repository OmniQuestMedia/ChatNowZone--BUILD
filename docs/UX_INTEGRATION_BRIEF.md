# ChatNow.Zone — UX Integration Brief

**Authority:** Kevin B. Hartley, CEO — OmniQuest Media Inc.
**Status:** **ALPHA-FROZEN 2026-04-28** — content changes require a `GOV:` or `FIZ:` directive.
**Audience:** Grok (wireframe coordination across OQMI entities), and any front-end design or engineering thread that binds to the ChatNow.Zone codebase.
**Cross-stack role:** This packet is the **CNZ source-of-truth**. RedRoomRewards and Cyrano packets reconcile against it (per CEO instruction 2026-04-28).

---

## Why this packet exists

Wireframes need to bind to the codebase as it actually is, not as a designer
imagines it. This packet enumerates the **contracts, state machines, error
codes, tier rules, idempotency envelope, real-time topology, compliance
overlays, vocabulary, role inventory, and explicit non-scope** that
wireframes for ChatNow.Zone Alpha must respect.

A wireframe that respects this packet can be wired into the Next.js app
shell with zero contract translation. A wireframe that does not will be
rejected at integration review.

---

## Bind target

Wireframes do **not** bind to a raw HTTP API. CNZ Alpha has no public
OpenAPI surface and will not ship one. The bind target is the
**presenter contract layer** at `ui/types/`. Presenters are the canonical
screen-data shapes — every property the UI is allowed to render. The
backend can refactor freely behind a presenter; the presenter is the
stable seam.

Frozen presenter files (this packet's §01 enumerates them in detail):

```
ui/types/admin-diamond-contracts.ts
ui/types/creator-control-contracts.ts
ui/types/creator-panel-contracts.ts
ui/types/gamification-contracts.ts
ui/types/public-wallet-contracts.ts
```

---

## Packet contents (read in order)

| File | Purpose |
|------|---------|
| [`ux/01-presenter-contracts.md`](ux/01-presenter-contracts.md) | Frozen presenter list with `@alpha-frozen` markers and consumption notes |
| [`ux/02-endpoint-inventory.md`](ux/02-endpoint-inventory.md) | Role × surface matrix; which user role sees which screen and which actions trigger step-up |
| [`ux/03-state-machines.md`](ux/03-state-machines.md) | All UI-relevant state machines (token purchase, membership, recovery, Cyrano session, FFS tiers, WGS bands, step-up, Pixel Legacy onboarding, Diamond Concierge handoff, idempotency replay) |
| [`ux/04-reason-code-catalog.md`](ux/04-reason-code-catalog.md) | `reason_code` enumeration with recommended user-facing copy slots |
| [`ux/05-tier-entitlements.md`](ux/05-tier-entitlements.md) | 6-tier `MembershipTier` × entitlement matrix; Pixel Legacy vs Standard creator; Cyrano access policy; Diamond Concierge zero-earn; inferno multiplier visibility |
| [`ux/06-idempotency-ratelimit.md`](ux/06-idempotency-ratelimit.md) | `correlation_id` envelope, replay semantics, 429 handling, NATS reconnect UX |
| [`ux/07-cross-stack-vocabulary.md`](ux/07-cross-stack-vocabulary.md) | CNZ canonical terms cross-walked to RRR + Cyrano; "never alias" list; component ontology |
| [`ux/08-not-in-alpha.md`](ux/08-not-in-alpha.md) | Explicit non-scope so wireframes don't design dead screens |
| [`ux/09-realtime-topology.md`](ux/09-realtime-topology.md) | NATS-driven surfaces vs request/response; reconnect/backoff UX |
| [`ux/10-compliance-overlays.md`](ux/10-compliance-overlays.md) | Cross-cutting overlays (Bill 149, Sovereign CaC, KYC, step-up, WGS interventions, geo-block) — shared visual language across all three OQMI entities |

---

## Canonical sources this packet defers to

When this packet and a canonical source disagree, **the canonical source
wins** and this packet is corrected via directive.

| Concept | Canonical source |
|---------|-----------------|
| Naming, terminology, retired terms | [`docs/DOMAIN_GLOSSARY.md`](DOMAIN_GLOSSARY.md) |
| Membership policy, age re-verify cadence, paid blocks | [`docs/MEMBERSHIP_LIFECYCLE_POLICY.md`](MEMBERSHIP_LIFECYCLE_POLICY.md) |
| Architecture map, cross-payload wiring | [`docs/ARCHITECTURE_OVERVIEW.md`](ARCHITECTURE_OVERVIEW.md) |
| Pre-launch ship gates | [`docs/PRE_LAUNCH_CHECKLIST.md`](PRE_LAUNCH_CHECKLIST.md) |
| Live requirements matrix | [`docs/REQUIREMENTS_MASTER.md`](REQUIREMENTS_MASTER.md) |
| Governance, invariants, commit prefixes | [`PROGRAM_CONTROL/DIRECTIVES/QUEUE/OQMI_GOVERNANCE.md`](../PROGRAM_CONTROL/DIRECTIVES/QUEUE/OQMI_GOVERNANCE.md) |
| NATS topic registry | [`services/nats/topics.registry.ts`](../services/nats/topics.registry.ts) |
| Spend order, three-bucket | `LEDGER_SPEND_ORDER` constant in `services/ledger/` |
| REDBOOK rate cards | `REDBOOK_RATE_CARDS` constants in `services/ledger/` |

---

## How to update this packet

This packet is **Alpha-frozen**. Updates flow through one of:

- `GOV:` directive — for cross-stack vocabulary, role inventory, non-scope
- `FIZ:` directive — for any item that touches financial integrity (rates, tiers, payout, recovery, escrow analogs)
- `UI:` directive — for presenter-contract changes

Drive-by edits are not permitted. Any change to a presenter contract that
breaks an existing wireframe binding is a versioned migration; the prior
shape stays available behind `@deprecated` until the wireframe is updated.

---

## Cross-stack reconciliation

CNZ + RRR + Cyrano share a wireframe vocabulary so that an OQMI guest
moving between products feels one platform, not three. The bridge lives
in [`ux/07-cross-stack-vocabulary.md`](ux/07-cross-stack-vocabulary.md).

Grok is the cross-stack coordinator. RRR and Cyrano packets reconcile
against this CNZ packet; where they diverge intentionally, the
divergence is documented in §07 with the reason. Where they diverge
unintentionally, this packet wins and the other two correct.

The three-stack reconciliation record — shared components, compliance
overlays, intentional divergences, gap register, and coordination
protocol — lives in [`docs/UX_CROSS_STACK_ALIGNMENT.md`](UX_CROSS_STACK_ALIGNMENT.md).
