# ChatNow.Zone — UX Cross-Stack Alignment

**Authority:** OQMInc Engineering Team
**Status:** ALPHA-FROZEN 2026-04-28 — content changes require a `GOV:` directive.
**Audience:** Grok (wireframe coordination across OQMI entities), engineering leads, and any agent authoring UX for CNZ, RRR, or Cyrano.
**Relationship to UX packet:** This is the cross-stack reconciliation companion to [`docs/UX_INTEGRATION_BRIEF.md`](UX_INTEGRATION_BRIEF.md). The brief is CNZ-internal; this document covers the three-stack surface explicitly.

---

## Purpose

Three OQMI entities share a wireframe library and a guest-facing brand voice:

| Stack      | Entity                      | UX packet                                                                                   |
| ---------- | --------------------------- | ------------------------------------------------------------------------------------------- |
| **CNZ**    | ChatNow.Zone                | [`docs/UX_INTEGRATION_BRIEF.md`](UX_INTEGRATION_BRIEF.md) + [`docs/ux/`](ux/) (10 sections) |
| **RRR**    | RedRoomRewards              | _Packet not yet authored — see Gap Register §7_                                             |
| **Cyrano** | Cyrano™ AI Whisper Platform | _Packet not yet authored — see Gap Register §7_                                             |

A guest moving across CNZ, RRR, and Cyrano must experience **one platform**, not three brand voices. This document is the single record of what is shared, what diverges by design, and who wins when there is a conflict.

---

## §1 — Authority Hierarchy

**CNZ is the source-of-truth.** Per CEO instruction 2026-04-28:

> "RedRoomRewards and Cyrano packets reconcile against it [the CNZ packet]."

Resolution order when a cross-stack conflict exists:

1. `docs/DOMAIN_GLOSSARY.md` — naming and terminology (supersedes all)
2. `docs/UX_INTEGRATION_BRIEF.md` (CNZ packet) — behavior, component API, state
3. `docs/RRR_CEO_DECISIONS_FINAL_2026-04-17.md` — locked RRR-specific decisions
4. Cyrano packet _(when authored)_ — Cyrano-specific decisions

Where a RRR or Cyrano wireframe diverges from the CNZ packet _unintentionally_, **CNZ wins and the other two correct**. Where divergence is _intentional_ (see §5), the divergence is documented here with the reason. Intentional divergence does not require CNZ to change.

---

## §2 — Shared Vocabulary

Canonical terms for all three stacks live in [`docs/ux/07-cross-stack-vocabulary.md`](ux/07-cross-stack-vocabulary.md).

**Rule:** every wireframe for every stack uses the same canonical names listed there. A term that is canonical in CNZ is canonical in RRR and Cyrano unless `07-cross-stack-vocabulary.md` explicitly documents a locally-scoped name.

The cross-walk table in §07 maps the same concept across all three stacks:

