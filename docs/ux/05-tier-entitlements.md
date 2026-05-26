# 05 — Tier + Entitlement Rules

**Status:** ALPHA-FROZEN 2026-04-28
**Purpose:** Which tier caps apply where; what the wireframes can show as available vs gated.

Source of truth: [`docs/MEMBERSHIP_LIFECYCLE_POLICY.md`](../MEMBERSHIP_LIFECYCLE_POLICY.md), [`docs/DOMAIN_GLOSSARY.md`](../DOMAIN_GLOSSARY.md) §MEMBERSHIP AND ACCESS, `services/core-api/src/config/governance.config.ts` `MEMBERSHIP.TIERS`. On any conflict, **canonical sources win**.

---

## Canonical `MembershipTier` enum (locked — exactly six values)

| Rank | Tier         | Code           | Paid? | Notes                                                         |
| ---- | ------------ | -------------- | ----- | ------------------------------------------------------------- |
| 0    | Guest        | `GUEST`        | No    | 31-day expiry; locks then purges per policy §3.1              |
| 1    | VIP          | `VIP`          | No    | Permanent once earned; 30-day age re-verify cadence           |
| 2    | VIP Silver   | `VIP_SILVER`   | Yes   | 90+1-day paid block; age re-verify per purchase               |
| 3    | VIP Gold     | `VIP_GOLD`     | Yes   | 90+1-day paid block                                           |
| 4    | VIP Platinum | `VIP_PLATINUM` | Yes   | 90+1-day paid block                                           |
| 5    | VIP Diamond  | `VIP_DIAMOND`  | Yes   | 90+1-day paid block; binds Diamond Concierge per locked rules |

**Retired tier values that must NOT appear in UI copy:**
`DAY_PASS`, `ANNUAL` (as tier), `OMNIPASS_PLUS`, standalone `DIAMOND`. If
a wireframe shows any of these as a tier, it's a violation.

**Products (NOT tiers):** `OmniPass`, `OmniPass+`, `ShowZonePass`,
`SilverBullet` are products in the Entitlement / Pass / Product domain.
They may appear in purchase UIs but never in tier-comparison tables.

---

## Tier × surface entitlement matrix

See [`02-endpoint-inventory.md`](02-endpoint-inventory.md) for the
authoritative role × surface matrix. This file enumerates the
_entitlement value_ — what each tier actually gets when it accesses a
surface.

### Zone access (`ZONE_MAP`, `ZONE_ACCESS_TIERS`)

| Zone                      | GUEST |   VIP   | VIP_SILVER | VIP_GOLD | VIP_PLATINUM | VIP_DIAMOND |
| ------------------------- | :---: | :-----: | :--------: | :------: | :----------: | :---------: |
| ChatNow.Zone (free entry) |  ✅   |   ✅    |     ✅     |    ✅    |      ✅      |     ✅      |
| ShowTheatre.Zone          |  🚫   | preview |     ✅     |    ✅    |      ✅      |     ✅      |
| theBijou.Zone             |  🚫   | preview |     ✅     |    ✅    |      ✅      |     ✅      |
| HeartZone (biometric)     |  🚫   |   🚫    |     🚫     |    ✅    |      ✅      |     ✅      |
| GuestZone (CS)            |  ✅   |   ✅    |     ✅     |    ✅    |      ✅      |     ✅      |
| Diamond Concierge         |  🚫   |   🚫    |     🚫     |    🚫    |      🚫      |     ✅      |

Wireframes for zone navigation must show locked zones (not hide them) so
upgrade CTAs are legible.

### Membership stipend (`MEMBERSHIP.STIPEND_CZT`)

Each paid tier carries a recurring CZT stipend credited to the
`membership` bucket. Authoritative values live in
`services/core-api/src/config/governance.config.ts`. Wireframes show
the stipend on the wallet view as a `MONTHLY_STIPEND` ledger row.

### REDBOOK rate cards

Token bundles and Diamond purchases bind to constants in
`REDBOOK_RATE_CARDS`. Wireframes must reference the constant, never a
literal price. Visible categories at Alpha:

- **Tease Regular** (REDBOOK §3) — pre-Mic Drop reveal rate, $0.065 rack / $0.080 bulk
- **ShowZone Premium** (REDBOOK §3) — premium tier
- **Diamond Concierge** — volume + velocity quote with $0.077 platform-floor flag visible
- **Mic Drop rate** (`$0.090` bulk / `$0.075` rack) — full performance range

---

## Cyrano access policy (interim — until `CYRANO-ACCESS-POLICY-001` lands)

