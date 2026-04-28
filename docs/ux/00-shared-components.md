# 00 — Shared / Cross-Stack Components

**Role:** All
**Status:** reviewed
**Purpose:** Reusable UI primitives for consistency across RRR, Cyrano, and ChatNow.Zone.

These components are not surface-specific. Any wireframe that renders one of
the primitives listed here **must** use the canonical prop signature below.
Deviating from prop names or omitting required props is a presenter-contract
violation. On any naming conflict, [`docs/DOMAIN_GLOSSARY.md`](../DOMAIN_GLOSSARY.md)
is authoritative.

---

## API / Presenter Binding

### `TierBadge`

Displays the Guest's membership tier and redemption cap, with an optional
Diamond Concierge mode indicator.

| Prop | Type | Required | Notes |
|------|------|:--------:|-------|
| `tierName` | `MembershipTier` | ✅ | Canonical six-value enum — see [`05-tier-entitlements.md`](05-tier-entitlements.md) |
| `capPercent` | `number` | ✅ | Redemption cap percentage (0–100). Sourced from governance config; never hardcoded in UI. |
| `isDiamondConcierge` | `boolean` | ✅ | When `true`, renders the Diamond Concierge indicator mark alongside the badge. |

**Copy slot:** `{tier} • {cap}% redemption`

**Wireframe note:** Every tier state (`GUEST`, `VIP`, `VIP_SILVER`, `VIP_GOLD`,
`VIP_PLATINUM`, `VIP_DIAMOND`) must have a corresponding badge design. Do not
design only the default state.

---

### `WalletBuckets` / `EscrowView`

Three-bucket display of a Guest's token holdings and escrow state. In
RRR contexts, use the RRR-equivalent balance layout; the prop surface is
the same.

Presenter source: `ui/types/public-wallet-contracts.ts` — three-bucket display.

| Prop | Type | Required | Notes |
|------|------|:--------:|-------|
| `spendable` | `string` (bigint as string) | ✅ | Available ChatZoneTokens (CZT). Locale-formatted per `ui/config/theme.ts`. |
| `escrowed` | `string` (bigint as string) | ✅ | CZT held in active escrow. |
| `pending` | `string` (bigint as string) | ✅ | CZT pending settlement or release. |
| `currencyLabel` | `string` | ✅ | `"CZT"` on ChatNow.Zone; RRR/Cyrano use their canonical label. |
| `showEscrowDetail` | `boolean` | — | When `true`, expands inline EscrowView detail rows. |

**Wireframe note:** All three buckets must always be visible (not hidden when
zero). A zero balance renders as `0`, never as an empty cell.

---

### `ComplianceOverlay`

Cross-cutting overlay that surfaces compliance state. Covers four distinct
trigger modes; each must be independently designable.

| Prop | Type | Required | Notes |
|------|------|:--------:|-------|
| `mode` | `'bill149' \| 'gateguard' \| 'welfare' \| 'stepup'` | ✅ | Determines overlay variant. Only one mode is active at a time. |
| `disclosureText` | `string` | ✅ (bill149) | Token-resolved string; wireframes do not override. See `BILL_149_DISCLOSURE_PREFIX`. |
| `gateState` | `GateGuardDecision` | ✅ (gateguard) | `'PASS' \| 'SOFT_BLOCK' \| 'HARD_BLOCK'`. Drives CTA label and icon. |
| `welfareBand` | `string` | ✅ (welfare) | Welfare Guardian band label. **Copy slot:** `Welfare Guardian: {band}`. |
| `stepUpChallenge` | `StepUpChallenge` | ✅ (stepup) | Shape defined in StepUpModal section below. |
| `onDismiss` | `() => void` | — | Not available in `'gateguard'` hard-block or `'stepup'` pending-MFA states. |

**Full-screen modal trigger:** When any mode is active, the overlay renders
as a full-screen modal. Background interaction is blocked. This is a
**non-removable** compliance requirement — see [`10-compliance-overlays.md`](10-compliance-overlays.md).

**Cross-stack:** Identical treatment required in RRR and Cyrano surfaces
wherever their corresponding compliance states surface.

---

### `AuditRow`

Renders a single row in an audit trail. Must always include `reason_code`.
Used in Diamond Concierge Command Center, CS Recovery, and any surface that
exposes ledger or decision history.

| Prop | Type | Required | Notes |
|------|------|:--------:|-------|
| `timestamp` | `string` (ISO 8601) | ✅ | Displayed in local timezone per theme config. |
| `actorId` | `string` | ✅ | `guest_id`, `creator_id`, `agent_id`, or `'SYSTEM'`. |
| `actorRole` | `'GUEST' \| 'CREATOR' \| 'AGENT' \| 'SYSTEM'` | ✅ | |
| `action` | `string` | ✅ | Human-readable action label; sourced from reason-code catalog. |
| `reasonCode` | `string` | ✅ | Canonical reason code — see [`04-reason-code-catalog.md`](04-reason-code-catalog.md). Required on every row; omission is a schema-integrity violation. |
| `correlationId` | `string` | ✅ | UUID linking this event to the originating transaction or decision. |
| `amount` | `string \| null` | — | CZT amount (bigint as string) if the row represents a ledger event. |

