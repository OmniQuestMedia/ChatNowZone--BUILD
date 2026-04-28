# 10 — Compliance + Disclosure Overlays

**Status:** ALPHA-FROZEN 2026-04-28
**Purpose:** Cross-cutting visual treatments that must be consistent across every surface — and across all three OQMI entities (CNZ + RRR + Cyrano).

These overlays are **non-removable**. A wireframe that omits one for a
surface where it's required is a compliance violation, not a stylistic
choice.

---

## Bill 149 (Ontario AI Disclosure)

**Trigger:** Every output where `CREATOR_AUTO=true`. This includes
Cyrano persona output rendered into chat, AI-generated suggestions
displayed to a guest, AI-assisted creator copy in profiles or messages.

**Treatment:** Visible prefix on every relevant output. Component:
`<Bill149Prefix />`. Default text token: `BILL_149_DISCLOSURE_PREFIX`
(authoritative source — wireframes do not override the string).

**Where it appears:**
- Chat lane (when output is AI-generated)
- Cyrano whisper console suggestions (server output before it's spoken / typed by creator — different rule than user-facing AI output; consult engineering on edge cases)
- AI-assisted creator profile copy
- Any persona-driven response

**Where it does NOT appear:**
- Human-typed creator messages
- System notifications (toasts, banners)
- Operator administrative copy

**Cross-stack:** identical treatment in RRR + Cyrano wherever AI-generated content surfaces.

---

## Sovereign CaC (Bill S-210 age gate)

**Trigger:** Any adult-content surface accessed from a jurisdiction that requires age-verification middleware.

**Treatment:** Full-screen overlay before the surface renders. User
cannot dismiss. Component: `<SovereignCaCGate />`.

**Surfaces affected:**
- `/` (marketing landing — only adult-content sections)
- `/sign-up` (when adult sub-flow selected)
- All authenticated VIP surfaces
- Live stream viewer
- Game UIs

**Reason codes:** `SOVEREIGN_CAC_BLOCK`, `AGE_VERIFICATION_REQUIRED`, `AGE_REVERIFY_DUE`.

**Re-verify cadence:** Per `MEMBERSHIP_LIFECYCLE_POLICY.md`:
- VIP (free): every 30 days
- Paid tiers: on each new purchase

Wireframes must show the re-verify prompt as a non-blocking banner that
escalates to a blocking modal as the deadline approaches.

---

## KYC gate

**Trigger:** First token purchase, first paid-tier upgrade, or any
mutation that crosses a financial threshold.

**Treatment:** Multi-step wizard. Component: `<KYCGate />`.

**Reason codes:** `KYC_REQUIRED`, `KYC_PENDING`, `KYC_FAILED`.

**Wireframes must include:**
- Initial gate state ("Verify your identity to continue")
- Wizard steps (provider-driven; copy varies)
- Pending state (with expected wait time)
- Failed state (with support handoff)
- Cleared state (silent — proceed to original action)

---

## Step-up auth modal

**Trigger:** Any RBAC action where `step_up_required: true`. Full list in [`02-endpoint-inventory.md`](02-endpoint-inventory.md) §"Step-up auth triggers."

**Treatment:** Modal that appears **before** the destructive action.
Component: `<StepUpModal />`.

**State machine:** see [`03-state-machines.md`](03-state-machines.md) §9.

**Wireframes must include:**
- Challenge state (factor entry)
- Attempts-remaining indicator
- Granted state (modal closes; action resumes in original context)
- Denied state (action blocked; clear messaging without leaking detail)
- Audit notification (every attempt is logged — surface this to the operator: "This attempt was logged.")

**Cross-stack:** identical component and behavior in RRR + Cyrano.

---

## Welfare Guardian Score (WGS) interventions

**Trigger:** WGS computation crossing a threshold band. Bands:

| Band | Reason code | Treatment |
|------|-------------|-----------|
| 0–39 (GREEN) | (none) | No overlay |
| 40–69 (NUDGE) | `SOFT_NUDGE` | **Banner.** Dismissible. Non-blocking. Copy slot: "Take a moment — does this still feel right?" |
| 70–89 (PAUSE) | `COOL_DOWN` | **Modal.** Non-dismissible. 5-minute countdown timer. Copy slot: "Let's pause for 5 minutes." |
| 90+ (HARD) | `HARD_DECLINE_HCZ` | **Full-screen overlay.** Non-dismissible. Component: `<HCZContactCTA />`. Copy slot: "We've paused this session. → [talk to a real person from HCZ]" |

**Wireframes must show:** every band as its own visual treatment. Never
silent. Never punitive. Never imply user fault.

**Cross-stack:** if RRR or Cyrano implement WGS interventions, names
and treatments are identical (per [`07-cross-stack-vocabulary.md`](07-cross-stack-vocabulary.md)).

---

## Geo-block / domain-block overlays

**Trigger:** Server returns `GEO_BLOCKED`, `DOMAIN_BLOCKED`, or `EMAIL_DOMAIN_BLOCKED`.

**Treatment:** Inline error on the surface where the block applies.
Component: `<GeoBlockOverlay />` (full-screen for `GEO_BLOCKED`),
`<InlineBlockNotice />` (for sign-up form blocks).

**Wireframes must include:**
- The block reason in plain language
- No CTA that would let the user "try again" (the block is server-enforced; retrying won't change the outcome)
- A support handoff path for genuine errors (e.g., a Canadian guest on a hotel VPN that geolocates as US)

---

## Identity verification re-prompt

**Trigger:** `AGE_REVERIFY_DUE`, KYC re-verification cadence, or
authentication-factor expiration.

**Treatment:** Non-blocking banner that escalates to a blocking modal
as the deadline approaches. Component: `<IdentityReverifyPrompt />`.

---

## Legal hold overlay (subject-side)

**Trigger:** Server returns `LEGAL_HOLD_ACTIVE` on a mutation attempt.

**Treatment:** Inline error. Component: `<LegalHoldNotice />`. Copy
slot: "This account is under legal hold. → [contact compliance]".

**Wireframes must NOT** show:
- Why the hold was triggered (operator-only)
- Who triggered it
- The hold's expected duration (if known)

The subject sees only the consequence; the trigger UI is operator-only
(see [`02-endpoint-inventory.md`](02-endpoint-inventory.md)).

---

## "Test mode" banner (Alpha-only)

**Trigger:** Alpha feature flag enabled (`PAYMENT_PROCESSOR_STUB_MODE`).

**Treatment:** Persistent banner on every purchase surface during
Alpha. Component: `<TestModeBanner />`. Copy slot: "Alpha test mode —
no real payment will be charged."

**Surfaces affected:**
- `/tokens`
- `/diamond/purchase`
- Cyrano top-up modal
- Any creator-side payout-relevant surface

**Removal:** when payment processor goes live (post-Alpha), the banner
is removed by feature flag, not by code change.

---

## Component contract: every overlay must

- Carry a `test_id` per `ui/config/accessibility.ts`.
- Carry an ARIA role/label.
- Be keyboard-accessible (focus trap on modal overlays).
- Render at every breakpoint (375 / 768 / 1280 / 1680).
- Render in dark mode default; respect `THEME` tokens.
- Carry a `reason_code` prop so the catalog mapping (§04) drives the visible copy.

---

## Forbidden treatments

- ❌ Punitive copy on welfare interventions ("you've gone too far," "behave," etc.).
- ❌ "Why was I blocked?" detail on subject-side legal hold overlays.
- ❌ Generic "an error occurred" copy on any compliance overlay — every overlay maps to a specific `reason_code` with a specific copy slot.
- ❌ Dismissible `COOL_DOWN` or `HARD_DECLINE_HCZ` overlays.
- ❌ Hiding the test-mode banner during Alpha.
- ❌ Bill 149 prefix omitted on AI-generated output.