Current code gates Cyrano L2 to `VIP_PLATINUM` + `VIP_DIAMOND` only. This
is **changing in Alpha** to a tier-graduated policy:

| Tier                 | Cyrano access                                                                  |
| -------------------- | ------------------------------------------------------------------------------ |
| `GUEST`              | None                                                                           |
| `VIP`                | TBD — see directive                                                            |
| `VIP_SILVER`         | TBD                                                                            |
| `VIP_GOLD`           | TBD                                                                            |
| `VIP_PLATINUM`       | TBD                                                                            |
| `VIP_DIAMOND`        | TBD                                                                            |
| Pixel Legacy creator | **Lifetime Cyrano membership flag** — full creator-account-mode, no expiration |
| Standard creator     | Full creator-account-mode (no lifetime flag — bound to active creator status)  |

Each tier carries:

- `included_minutes_per_day` (or `unlimited`)
- `allowed_personas` (subset or all)
- `allowed_categories` (subset of the 8 Cyrano categories)
- `voice_mode` (boolean)
- `content_mode` (`adult` / `narrative` / both)
- `max_concurrent_sessions`
- `ttl_minutes`

Top-up SKUs (both shapes per CEO instruction 2026-04-28):

- **Time-based:** `+30 min`, `+60 min`, `+120 min`
- **Feature-based:** unlock voice for 24h, unlock specific persona category, etc.

Top-ups debit through `LedgerService.spend` with
`reason_code = 'CYRANO_ACCESS_TOPUP'` against REDBOOK rate-card entries.
No literal pricing.

**Wireframes must show:** the welcome page (first-time tier-authorized
visit), the minutes-remaining gauge, the top-up modal (both SKU
shapes), and creator-account-mode (no minutes gauge, "unlimited" flag).

---

## Creator types (Pixel Legacy vs Standard)

Per `PIXEL-LEGACY-001` (in flight):

| Aspect                     | Pixel Legacy (first 3,500)                                            | Standard (after 3,500)    |
| -------------------------- | --------------------------------------------------------------------- | ------------------------- |
| Per-token payout range     | **$0.07–$0.09** per token earned                                      | Standard rate per REDBOOK |
| Cyrano membership          | **Lifetime** flag set                                                 | None                      |
| Pixel Legacy Signing Bonus | Month 4 conditional bonus (`reason_code: PIXEL_LEGACY_SIGNING_BONUS`) | None                      |
| Profile badge              | Pixel Legacy badge visible                                            | Standard creator badge    |
| Onboarding gate            | Seat-cap check (3,500)                                                | Open after cap reached    |

Rate selection is governed by:

- `RATE_COLD` $0.075 / `RATE_WARM` $0.080 / `RATE_HOT` $0.085 / `RATE_INFERNO` $0.090 (FFS-driven)
- `RATE_DIAMOND_FLOOR` $0.080 (10,000+ CZT bulk)
- `Tease rate` $0.065 rack / $0.080 bulk (pre-Mic Drop)
- `Mic Drop rate` $0.090 bulk / $0.075 rack (full range)
- `Day 91 Parity` — all creators registered Days 1–90 access full range on Day 91

Wireframes for the earnings view must show the **applicable rate at the
moment of earning**, with the `reason_code` mapped to copy from §04.

---

## Diamond Concierge — zero-earn rule (cross-stack)

Diamond Concierge is "Security and Fraud function with hospitality
surface" — **not** Guest Services, **not** a creator role. Operators in
this role:

- Do **not** accrue creator earnings — they earn only via their employment contract
- Hold the $0.077 platform-floor on Diamond purchases
- Bind to VIP_DIAMOND guests per locked rules in `services/diamond-concierge/`

**This rule is shared with RRR.** Wireframes for Diamond Concierge
operator surfaces must enforce zero-earn in copy: payout figures shown
on the operator surface refer to the _guest's_ spend or the _creator's_
earnings, never the operator's.

---

## Inferno multiplier visibility (cross-stack)

The `INFERNO` FFS tier (heat 86–100) triggers `RATE_INFERNO` ($0.090/CZT)
for the creator. Visibility rules:

- **Visible to the creator** on `/creator/control` payout indicator (always).
- **Visible to operators** on `/admin/diamond` (always).
- **Visible to the guest** on the live stream viewer **only when the guest is in INFERNO heat themselves** — i.e. the multiplier surfaces as guest UX cue when the guest is meaningfully driving it.
- **Never shown to the guest** as a creator-payout figure. The guest
  surface frames it as engagement / atmosphere, not as a wage rate.

This is the same "inferno multiplier" RRR uses; visibility rules are
identical across both stacks.
