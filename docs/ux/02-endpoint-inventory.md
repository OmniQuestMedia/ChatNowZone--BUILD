# 02 — Endpoint Inventory by Role

**Status:** ALPHA-FROZEN 2026-04-28
**Purpose:** Map every UI surface to the roles permitted to see and act on it.

---

## Role taxonomy

CNZ recognises five role buckets. Each row lists the canonical name, the
code identifier, and what the role is allowed to do at the UI surface.

| Role bucket | Sub-roles | Code identifier | Notes |
|-------------|-----------|-----------------|-------|
| **Guest** | (single) | `GUEST` | 31-day expiry; locks then purges per `MEMBERSHIP_LIFECYCLE_POLICY.md` §3.1. Never called "user" or "customer." |
| **VIP** | `VIP`, `VIP_SILVER`, `VIP_GOLD`, `VIP_PLATINUM`, `VIP_DIAMOND` | `MembershipTier` enum | 5 ranks. `VIP` is non-paid (earned, permanent). `VIP_SILVER`+ are 90+1-day paid blocks. |
| **Creator** | `PIXEL_LEGACY` (first 3,500), `STANDARD` | `creator_type` (TBD via `PIXEL-LEGACY-001`) | Internally "Models"; externally always "Creators." |
| **OQMI Operator** | `ADMIN`, `CS`, `COMPLIANCE`, `LEGAL`, `DIAMOND_CONCIERGE` | RBAC roles in `services/core-api/src/auth/` | Step-up auth required for sensitive actions. Diamond Concierge is "Security and Fraud function with hospitality surface" — not Guest Services. |
| **HCZ Agent** | (single) | `agents`, `agent_id` | Human Contact Zone crew — Guest Services / CS bureau. Distinct from Diamond Concierge and from HeartZone (HZ). |

---

## Surface × role matrix

Legend: ✅ visible · 🔒 visible with step-up · 🚫 not visible · 〰 visible read-only

| Surface | Guest | VIP | VIP_SILVER+ | VIP_DIAMOND | Pixel Legacy creator | Standard creator | Operator (admin/CS) | Operator (compliance/legal) | Diamond Concierge | HCZ Agent |
|---------|:-----:|:---:|:-----------:|:-----------:|:--------------------:|:----------------:|:-------------------:|:---------------------------:|:-----------------:|:---------:|
| `/` (marketing landing) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `/sign-in`, `/sign-up` | ✅ | 〰 | 〰 | 〰 | 〰 | 〰 | 〰 | 〰 | 〰 | 〰 |
| `/tokens` (REDBOOK token bundles) | ✅ | ✅ | ✅ | ✅ | 🚫 | 🚫 | 〰 | 〰 | 〰 | 〰 |
| `/wallet` (three-bucket) | 🚫 | ✅ | ✅ | ✅ | ✅ | ✅ | 〰 | 〰 | 〰 | 〰 |
| `/diamond/purchase` (volume+velocity quote) | 🚫 | 🚫 | 🚫 | ✅ | 🚫 | 🚫 | 〰 | 〰 | ✅ | 🚫 |
| Member home / zone map | 🚫 | ✅ | ✅ | ✅ | 〰 | 〰 | 〰 | 〰 | 〰 | 〰 |
| Live stream viewer (theatre + Bijou) | 🚫 | ✅¹ | ✅ | ✅ | 〰 | 〰 | 〰 | 〰 | 〰 | 〰 |
| Game UIs (dice, slot machine, wheel of fortune) | 🚫 | ✅ | ✅ | ✅ | 🚫 | 🚫 | 〰 | 〰 | 〰 | 〰 |
| **Cyrano whisper console** (welcome → session) | 🚫 | ✅ | ✅ | ✅ | ✅² | ✅² | 〰 | 〰 | 〰 | 〰 |
| Cyrano upgrade / top-up | 🚫 | ✅ | ✅ | ✅ | 🚫³ | ✅ | 〰 | 〰 | 〰 | 〰 |
| Recovery self-serve (Token Bridge / 3/5ths Exit / Expiration) | 🚫 | ✅⁴ | ✅ | ✅ | 🚫 | 🚫 | ✅ | ✅ | ✅ | ✅ |
| Notification consent | 🚫 | ✅ | ✅ | ✅ | ✅ | ✅ | 〰 | 〰 | 〰 | 〰 |
| Account settings / billing history | 🚫 | ✅ | ✅ | ✅ | ✅ | ✅ | 〰 | 〰 | 〰 | 〰 |
| `/creator/control` (CreatorControl.Zone) | 🚫 | 🚫 | 🚫 | 🚫 | ✅ | ✅ | 〰 | 〰 | 〰 | 〰 |
| Cyrano global persona / script editor | 🚫 | 🚫 | 🚫 | 🚫 | ✅ | ✅ | 〰 | 〰 | 〰 | 〰 |
| **Cyrano per-VIP persona / script editor** | 🚫 | 🚫 | 🚫 | 🚫 | ✅ | ✅ | 〰 | 〰 | 〰 | 〰 |
| Studio / affiliation dashboard | 🚫 | 🚫 | 🚫 | 🚫 | ✅ | ✅ | ✅ | 〰 | 〰 | 〰 |
| Earnings / payout view | 🚫 | 🚫 | 🚫 | 🚫 | ✅ | ✅ | ✅ | 〰 | 〰 | 〰 |
| OBS bridge connection setup | 🚫 | 🚫 | 🚫 | 🚫 | ✅ | ✅ | 〰 | 〰 | 〰 | 〰 |
| Content suppression queue (NCII) | 🚫 | 🚫 | 🚫 | 🚫 | ✅ | ✅ | ✅ | 🔒 | 〰 | 🔒 |
| `/admin/diamond` Diamond Concierge Command Center | 🚫 | 🚫 | 🚫 | 🚫 | 🚫 | 🚫 | ✅ | 〰 | ✅ | 〰 |
| `/admin/recovery` CS Recovery Command Center | 🚫 | 🚫 | 🚫 | 🚫 | 🚫 | 🚫 | ✅ | 〰 | ✅ | ✅ |
| `/admin/cyrano-access` (tier policy + top-up SKU editor) | 🚫 | 🚫 | 🚫 | 🚫 | 🚫 | 🚫 | 🔒 | 〰 | 〰 | 〰 |
| `/admin/pixel-legacy` (3,500 seat-cap monitor) | 🚫 | 🚫 | 🚫 | 🚫 | 〰 | 〰 | 🔒 | 〰 | 〰 | 〰 |
| RBAC step-up admin | 🚫 | 🚫 | 🚫 | 🚫 | 🚫 | 🚫 | 🔒 | 🔒 | 🚫 | 🚫 |
| Legal hold trigger | 🚫 | 🚫 | 🚫 | 🚫 | 🚫 | 🚫 | 🚫 | 🔒 | 🚫 | 🚫 |
| WORM export | 🚫 | 🚫 | 🚫 | 🚫 | 🚫 | 🚫 | 🚫 | 🔒 | 🚫 | 🚫 |
| GateGuard Sentinel admin | 🚫 | 🚫 | 🚫 | 🚫 | 🚫 | 🚫 | ✅ | ✅ | ✅ | 〰 |
| Welfare Guardian admin | 🚫 | 🚫 | 🚫 | 🚫 | 🚫 | 🚫 | ✅ | ✅ | 〰 | ✅ |
| Geo-block / sovereign CaC config | 🚫 | 🚫 | 🚫 | 🚫 | 🚫 | 🚫 | 🔒 | 🔒 | 〰 | 〰 |
| REDBOOK rate-card configuration | 🚫 | 🚫 | 🚫 | 🚫 | 🚫 | 🚫 | 🔒 | 🔒 | 〰 | 〰 |
| Audit chain viewer / replay | 🚫 | 🚫 | 🚫 | 🚫 | 🚫 | 🚫 | ✅ | ✅ | ✅ | 〰 |