**Wireframe note:** `reason_code` and `correlation_id` must always be
rendered, even if in a secondary/collapsed state. They may not be omitted
from the design.

---

## Layout Intent (Mobile-First)

All surfaces that compose these primitives follow this structural order.
Wireframes must preserve the z-order and cannot reposition the Compliance
Overlay relative to other layers.

```
┌──────────────────────────────────────────────┐
│  Header                                      │
│  ├── TierBadge                               │
│  └── FFS / Inferno meter  (when active)      │
│      Copy: Inferno ×{multiplier}             │
├──────────────────────────────────────────────┤
│  WalletBuckets / Balance panel               │
├──────────────────────────────────────────────┤
│  Main content                                │
│  (surface-specific)                          │
├──────────────────────────────────────────────┤
│  Compliance banner / overlay                 │
│  (full-screen modal when triggered —         │
│   blocks all other interaction)              │
├──────────────────────────────────────────────┤
│  Bottom nav  OR  FAB (primary CTA)           │
└──────────────────────────────────────────────┘
```

**FFS / Inferno meter** appears in the header only when the active creator
session is in `HOT` or `INFERNO` tier (`FfsTier` — see
`ui/types/creator-control-contracts.ts`). It must not appear for `COLD` or
`WARM` states.

---

## Interactions

### StepUpModal

Triggered by any high-value action (large token spend, payout request,
Diamond Concierge escalation, GateGuard step-up challenge).

Flow (all steps required in wireframe design):

```
Challenge prompt
    └─▶ MFA input
            ├─▶ GRANT — action proceeds; AuditRow written
            └─▶ DENY  — action blocked; AuditRow written with DENY reason_code
```

The `StepUpChallenge` shape passed to `ComplianceOverlay[mode='stepup']`:

| Field | Type | Notes |
|-------|------|-------|
| `challengeId` | `string` | Unique ID for this challenge instance. |
| `actionLabel` | `string` | Human-readable description of the action being challenged. |
| `mfaMethod` | `'TOTP' \| 'SMS' \| 'EMAIL'` | Method offered for this challenge. |
| `expiresAt` | `string` (ISO 8601) | Challenge expiry; UI must show countdown or expired state. |

**Dismiss is not available** while MFA input is pending. The modal can only
close via GRANT or DENY.

---

### FFS High-Heat → Diamond Concierge Handoff

When a creator session reaches `INFERNO` heat, the platform surfaces a
Diamond Concierge handoff offer to the Guest (on CNZ) or to the creator
(on Cyrano).

**Trigger condition:** `FfsTier === 'INFERNO'` and Guest tier is `VIP_DIAMOND`
(CNZ) **or** creator has an active Cyrano session with high-heat flag.

**Handoff CTA:** Renders as a persistent banner below the Inferno meter in
the header, and as a full-width card in the main content area. Tapping/clicking
opens the Diamond Concierge channel.

**On surfaces that do not support Diamond Concierge** (non-`VIP_DIAMOND`
Guest): the handoff offer is not shown — do not hide it behind a flag; simply
exclude it from the layout when the entitlement is absent.

---

## Copy Slots

The following tokens are authoritative. Wireframes use placeholder syntax;
final copy resolves at runtime from the presenter or governance config.

| Slot | Template | Context |
|------|----------|---------|
| Tier badge | `{tier} • {cap}% redemption` | Header `TierBadge` |
| Inferno meter | `Inferno ×{multiplier}` | Header FFS meter (INFERNO state only) |
| Welfare Guardian | `Welfare Guardian: {band}` | ComplianceOverlay welfare mode |
| Full header line | `{tier} • {cap}% redemption • Inferno ×{multiplier} • Welfare Guardian: {band}` | Collapsed single-line variant when all states are active simultaneously |

**Wireframes must design both the expanded (multi-element) and collapsed
(single-line) variants** for the full header copy slot.

---

## Cross-Stack Notes

This document applies equally to:

- **ChatNow.Zone** (`ChatNowZone--BUILD`) — primary surface
- **RRR** — use RRR-equivalent balance layout for `WalletBuckets`; all other
  components are identical
- **Cyrano** — `ComplianceOverlay[mode='bill149']` is mandatory on all
  AI-generated output surfaces; `TierBadge` reflects creator tier, not Guest tier

Any deviation from the shared component API on a per-repo basis must be
documented in that repo's `docs/ux/00-shared-components.md` as an explicitly
named override, with the reason code that authorizes it.
