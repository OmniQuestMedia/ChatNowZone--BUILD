# 07 — Cross-Stack Vocabulary (CNZ Source-of-Truth)

**Status:** ALPHA-FROZEN 2026-04-28
**Purpose:** Canonical naming for ChatNow.Zone. RedRoomRewards and Cyrano packets reconcile against this file (per CEO instruction 2026-04-28).

Wireframes for any OQMI entity must use the names listed here. A guest
moving between CNZ, RRR, and Cyrano should see one platform, not three
brand voices arguing.

Source authority on naming: [`docs/DOMAIN_GLOSSARY.md`](../DOMAIN_GLOSSARY.md). On any disagreement, the glossary wins.

---

## Never alias these

The following terms are **canonical, never aliased, never abbreviated, never localized**:

| Canonical form                                                           | Forbidden forms                                                                                                               |
| ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| **ChatNow.Zone**                                                         | `chatnow.com`, `chatnowzone.com`, `<XXXChatNow.com>`, `Chat Now`, `CNZone`, `chat-now`, "the platform" (in brand-facing copy) |
| **OmniQuest Media Inc.** / **OQMInc** / **OQMI**                         | `OQM`, `Omni Quest`, `OQM Inc.`                                                                                               |
| **Cyrano**                                                               | `Sirano`, `cyrano.app`, `the whisper bot` (in brand-facing copy)                                                              |
| **GateGuard Sentinel**                                                   | `GateGuard`, `Gate Guard`, `Sentinel`, `the gate`                                                                             |
| **Welfare Guardian Score** / **WGS**                                     | `Welfare Score`, `Guardian Score`                                                                                             |
| **Diamond Concierge**                                                    | `Diamond Customer Service`, `VIP Concierge`                                                                                   |
| **Pixel Legacy** (creator type)                                          | `Pixel`, `Legacy`, `Founder Creator`, `Charter Creator`                                                                       |
| **Flicker n'Flame Scoring** / **FFS**                                    | `Flicker`, `Flame Score`, `FF Score`, "heat score" (in operator copy — guests see "energy")                                   |
| **SenSync™**                                                             | `Sen Sync`, `HeartSync` (HeartSync is the **internal code identifier** — never user-facing)                                   |
| **HCZ** / **Human Contact Zone**                                         | `Customer Service`, `Support`, `Help Desk`                                                                                    |
| **ShowTheatre.Zone**, **theBijou.Zone**, **HeartZone**, **GuestZone**    | `Show Theatre`, `Bijou`, `Heart Zone`, `Guest Zone` (no spaces; canonical capitalization)                                     |
| **CZT** / **ChatZoneTokens**                                             | `tokens` (lowercase, generic) is acceptable in conversational copy; never `coins`, `credits`, `points`                        |
| **VIP**, **VIP_SILVER**, **VIP_GOLD**, **VIP_PLATINUM**, **VIP_DIAMOND** | `Diamond`, `Platinum`, `Gold`, `Silver` (bare); `Diamond tier`, `OmniPass+` (retired tier alias)                              |

---

## CNZ ↔ RRR ↔ Cyrano cross-walk

The same conceptual primitive may be named differently across the three
stacks. Wireframes for cross-stack components share **layout and
behavior**, but use the locally canonical term.

