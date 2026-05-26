# 03 — State Machines

**Status:** ALPHA-FROZEN 2026-04-28
**Purpose:** Every state machine a wireframe must respect to show the right CTA at the right moment.

State diagrams use ASCII transitions. State names match the code identifiers
in the named source file. **A wireframe must design a state for every node.**

---

## 1. Token purchase → three-bucket allocation → ledger mutation

**Source:** `services/ledger/`, `services/core-api/src/gateguard/`

```
INTENT_FORMED                              guest selects bundle in /tokens
   └─ KYC_REQUIRED?  ───── yes ──>  KYC_GATE  (block until cleared)
                          │
                          no
                          ▼
SOVEREIGN_CAC_CHECK ───── deny ──>  GEO_BLOCKED  (terminal — show Sovereign CaC denial)
   │
   pass
   ▼
GATEGUARD_PRE_PROCESS ─── DENY ──>  GATEGUARD_DENY  (show reason_code copy from §04)
   │                              SOFT_NUDGE / COOL_DOWN / HARD_DECLINE_HCZ — see §10
   approve
   ▼
PAYMENT_RAILS_STUBBED  ─── alpha test-mode banner appears here ───
   │
   ▼
LEDGER_WRITE  (idempotent on correlation_id)
   │
   ├─ buckets credited per LEDGER_SPEND_ORDER  (purchased / membership / bonus — bind to constant, not a literal)
   │
   ▼
WALLET_RECONCILED  (success — show new bucket totals)
```

**Wireframe must show:** intent (selected bundle), KYC gate, geo-block denial, GateGuard denial with reason copy, test-mode banner during Alpha, success with bucket-level diff.

---

## 2. Three-bucket wallet spend (deterministic order)

**Source:** `LedgerService.spend`, `ThreeBucketSpendGuardMiddleware`

```
SPEND_INTENT (amount, target)
   ▼
RESOLVE_BUCKETS_IN_ORDER  (LEDGER_SPEND_ORDER constant)
   │
   ├─ if total_balance < amount  →  LEDGER_INSUFFICIENT_BUCKETS  (terminal)
   │   wireframe: show shortfall + safety-net offer (REDBOOK)
   │
   ▼
GATEGUARD_PRE_PROCESS  (welfare + fraud band)
   │
   ▼
APPEND_LEDGER_ENTRIES  (one per bucket touched)
   │
   ▼
HASH_CHAIN_RECORDED
   │
   ▼
SUCCESS  (animate spend per-bucket — UX cue that order matters)
```

**Wireframe must show:** the bucket order is deterministic — animate spend
draining `purchased` first, then `membership`, then `bonus`. The order is
the contract; the animation makes the contract legible.

---

## 3. Membership lifecycle

**Source:** `services/core-api/src/membership/`, `MEMBERSHIP_LIFECYCLE_POLICY.md`

```
GUEST_ACTIVE  (31-day expiry timer)
   │
   ├─ no engagement by day 31  →  GUEST_LOCKED  →  GUEST_PURGED
   │
   ├─ engagement threshold met  →  VIP_EARNED  (free, permanent)
   │
   ▼
VIP_ACTIVE  ⇄  VIP_AGE_REVERIFY_DUE  (every 30 days)
   │
   ├─ purchase paid block  →  VIP_SILVER / VIP_GOLD / VIP_PLATINUM / VIP_DIAMOND
   │
   ▼
PAID_TIER_ACTIVE  (90+1 day block)
   │
   ├─ block expiring (T-48h)  →  EXPIRY_WARNING  (idempotent inside warning window)
   │
   ├─ renewed before expiry   →  PAID_TIER_ACTIVE
   │
   ├─ not renewed             →  RECOVERY_OFFERED  (see §4)
   │
   ▼
EXPIRED  →  GUEST_FALLBACK
```