| Concept                 | CNZ name                                                   | RRR name                                              | Cyrano name                                                  |
| ----------------------- | ---------------------------------------------------------- | ----------------------------------------------------- | ------------------------------------------------------------ |
| User-held value         | Three-bucket wallet (`purchased` / `membership` / `bonus`) | Escrow (hold → settle / refund / partial)             | _(n/a — Cyrano debits CNZ wallet)_                           |
| Balance display         | Three-bucket display                                       | Escrow lifecycle card                                 | Minutes-remaining gauge                                      |
| Tier ladder             | 6-tier `MembershipTier` (`GUEST` → `VIP_DIAMOND`)          | RRR merchant tier (Layer 1 at launch)                 | Tier-graduated access policy (binds to CNZ `MembershipTier`) |
| Inferno multiplier      | `RATE_INFERNO` ($0.090/CZT) at FFS `INFERNO` tier          | Inferno multiplier (same name; same visibility rules) | _(Cyrano surfaces inferno via creator's CNZ session)_        |
| Heat tier visualization | FFS meter (`COLD`/`WARM`/`HOT`/`INFERNO`)                  | Heat indicator (binds to CNZ FFS)                     | _(Cyrano displays heat as session context)_                  |
| Diamond Concierge       | Operator role — $0.077 floor + zero-earn                   | Zero-earn rule (identical per D3)                     | _(n/a)_                                                      |
| Step-up auth            | RBAC step-up modal                                         | RBAC step-up (identical component)                    | RBAC step-up (identical)                                     |
| Audit row               | Hash-chained `AuditEvent` + `correlation_id`               | RRR variant (same shape)                              | Cyrano session events                                        |
| Compliance overlay      | Bill 149 prefix on `CREATOR_AUTO=true`                     | Bill 149 prefix (identical)                           | Bill 149 prefix (identical, AI-generated output)             |
| WGS interventions       | `SOFT_NUDGE` / `COOL_DOWN` / `HARD_DECLINE_HCZ`            | _(TBD — names match if WGS present)_                  | _(TBD — names match if WGS present)_                         |
| Real-time fabric        | NATS topic registry                                        | NATS (shared registry)                                | NATS (shared registry)                                       |

**Source authority:** [`docs/ux/07-cross-stack-vocabulary.md`](ux/07-cross-stack-vocabulary.md). On any naming disagreement, the glossary wins.

---

## §3 — Shared Component Library

The following components have **identical APIs, visual treatments, and behavior** across all three stacks. A component that ships in one stack ships in all stacks where the surface exists.

| Component                    | CNZ surface                                        | RRR surface                 | Cyrano surface                      |
| ---------------------------- | -------------------------------------------------- | --------------------------- | ----------------------------------- |
| `<TierBadge />`              | 6 `MembershipTier` values + creator types          | RRR merchant tier rendering | Cyrano tier badge in console header |
| `<HeatMeter />`              | FFS meter on `/creator/control` + `/admin/diamond` | RRR heat surfaces           | Cyrano session context              |
| `<StepUpModal />`            | RBAC step-up on all admin/operator actions         | RBAC step-up (identical)    | RBAC step-up (identical)            |
| `<AuditRow />`               | `/admin/recovery`, `/admin/diamond` audit chain    | RRR audit                   | Cyrano session log                  |
| `<KPICard />`                | Admin surfaces                                     | RRR KPI rows                | Cyrano operator KPI                 |
| `<Bill149Prefix />`          | Every `CREATOR_AUTO=true` rendered string          | Identical                   | Identical                           |
| `<GeoBlockOverlay />`        | Sovereign CaC denial                               | Identical                   | Identical                           |
| `<KYCGate />`                | KYC flow (first purchase / paid-tier upgrade)      | Identical                   | _(n/a — Cyrano binds to CNZ KYC)_   |
| `<WGSInterventionOverlay />` | `SOFT_NUDGE` / `COOL_DOWN` / `HARD_DECLINE_HCZ`    | _(If WGS present in RRR)_   | _(If WGS present in Cyrano)_        |

Components that are stack-specific (not shared):

| Component              | Stack                         | Reason not shared                                                    |
| ---------------------- | ----------------------------- | -------------------------------------------------------------------- |
| `<WalletDisplay />`    | CNZ                           | RRR uses `<EscrowDisplay />` instead — different financial primitive |
| `<EscrowDisplay />`    | RRR                           | CNZ three-bucket wallet does not have escrow semantics               |
| `<MinutesRemaining />` | Cyrano (on CNZ guest surface) | Time-based session gauge; no analog in RRR                           |

---

## §4 — Shared Compliance Overlays

All compliance overlays are **non-removable** and **identical** across all three stacks wherever the trigger condition applies. Full specification lives in [`docs/ux/10-compliance-overlays.md`](ux/10-compliance-overlays.md).

| Overlay                                                                   | Trigger                                                           | Cross-stack status                                                            |
| ------------------------------------------------------------------------- | ----------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `<Bill149Prefix />`                                                       | `CREATOR_AUTO=true` output                                        | **Required** in CNZ, RRR, Cyrano wherever AI-generated content surfaces       |
| `<SovereignCaCGate />`                                                    | Adult-content surface in age-verification jurisdiction            | **Required** in CNZ; RRR and Cyrano apply if they have adult-content surfaces |
| `<KYCGate />`                                                             | First purchase / paid-tier upgrade / financial threshold mutation | **Required** in CNZ; RRR applies on equivalent purchase events                |
| `<StepUpModal />`                                                         | RBAC `step_up_required: true` action                              | **Required** across all three stacks                                          |
| WGS intervention overlays (`SOFT_NUDGE`, `COOL_DOWN`, `HARD_DECLINE_HCZ`) | WGS score crossing band threshold                                 | Defined in CNZ; RRR + Cyrano implement identically if WGS is present          |
| `<GeoBlockOverlay />` / `<InlineBlockNotice />`                           | `GEO_BLOCKED`, `DOMAIN_BLOCKED`, `EMAIL_DOMAIN_BLOCKED`           | **Required** across all three stacks                                          |
| `<LegalHoldNotice />`                                                     | `LEGAL_HOLD_ACTIVE` on a mutation attempt                         | **Required** across all three stacks; subject sees only consequence           |
| `<TestModeBanner />`                                                      | Alpha feature flag `PAYMENT_PROCESSOR_STUB_MODE`                  | **Required** on all purchase surfaces in Alpha across all three stacks        |

**Component contract (all stacks, all overlays):**

- `test_id` per `ui/config/accessibility.ts`
- ARIA role + label
- Keyboard-accessible (focus trap on modal overlays)
- Renders at all breakpoints (375 / 768 / 1280 / 1680)
- Dark-mode default; respects `THEME` tokens
- `reason_code` prop drives visible copy (no hardcoded strings)

---

## §5 — Intentional Divergences (By Design)

These are not errors. Do not "fix" them by unifying at the cost of one stack's canonical behavior.

| Topic                        | CNZ                                                                                                                               | RRR                                                                                                                                           | Cyrano                                                              | Reason                                                                        |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| **Game surfaces**            | Slot machine, dice, wheel of fortune — **retained** (presenter contracts in `ui/components/`)                                     | Slot machine **retired** (CEO decision D1); dice/wheel TBD                                                                                    | _(n/a — Cyrano is a whisper platform, not a gaming surface)_        | CNZ is a gaming platform; RRR is not                                          |
| **Wallet primitive**         | Three-bucket (`purchased` / `membership` / `bonus`) with deterministic spend order                                                | Escrow lifecycle (hold → settle / refund / partial)                                                                                           | Minutes-remaining gauge (time-based; no separate balance)           | Different financial semantics per stack                                       |
| **Tier model at launch**     | 6-tier `MembershipTier` (`GUEST` → `VIP_DIAMOND`)                                                                                 | Merchant tier (Layer 1 at launch); RRR member tier deferred (B2, B3)                                                                          | Tier-graduated Cyrano access policy binding to CNZ `MembershipTier` | RRR is B2B/merchant-centric; CNZ is consumer-tier-centric                     |
| **RRR Phase 1 / Phase 2**    | CNZ is Phase 2 in the RRR launch sequence (full CNZ/RRR integration after Phase 1 learning)                                       | Phase 1: RedRoomPleasures + Cyrano. Phase 2: ChatNow.Zone.                                                                                    | Cyrano is a Phase 1 RRR merchant                                    | Launch sequencing per CEO decision B3                                         |
| **Diamond earn rule**        | Creators on Diamond Concierge sessions earn **zero** — payout floor enforced at $0.077 but no earn event fires on operator's side | Diamond Concierge earn = 0 RRR points (CEO decision D3); RRR points _can_ be burned against Diamond purchase                                  | _(n/a)_                                                             | CEO-locked: Diamond Concierge is Security/Fraud, not a creator-earn surface   |
| **Inferno multiplier value** | Governed by `RATE_INFERNO` constant in `services/ledger/`                                                                         | Merchant-configurable via `inferno_multiplier` on `EarnRateConfig`; no platform default; required before program activation (CEO decision B1) | _(Cyrano surfaces via creator's CNZ session)_                       | RRR is SaaS with configurable merchant earn rates; CNZ has platform constants |
| **Cyrano wallet**            | Cyrano top-ups debit through **CNZ three-bucket wallet** via `LedgerService.spend`                                                | _(RRR does not hold Cyrano tokens)_                                                                                                           | No separate Cyrano wallet                                           | Single-wallet architecture per CEO design                                     |
| **Voice mode default**       | Cyrano L2 voice mode is a **top-up unlock**; default is text-mode                                                                 | _(n/a)_                                                                                                                                       | Text-mode default; voice-mode unlocked per top-up SKU               | Alpha scope constraint — may change in `CYRANO-ACCESS-POLICY-001`             |

---

## §6 — Cross-Stack Coordination Protocol (Grok Guide)

Grok is the designated cross-stack wireframe coordinator (per [`docs/UX_INTEGRATION_BRIEF.md`](UX_INTEGRATION_BRIEF.md)).

**When adding a component to any stack:**

1. Check §3 (Shared Component Library) — if the component is listed as shared, the implementation must be identical across all stacks.
2. If the component is new and has potential cross-stack applicability, evaluate against §4 (compliance) and §5 (intentional divergences) before deciding scope.
3. Propose cross-stack adoption only via a `GOV:` directive that references this document.

**When a vocabulary disagreement surfaces between stacks:**

1. Check [`docs/ux/07-cross-stack-vocabulary.md`](ux/07-cross-stack-vocabulary.md) first.
2. If the term is in the "Never alias" table — enforce the canonical form, no exception.
3. If the term is not in the table — check [`docs/DOMAIN_GLOSSARY.md`](DOMAIN_GLOSSARY.md).
4. If the glossary has no entry — open a `GOV:` directive to add it. CEO authorization required before any wireframe uses the term.

**When a wireframe for RRR or Cyrano diverges from CNZ:**

1. Confirm the divergence is in §5 (intentional) before treating it as a bug.
2. If not in §5 — the divergence is unintentional. CNZ is correct; update the RRR or Cyrano wireframe.
3. If the divergence should be intentional but is not yet documented — open a `GOV:` directive to add a row to §5.

**Merge path for cross-stack UX changes:**

- Vocabulary changes: `GOV:` directive → glossary update → §07 update → notify all stack owners
- New shared component: `UI:` directive → component authored → §3 updated here
- New intentional divergence: `GOV:` directive → §5 updated here
- Compliance overlay changes: `GOV:` or `FIZ:` directive → §04 (reason codes) + §10 (overlays) updated → §4 updated here

---

## §7 — Gap Register

These are items that require cross-stack alignment work before Alpha cutover. Gaps here are **not blockers** unless marked `BLOCKING`.

| Gap                                                                                        | Stack(s)     | Tracking                                                                   | Blocking?                                                                         |
| ------------------------------------------------------------------------------------------ | ------------ | -------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| RRR UX packet — formal wireframe-binding spec equivalent to `docs/UX_INTEGRATION_BRIEF.md` | RRR          | Not yet authored; RRR Phase 1 pre-dates CNZ Alpha                          | No                                                                                |
| Cyrano UX packet — formal wireframe-binding spec                                           | Cyrano       | Not yet authored                                                           | No                                                                                |
| WGS integration in RRR — whether WGS is present and which bands apply                      | RRR          | R-CLARIFY-008 (in `PROGRAM_CONTROL/REPORT_BACK/R-CLARIFY-CONSOLIDATED.md`) | No                                                                                |
| WGS integration in Cyrano — whether WGS is present in whisper output path                  | Cyrano       | R-CLARIFY-008                                                              | No                                                                                |
| Cyrano access-policy across all 6 `MembershipTier` values                                  | Cyrano + CNZ | `CYRANO-ACCESS-POLICY-001` (in flight)                                     | **BLOCKING** — wireframes must not finalize Cyrano tier access until policy lands |
| Pixel Legacy creator contract                                                              | CNZ + Cyrano | `PIXEL-LEGACY-001` (in flight)                                             | **BLOCKING** — Cyrano lifetime-flag behavior depends on this                      |
| RRR member tier (Layer 2) UX surfaces                                                      | RRR          | Deferred post-launch per CEO decision B2; architecture must support it     | No                                                                                |
| Day 91 Parity cross-stack earnings visibility                                              | CNZ          | C008 (separate CEO_GATE directive)                                         | No                                                                                |

---

## §8 — Canonical Sources (in priority order)

When this document and a canonical source disagree, **the canonical source wins** and this document is corrected via directive.

| Concept                                   | Canonical source                                                                                                |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Naming, terminology, retired terms        | [`docs/DOMAIN_GLOSSARY.md`](DOMAIN_GLOSSARY.md)                                                                 |
| Cross-stack vocabulary and cross-walk     | [`docs/ux/07-cross-stack-vocabulary.md`](ux/07-cross-stack-vocabulary.md)                                       |
| CNZ presenter contracts and surfaces      | [`docs/UX_INTEGRATION_BRIEF.md`](UX_INTEGRATION_BRIEF.md) + [`docs/ux/`](ux/)                                   |
| RRR locked CEO decisions                  | [`docs/RRR_CEO_DECISIONS_FINAL_2026-04-17.md`](RRR_CEO_DECISIONS_FINAL_2026-04-17.md)                           |
| Membership policy, age re-verify cadence  | [`docs/MEMBERSHIP_LIFECYCLE_POLICY.md`](MEMBERSHIP_LIFECYCLE_POLICY.md)                                         |
| Compliance overlays (component contracts) | [`docs/ux/10-compliance-overlays.md`](ux/10-compliance-overlays.md)                                             |
| Architecture map                          | [`docs/ARCHITECTURE_OVERVIEW.md`](ARCHITECTURE_OVERVIEW.md)                                                     |
| Governance, invariants, commit prefixes   | [`PROGRAM_CONTROL/DIRECTIVES/QUEUE/OQMI_GOVERNANCE.md`](../PROGRAM_CONTROL/DIRECTIVES/QUEUE/OQMI_GOVERNANCE.md) |
| NATS topic registry                       | [`services/nats/topics.registry.ts`](../services/nats/topics.registry.ts)                                       |

---

## §9 — How to Update This Document

This document is **Alpha-frozen**. Updates flow through `GOV:` directives only (or `FIZ:` when financial-integrity items are involved). No drive-by edits.

Update triggers:

- A new cross-stack component is adopted in all three stacks → update §3
- A new intentional divergence is locked → update §5
- A gap is resolved → remove or update the row in §7
- A new RRR or Cyrano UX packet is authored → update the packet table in the header and §8
- A cross-stack vocabulary term is added to the glossary → update §2 cross-walk

Every update to this file must reference the authorizing directive ID in the commit message.

---

_OmniQuest Media Inc. · ChatNow.Zone Build Control · `UX_CROSS_STACK_ALIGNMENT` · Issued 2026-04-28_
