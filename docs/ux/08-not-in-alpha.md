# 08 — What's NOT in the Alpha UI

**Status:** ALPHA-FROZEN 2026-04-28
**Purpose:** Save Grok and the design team from designing screens that won't ship.

Anything here is **out of scope** for ChatNow.Zone Alpha. If a wireframe
includes one of these, integration review will reject it.

---

## Visual / brand

| Item | Status | Reason |
|------|--------|--------|
| **Black-Glass Interface** (G101+) | Deferred to v2 | Visual treatment is a post-Alpha workstream. Alpha ships on the existing dark-mode tokens in `ui/config/theme.ts`. |
| Light-mode theme | Deferred to v2 | Alpha is dark-mode default per `THEME.default_mode = 'dark'`. |
| Custom illustrations beyond the empty-state set | Out of scope for Alpha | Empty-state illustrations are in scope (3–5 reusable). Hero illustrations are not. |

---

## Subsystems with no Alpha UI

| Subsystem | Status | Notes |
|-----------|--------|-------|
| **Risk Engine** (D002) | NEEDS_DIRECTIVE — deferred | No `/admin/risk` surface in Alpha. |
| **OBS Broadcast Kernel hardening** (D004) | NEEDS_DIRECTIVE — deferred | The OBS bridge service ships; the hardened kernel does not. Existing OBS-bridge connection setup on `/creator/control` stays. |
| **Cyrano Layer 3** (HCZ Whisper Intelligence) | Deferred | Cyrano L1 (creator suggestion panel) and L2 (consumer audio platform) are Alpha-scope. |
| **Cyrano Layer 4** (Enterprise B2B Whisper API) | Deferred Year 3+ | Per `DOMAIN_GLOSSARY.md`. No Alpha UI. |
| **Live payment processor flows** (FairPay + NOWPayouts) | **Stubbed for Alpha** | Wireframes show a "test mode" banner on every purchase surface; no real card-entry forms. The three-bucket wallet logic is fully present; only the on/off ramp is stubbed. |
| **WORM export end-user view** | Operator-only | End users never see WORM export UI. Compliance + Legal sub-roles only. |
| **Legal hold for non-operators** | Operator-only | Subject accounts see only the consequence (`LEGAL_HOLD_ACTIVE` reason code blocks mutations), never the trigger UI. |

---

## Surfaces RRR retired that **CNZ retains**

| Surface | RRR | CNZ | Notes |
|---------|-----|-----|-------|
| Slot machine | RETIRED (RRR is not a gaming platform) | **RETAINED** — presenter at `ui/components/slot-machine.ts` | CNZ is a gaming platform; the slot machine ships. Wireframes for game UIs include it. |
| Dice game | (RRR — TBD) | **RETAINED** — `ui/components/dice-game.ts` | Same reasoning. |
| Wheel of fortune | (RRR — TBD) | **RETAINED** — `ui/components/wheel-of-fortune.ts` | Same reasoning. |

If RRR wireframes show no game UIs and CNZ wireframes do, that is **not
a divergence in error** — it is a divergence by design. Grok should
not unify these by removing them from CNZ.

---

## Sub-surfaces explicitly excluded

| Sub-surface | Reason |
|-------------|--------|
| Welcome Credit redemption flow | `WELCOME_CREDIT` is configured but `welcome_credit_active = false` at launch. Wireframe the wallet row treatment, but no claim flow. |
| `ANNUAL` billing interval UI | Retired as a tier; if surfacing as a `BillingInterval` enum value, it is a billing-cycle label only — not a tier. Most Alpha purchase paths use 90+1-day blocks. |
| Standalone `DIAMOND` tier badge | Retired form; canonical is `VIP_DIAMOND`. |
| `DAY_PASS` purchase | Retired concept entirely. |
| `OMNIPASS_PLUS` tier display | Retired tier; OmniPass+ exists only as a **product** in the Pass / Entitlement domain. |
| Public-facing audit chain viewer | Operators only. |
| Public-facing Welfare Guardian dashboard | Operators only. |
| End-user step-up auth admin | RBAC admin is operator-only. |

---

## Cyrano L2 — what's NOT in scope for Alpha

(L2 standalone runtime *is* Alpha-scope; these sub-features are not.)

| Sub-feature | Reason |
|-------------|--------|
| Voice mode for VIP / VIP_SILVER (default) | Voice mode is a **top-up unlock**; default access is text-mode. May change in `CYRANO-ACCESS-POLICY-001`. |
| Cross-creator persona library | Creator persona libraries are scoped per-creator. No cross-creator sharing in Alpha. |
| Per-VIP scripts visible to other VIPs | Per-VIP scripts are private to that creator-VIP relationship by design. |
| Cyrano in-app payment for top-ups (separate from CNZ wallet) | Top-ups debit through the **CNZ three-bucket wallet** via `LedgerService.spend`. No separate Cyrano wallet. |

---

## Marketing surfaces deferred

| Surface | Status |
|---------|--------|
| Mic Drop reveal landing page | In scope (per `LAUNCH_MANIFEST.md`); copy and creative TBD. |
| Press / about page | Not Alpha-scope (post-launch creative). |
| Investor / corporate page | Not Alpha-scope. |
| Multi-language localization | Deferred. Alpha ships English-Canada with Sovereign CaC jurisdictional notices. |

---

## When in doubt

If a wireframe item is not explicitly listed in
[`02-endpoint-inventory.md`](02-endpoint-inventory.md) AND not listed
here, it is **probably out of scope**. Confirm with engineering before
designing.

---

## Process for adding to Alpha scope

If a deferred item becomes Alpha-critical:

1. CEO authorization (any addition to scope is GOV-gated).
2. `GOV:` directive moving the item from deferred to in-scope.
3. Update this file and [`02-endpoint-inventory.md`](02-endpoint-inventory.md) in the same PR.
4. Schedule presenter-contract authorship in [`01-presenter-contracts.md`](01-presenter-contracts.md) "Open contract gaps."

The default answer is **no, it's not in Alpha**.