| Concept                    | CNZ name                                                       | RRR name                                              | Cyrano name                                                            |
| -------------------------- | -------------------------------------------------------------- | ----------------------------------------------------- | ---------------------------------------------------------------------- |
| User-held value with state | **Three-bucket wallet** (`purchased` / `membership` / `bonus`) | Escrow (hold → settle / refund / partial)             | (n/a — Cyrano consumes CZT from CNZ wallet; no separate balance)       |
| Balance display            | Three-bucket display with deterministic spend order            | Escrow lifecycle card                                 | Minutes-remaining gauge                                                |
| Tier ladder                | 6-tier `MembershipTier` (`GUEST` → `VIP_DIAMOND`)              | RRR member tier (TBD per RRR packet)                  | Tier-graduated access policy (binds to CNZ `MembershipTier`)           |
| Inferno multiplier         | `RATE_INFERNO` ($0.090/CZT) at FFS `INFERNO` tier              | Inferno multiplier (same name; same visibility rules) | (Cyrano operates upstream; surfaces inferno via creator's CNZ session) |
| Heat tier visualization    | FFS meter (`COLD`/`WARM`/`HOT`/`INFERNO`)                      | Heat indicator (binds to CNZ FFS)                     | (Cyrano displays heat as session context)                              |
| Diamond Concierge          | Operator role with $0.077 floor and **zero-earn** rule         | Diamond Concierge zero-earn rule (identical)          | (n/a)                                                                  |
| Step-up auth               | RBAC step-up modal                                             | Step-up auth (identical component family)             | Step-up auth (identical)                                               |
| Audit row                  | hash-chained `AuditEvent` row with `correlation_id`            | Audit row (RRR variant; same shape)                   | Audit row (Cyrano session events)                                      |
| Compliance overlay         | Bill 149 disclosure prefix on `CREATOR_AUTO=true`              | Bill 149 prefix (identical)                           | Bill 149 prefix (identical when AI-generated content surfaces)         |
| WGS interventions          | `SOFT_NUDGE` / `COOL_DOWN` / `HARD_DECLINE_HCZ`                | (TBD per RRR — if WGS is present, names match)        | (TBD — if WGS is present in Cyrano whisper output, names match)        |
| Real-time fabric           | NATS topic registry (`services/nats/topics.registry.ts`)       | NATS (shared registry)                                | NATS (shared registry)                                                 |
| Membership policy          | `MEMBERSHIP_LIFECYCLE_POLICY.md`                               | (Reconciles to CNZ policy where shared)               | (Reconciles to CNZ policy)                                             |

---

## Component ontology

Components in the wireframe library are reusable across the three
stacks. The **component name** is the same; the **content** is locally
canonical.

| Component                                             | Used in CNZ for                                                 | Used in RRR for         | Used in Cyrano for                  |
| ----------------------------------------------------- | --------------------------------------------------------------- | ----------------------- | ----------------------------------- |
| `<TierBadge />`                                       | All 6 `MembershipTier` values + Pixel Legacy + Standard creator | RRR tier rendering      | Cyrano tier badge in console header |
| `<HeatMeter />`                                       | FFS meter on `/creator/control` and `/admin/diamond`            | RRR heat surfaces       | Cyrano session context              |
| `<WalletDisplay />` (CNZ) / `<EscrowDisplay />` (RRR) | Three-bucket display                                            | Escrow card             | (n/a)                               |
| `<MinutesRemaining />`                                | (Cyrano-only on CNZ — VIP user surface)                         | (n/a)                   | Cyrano session minutes gauge        |
| `<StepUpModal />`                                     | RBAC step-up                                                    | RBAC step-up            | RBAC step-up                        |
| `<AuditRow />`                                        | `/admin/recovery`, `/admin/diamond` audit chain                 | RRR audit               | Cyrano session log                  |
| `<KPICard />`                                         | KPI rows on admin surfaces                                      | RRR KPI rows            | Cyrano operator KPI                 |
| `<Bill149Prefix />`                                   | Every `CREATOR_AUTO=true` rendered string                       | Identical               | Identical                           |
| `<GeoBlockOverlay />`                                 | Sovereign CaC denial                                            | Identical               | Identical                           |
| `<KYCGate />`                                         | KYC flow                                                        | Identical               | (n/a — Cyrano binds to CNZ KYC)     |
| `<WGSInterventionOverlay />`                          | `SOFT_NUDGE` / `COOL_DOWN` / `HARD_DECLINE_HCZ`                 | (If WGS present in RRR) | (If WGS present in Cyrano)          |

Components share **APIs and visual treatment** across stacks. Where a
stack has no use for a component (e.g. `<EscrowDisplay />` on CNZ), the
component simply isn't imported there.

---

## Phase distinction (RRR vocabulary that CNZ surfaces should respect)

RRR distinguishes Phase-1 and Phase-2 merchants. CNZ does not have
analog phases at Alpha — but where CNZ surfaces a merchant or studio
relationship, the term **Phase-1** / **Phase-2** is reserved for the
RRR vocabulary and CNZ uses **Studio** / **Affiliation** instead.

| CNZ-canonical term | Don't substitute                       |
| ------------------ | -------------------------------------- |
| Studio             | `Phase-1 merchant`, `Phase-2 merchant` |
| Affiliation        | `merchant tier`                        |

---

## Voice and style (cross-stack)

These are voice rules; Creative will refine, but engineering enforces them at the slot level:

- **Guests are never "users" or "customers"** in code or UI copy. They are _guests_.
- **Creators externally; Models internally.** Wireframes use _Creators_.
- **No infantilizing "oops"** copy in error states. Use direct, neutral copy.
- **Welfare interventions are never punitive.** Copy must never imply user fault for a `SOFT_NUDGE` / `COOL_DOWN`.
- **Time-of-day language:** prefer "right now" / "in a moment" over precise minutes when latency makes the precision misleading.

---

## How to add a cross-stack term

1. Open a `GOV:` directive that adds the term to [`docs/DOMAIN_GLOSSARY.md`](../DOMAIN_GLOSSARY.md).
2. Once the glossary entry is merged, add the row to this file's "Never alias" table and the cross-walk table.
3. Notify the RRR + Cyrano packet owners so their packets reconcile.
4. Update the component ontology if the term implies a new shared component.

CEO authorization is required for any glossary addition.