**Wireframe must show:** the 48-hour warning banner (different from a
generic notification — it's a recovery on-ramp), tier-changed visual
treatment, and a clear pre-expiry vs post-expiry state.

---

## 4. Recovery lifecycle (three pillars)

**Source:** `services/recovery/`, `services/ledger/recovery.service.ts`

### 4a. Token Bridge

```
RECOVERY_WINDOW_OPEN  →  TOKEN_BRIDGE_OFFERED
   │
   ├─ guest accepts  →  TOKEN_BRIDGE_ACCEPTED  →  LEDGER_BRIDGE_WRITE  →  RESOLVED
   │
   └─ guest declines →  TOKEN_BRIDGE_DECLINED  →  THREE_FIFTHS_EXIT_OFFERED (4b)
```

### 4b. Three-Fifths Exit (cash-refund path)

```
THREE_FIFTHS_EXIT_OFFERED
   │
   ├─ guest accepts  →  THREE_FIFTHS_EXIT_POLICY_GATED
   │     │
   │     ├─ CEO_OVERRIDE_REQUIRED  (FIZ-002-REVISION-2026-04-11)
   │     │     │
   │     │     ├─ override granted  →  THREE_FIFTHS_EXIT_SETTLED  →  RESOLVED
   │     │     └─ override denied   →  THREE_FIFTHS_EXIT_DENIED   →  EXPIRATION_PROCESSED (4c)
   │     │
   │     └─ no override path on this tier  →  EXPIRATION_PROCESSED (4c)
   │
   └─ guest declines →  EXPIRATION_PROCESSED (4c)
```

### 4c. Expiration redistribution

```
EXPIRY_LAPSED  →  RecoveryEngine.redistribute  →  AUDIT_EVENT_WRITTEN  →  RESOLVED
```

**Wireframe must show:** every `RecoveryStageTag` (`OPEN`,
`TOKEN_BRIDGE_OFFERED`, `TOKEN_BRIDGE_ACCEPTED`,
`THREE_FIFTHS_EXIT_POLICY_GATED`, `THREE_FIFTHS_EXIT_OFFERED`,
`EXPIRATION_PROCESSED`, `RESOLVED`) — these are the canonical column
values on `/admin/recovery`.

---

## 5. Cyrano session lifecycle (Layer 2 standalone)

**Source:** `services/core-api/src/cyrano/cyrano-auth.service.ts`, `apps/cyrano-standalone/`

```
FIRST_OPEN  (no session cookie)
   │
   ├─ tier insufficient  →  TIER_INSUFFICIENT  (denial page; show tier ladder + upgrade CTA)
   │
   ├─ tier authorized + first time  →  WELCOME_PAGE
   │     │     "Your tier includes X minutes/day · Start session"
   │     │
   │     └─ start session  →  SESSION_GRANTED
   │
   └─ tier authorized + returning  →  SESSION_GRANTED  (skip welcome)
   ▼
SESSION_GRANTED  (cookie set, minutes-decrementing)
   │
   ├─ minutes_remaining > 0  →  ACTIVE  (whisper console)
   │
   ├─ T-2 min warning         →  EXPIRY_WARNING_BANNER
   │
   ├─ minutes_remaining = 0   →  SESSION_EXPIRED
   │     │
   │     ├─ top-up purchased  →  SESSION_RESUMED  (return to ACTIVE)
   │     │
   │     └─ no top-up         →  ACCESS_DENIED  (show upgrade or wait-until-tomorrow)
```

**Wireframe must show:** welcome page state (first-open landing), minutes-
remaining gauge, T-2 min warning banner, top-up modal, session-resumed
transition, and creator-account-mode (skips minutes gauge entirely — flag
displays `unlimited`).

---

## 6. Cyrano persona / script scope hierarchy

**Source:** `services/cyrano/`

```
GLOBAL_CREATOR_LIBRARY    (one per creator — visible only to that creator)
   │
   ├─ template?  →  CYRANO_PUBLISHED_TEMPLATE  (system-wide menu options)
   │
   └─ relationship_targeted?
         ├─ no    →  GENERIC_PERSONA  (used for any VIP)
         └─ yes   →  PER_VIP_SCRIPT  (target_vip_user_id set)
                    │
                    ├─ visible to creator
                    ├─ visible to that VIP only when used in their session
                    ├─ never visible to other VIPs
                    └─ on VIP data-deletion request → script PII redacted, kept as audit-only
```

**Wireframe must show:** scope picker on the creator persona/script
editor (Global / Template / Per-VIP), per-VIP relationship picker, and a
"this content is private to this fan relationship" badge on per-VIP scripts.

---

## 7. FFS — Flicker n'Flame Scoring tier transitions

**Source:** `services/ffs/`, `services/creator-control/src/ffs.engine.ts`

```
COLD     (heat 0–33)    → RATE_COLD     $0.075/CZT
   │
   ├─ heat > 33  →  WARM
   ▼
WARM     (heat 34–60)   → RATE_WARM     $0.080/CZT
   │
   ├─ heat > 60  →  HOT
   ▼
HOT      (heat 61–85)   → RATE_HOT      $0.085/CZT
   │
   ├─ heat > 85  →  INFERNO
   ▼
INFERNO  (heat 86–100)  → RATE_INFERNO  $0.090/CZT
```

**Transitions are deterministic; no UI debouncing.** SenSync™ heart-rate
adds +10–25 pts when consented. Diamond Concierge holds a $0.080 floor on
10,000+ CZT bulk per `RATE_DIAMOND_FLOOR`.

**Wireframe must show:** every tier as a distinct visual band on the FFS
meter. The transition between bands should be sharp (matching the
deterministic backend), not a gradient.

---

## 8. Welfare Guardian Score (WGS) intervention bands

**Source:** `services/core-api/src/gateguard/`

```
GREEN     (welfare 0–39)    →  no UI overlay
WGS_NUDGE (welfare 40–69)   →  SOFT_NUDGE        non-blocking notification
WGS_PAUSE (welfare 70–89)   →  COOL_DOWN         mandatory 5-min pause modal
WGS_HARD  (welfare 90+)     →  HARD_DECLINE_HCZ  decline + HCZ escalation overlay
```

**Wireframe must show:** the SOFT_NUDGE as a dismissible banner (not a
modal), the COOL_DOWN as a non-dismissible 5-min countdown modal, the
HARD_DECLINE_HCZ as a full-screen overlay with HCZ contact CTA. No band
is silent.

---

## 9. Step-up auth challenge

**Source:** `services/core-api/src/auth/`

```
DESTRUCTIVE_ACTION_INTENT
   │
   ▼
RBAC_CHECK  →  step_up_required: true  →  STEP_UP_CHALLENGE_MODAL
   │
   ▼
MFA_PROMPT
   │
   ├─ MFA pass     →  STEP_UP_GRANTED   →  ACTION_PROCEEDS  →  AUDIT_EVENT_WRITTEN
   │
   └─ MFA fail (3) →  STEP_UP_DENIED    →  ACTION_BLOCKED   →  AUDIT_EVENT_WRITTEN
```

**Wireframe must show:** the modal _before_ the destructive action,
attempt counter, post-grant resumption (return to the original action's
context, not to a generic dashboard).

---

## 10. Pixel Legacy onboarding

**Source:** `PIXEL-LEGACY-001` directive (in flight)

```
CREATOR_APPLY
   │
   ▼
SEAT_CAP_CHECK  (3,500 lifetime cap)
   │
   ├─ cap not reached  →  GRANTED_PIXEL_LEGACY
   │     │
   │     ├─ payout range $0.07–$0.09 per token earned
   │     ├─ lifetime Cyrano membership flag set
   │     └─ Pixel Legacy badge enabled on profile
   │
   └─ cap reached      →  GRANTED_STANDARD
         │
         ├─ standard payout (per REDBOOK)
         └─ no lifetime Cyrano flag
   ▼
ONBOARDING_COMPLETE
```

**Wireframe must show:** real-time seat counter on the apply page (so the
last seats build urgency honestly), the moment of grant (Pixel Legacy
badge animation), and the fallback to Standard with no apologia.

---

## 11. Diamond Concierge handoff

**Source:** `services/diamond-concierge/`, `services/integration-hub/`

```
HIGH_HEAT_DETECTED  (FFS = INFERNO + session signal)
   │
   ▼
DIAMOND_CONCIERGE_HANDOFF_OFFERED
   │
   ├─ creator declines  →  RESUMES_NORMAL
   │
   └─ creator accepts   →  QUOTE_GENERATED  (volume + velocity + $0.077 floor)
         │
         ├─ guest accepts  →  DIAMOND_PURCHASE_FLOW  →  DIAMOND_BLOCK_BOUND
         │
         └─ guest declines →  RESUMES_NORMAL
```

**Wireframe must show:** the platform-floor flag visibly. Diamond
Concierge has a **zero-earn** rule — operators in this role do not accrue
creator earnings; they earn only through their employment contract. The
admin Diamond surface must enforce this in copy.

---

## 12. Idempotency replay outcomes

**Source:** every financial / audit write

```
CLIENT_REQUEST  (correlation_id = X)
   │
   ▼
SERVER_LOOKUP  (correlation_id = X)
   │
   ├─ no prior write       →  EXECUTE  →  RETURN_FRESH_RESULT  (200)
   │
   ├─ prior write, same payload   →  RETURN_ORIGINAL  (200, IDEMPOTENT_REPLAY flag)
   │
   └─ prior write, divergent payload  →  REJECT  (409, reason_code: IDEMPOTENCY_REPLAY)
                                              wireframe: show "request differs from earlier
                                              attempt — refresh and try again"
```

**Wireframe must show:** the 409 path explicitly. A naive retry that
mutates the payload (e.g., user edits the amount mid-retry) hits this
state. The copy must not blame the user — guide to refresh.