¹ VIP (free tier) sees Bijou previews; full Bijou access binds to `VIP_SILVER`+ per `ZONE_ACCESS_TIERS`. Wireframes must show the upgrade CTA.
² Creators access Cyrano in **creator-account-mode** — full feature unlock, custom persona library, no duration cap. Distinct from VIP tier-graduated access.
³ Pixel Legacy creators carry the **lifetime Cyrano membership flag** — top-up purchase is hidden because they have no expiration to extend.
⁴ Free `VIP` tier has limited recovery options (no 3/5ths Exit until paid block exists).

---

## Step-up auth triggers

`RbacService.authorize` returns `step_up_required: true` for:

- `refund:override`
- `suspension:override`
- `ncii:suppress`
- `legal_hold:trigger`
- `geo_block:modify`
- `rate_card:configure`
- `worm:export`
- `cyrano:policy:write`  *(new — added by `CYRANO-ACCESS-POLICY-001`)*
- `pixel_legacy:seat:allocate`  *(new — added by `PIXEL-LEGACY-001`)*

Wireframes must show a step-up auth modal *before* the destructive action,
not after. The challenge → MFA → grant/deny flow is in §03.

---

## Role acquisition flow

| Role | How it's acquired |
|------|-------------------|
| Guest | Visit site (no sign-in required for marketing pages) |
| VIP (free) | Earned via `MEMBERSHIP_LIFECYCLE_POLICY.md` §3.2 (engagement-based) |
| VIP_SILVER+ | Purchase 90+1-day paid block; age re-verify on each new purchase |
| Pixel Legacy creator | Apply during the first 3,500 onboarding seats |
| Standard creator | Apply after the 3,500 cap is reached |
| Operator (any sub-role) | OQMI HR provisioning + RBAC role assignment + step-up MFA enrollment |
| HCZ Agent | OQMI HR provisioning into HCZ bureau + RBAC role assignment |

Wireframes for sign-up should never show the operator paths.
