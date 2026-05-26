# 01 — GateGuard + Step-Up Auth Flow (All Stacks)

**Status:** draft
**Role scope:** Guest → VIP / Member / Creator / Operator
**Purpose:** Mandatory age/ID verification gate and elevated-action step-up auth — shared across ChatNow.Zone, RedRoomRewards, and Cyrano.
**Presenter / Binding:** GateGuard AV contract (`services/core-api/src/gateguard/gateguard.types.ts`) + `<StepUpAuthModal />` (shared component)
**Cross-references:** [`03-state-machines.md §9`](03-state-machines.md) · [`10-compliance-overlays.md`](10-compliance-overlays.md) · [`04-reason-code-catalog.md`](04-reason-code-catalog.md) · [`07-cross-stack-vocabulary.md`](07-cross-stack-vocabulary.md)

---

## 1. Scope

This document covers two related gate patterns that share the same
modal shell and audit path:

| Pattern                            | Trigger class                                                 | Decision outcome                                               |
| ---------------------------------- | ------------------------------------------------------------- | -------------------------------------------------------------- |
| **Age / ID Verification (AV)**     | First adult-content access, KYC threshold, `AGE_REVERIFY_DUE` | `VERIFIED` / `PENDING` / `FAILED` / `UNKNOWN` (per `AvStatus`) |
| **Step-Up Auth (elevated action)** | Any RBAC path where `step_up_required: true`                  | `STEP_UP_GRANTED` / `STEP_UP_DENIED`                           |

Both patterns resolve to the same audit event shape and resume the
original caller flow on success. They share the modal container but
use different inner form widgets (document upload vs MFA code input).

---

## 2. State Machine

**Source:** `services/core-api/src/gateguard/` · `services/core-api/src/auth/`

```
TRIGGER_EVENT
   │  (high-value purchase · Cyrano top-up · admin adjustment ·
   │   adult-content first-access · AGE_REVERIFY_DUE · RBAC step_up_required)
   ▼
CHALLENGE_ISSUED  ──────────────────────────────────────────────────────────┐
   │                                                                         │
   ├─ AV path  →  AV_FORM_PRESENTED  (document upload / selfie capture)      │
   │                 │                                                        │
   │                 ├─ submitted  →  AV_PENDING   (provider processing)      │
   │                 │                 │                                      │
   │                 │                 ├─ result VERIFIED  →  GRANTED ─────►─┤
   │                 │                 ├─ result PENDING   →  AV_PENDING      │
   │                 │                 │    (show wait state; auto-poll)      │
   │                 │                 └─ result FAILED    →  DENIED  ─────►─┤
   │                 │                                                        │
   │                 └─ cancelled  →  CANCELLED  (original flow aborted)      │
   │                                                                          │
   └─ MFA path →  MFA_FORM_PRESENTED  (OTP / biometric prompt)               │
                    │                                                          │
                    ├─ pass            →  GRANTED ──────────────────────────►─┤
                    │                                                          │
                    └─ fail (attempt N)                                        │
                          │                                                    │
                          ├─ attempts < 3  →  MFA_FORM_PRESENTED (retry)      │
                          └─ attempts = 3  →  DENIED ────────────────────────►┤
                                                                               │
                                                                               ▼
                                                                      AUDIT_EVENT_WRITTEN
                                                                      (reason_code logged)
                                                                               │
                                                                    ┌──────────┴──────────┐
                                                                    ▼                     ▼
                                                               GRANTED                DENIED
                                                          (resume original        (action blocked;
                                                          flow + success toast)    show reason copy)
```

**Wireframe must show:** every named node. The modal must appear
_before_ the triggering action executes. Post-grant resumption must
return to the original action context, not to a generic dashboard.

---

## 3. Auto-Trigger Conditions

The following actions automatically issue a challenge without user
initiation. The system emits the challenge and the modal appears
before the action proceeds:

| Triggering action                                         | Challenge type | Reason code                 |
| --------------------------------------------------------- | -------------- | --------------------------- |
| Token purchase above platform threshold                   | AV (KYC)       | `KYC_REQUIRED`              |
| First adult-content surface access                        | AV (age gate)  | `AGE_VERIFICATION_REQUIRED` |
| VIP age re-verify cadence due                             | AV (re-verify) | `AGE_REVERIFY_DUE`          |
| Large CZT purchase (volume-quote path)                    | Step-up MFA    | `STEP_UP_REQUIRED`          |
| Cyrano top-up                                             | Step-up MFA    | `STEP_UP_REQUIRED`          |
| Admin adjustment (rate-card, geo-block, NCII suppression) | Step-up MFA    | `STEP_UP_REQUIRED`          |
| Legal hold placement                                      | Step-up MFA    | `STEP_UP_REQUIRED`          |
| WORM audit export                                         | Step-up MFA    | `STEP_UP_REQUIRED`          |

---

## 4. Layout Intent — Modal Overlay

The gate appears as a **full-screen modal overlay**.

### 4.1 Container

- **Background:** dark (THEME token `--surface-overlay-dark`); red accent border on `HARD_DECLINE` / `FAILED` states (THEME token `--accent-critical`).
- **Position:** centered, max-width 480 px, vertically centered; full-bleed backdrop blocks interaction with the page beneath.
- **Focus trap:** keyboard navigation is confined to the modal until resolved. Tab order: progress stepper → form widget → footer CTAs.
- **ARIA:** `role="dialog"`, `aria-modal="true"`, `aria-labelledby="gg-modal-title"`.
- **`test_id`:** `gateguard-stepup-modal` (per `ui/config/accessibility.ts`).

### 4.2 Header

```
┌────────────────────────────────────────────────┐
│  🔒  Identity Verification Required            │
│      [subtitle: one-line context for this      │
│       specific trigger — e.g. "Confirm your   │
│       identity to complete this purchase."]    │
└────────────────────────────────────────────────┘
```

- Heading text: **"Identity Verification Required"** (locked copy; not overridable by Creative per compliance requirement).
- Subtitle: context-specific copy slot driven by `reason_code` → `04-reason-code-catalog.md`.
- Icon: lock glyph (neutral); changes to warning glyph on `FAILED` / `DENIED`.

### 4.3 Progress Stepper

Visible on multi-step AV flows only (MFA is single-step; stepper is hidden for MFA):

```
  ① Identity document  ──  ② Selfie  ──  ③ Confirmation
  ●                         ○               ○
```

- Active step: filled circle + label.
- Completed step: check mark + label.
- Pending step: hollow circle + label.
- Component: `<VerificationStepper steps={steps} activeStep={n} />`.

### 4.4 Form Widget Area

Switched by challenge type:

| Challenge type       | Widget                                                                                                                |
| -------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Document upload (AV) | File drop zone + camera capture toggle; accepted formats listed; max size shown                                       |
| Selfie capture (AV)  | Camera stream with oval guide overlay; "Take photo" CTA                                                               |
| MFA / OTP (step-up)  | 6-digit input field (auto-advance on last digit); "Resend code" link (rate-limited per `06-idempotency-ratelimit.md`) |
| Biometric (step-up)  | Platform biometric prompt (device-native); fallback to OTP                                                            |

**Pending state (AV only):** Replace form widget with a spinner +
"We're reviewing your documents. This usually takes less than a
minute." Do not show a specific countdown — provider latency varies.

### 4.5 Welfare Guardian Band Badge

Displayed in the upper-right corner of the modal whenever a WGS
band is active for the current guest:

| WGS band      | Badge colour | Badge label       |
| ------------- | ------------ | ----------------- |
| GREEN (0–39)  | Hidden       | (not shown)       |
| NUDGE (40–69) | Green        | "Wellness check"  |
| PAUSE (70–89) | Amber        | "Taking a moment" |
| HARD (90+)    | Critical red | "Session paused"  |

The badge is non-interactive and non-dismissible. It links to the
Welfare Guardian Score documentation for operator surfaces only.
Source: `services/core-api/src/gateguard/welfare-guardian.scorer.ts`.
Treatment cross-reference: [`10-compliance-overlays.md §WGS`](10-compliance-overlays.md).

### 4.6 Bill 149 Prefix Band

If the surface that triggered this gate will display AI-generated
content after the gate clears (e.g. Cyrano whisper output,
AI-generated creator profile copy), a compliance band appears
_below_ the form widget area:

```
┌────────────────────────────────────────────────────────────────┐
│  ⚠  The content that follows may include AI-generated text.   │
│     [BILL_149_DISCLOSURE_PREFIX token — do not override]       │
└────────────────────────────────────────────────────────────────┘
```

- Component: `<Bill149Prefix />`.
- Copy source: `BILL_149_DISCLOSURE_PREFIX` constant. Creative does
  not override the string; they can style the band.
- Shown only when `CREATOR_AUTO=true` on the downstream surface.
- Cross-reference: [`10-compliance-overlays.md §Bill 149`](10-compliance-overlays.md).

### 4.7 Footer CTAs

```
┌────────────────────────────────────────────────┐
│  [Cancel]                     [Continue →]     │
└────────────────────────────────────────────────┘
```

| CTA          | Behaviour                                                                                                                  | Disabled states                                                          |
| ------------ | -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| **Continue** | Submits current step form; advances stepper; or confirms grant on final step                                               | Disabled while form is empty / invalid; disabled during async AV pending |
| **Cancel**   | Aborts the gate; sets outcome to `CANCELLED`; original flow is abandoned (not resumed); navigates back to previous context | Hidden on `HARD_DECLINE_HCZ` (non-dismissible per §WGS rules)            |

- Both buttons carry `test_id` per `ui/config/accessibility.ts`.
- Button states: default · hover · active · disabled · loading.

---

## 5. Outcome Handling

### 5.1 GRANTED

1. Modal closes with a 200 ms fade-out transition.
2. Original triggering action proceeds automatically.
3. **Success toast** appears at the bottom of the viewport (not inside the modal): copy slot — "Verified. Continuing…" (or action-specific variant from `04-reason-code-catalog.md`).
4. `AUDIT_EVENT_WRITTEN` with `reason_code: STEP_UP_GRANTED` or `AV_VERIFIED`.

### 5.2 DENIED (MFA fail × 3)

1. Modal remains open; form widget replaced with denial state.
2. Copy slot: "Verification failed. This attempt was logged." (per `04-reason-code-catalog.md §STEP_UP_DENIED`).
3. **"This attempt was logged"** copy is non-negotiable — it is the audit-notification surface requirement.
4. Original action is blocked. Footer shows only **Cancel**.
5. `AUDIT_EVENT_WRITTEN` with `reason_code: STEP_UP_DENIED`.

### 5.3 AV FAILED

1. Modal remains open; failed state shown with `--accent-critical` treatment.
2. Copy slot: "We couldn't verify your identity. → [contact support]" (per `KYC_FAILED`).
3. Support handoff CTA routes to HCZ (Human Contact Zone).
4. `AUDIT_EVENT_WRITTEN` with `reason_code: KYC_FAILED`.

### 5.4 CANCELLED

1. Modal closes.
2. Original action is abandoned; no ledger write, no audit of the underlying action (gate abandonment is logged separately).
3. Guest returns to the context they were in before the trigger.

---

## 6. Compliance Invariants

The following rules are governance requirements and are not
stylistic choices:

| Rule                        | Requirement                                                                                                                   |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Audit log                   | Every challenge attempt (pass or fail) writes an `AuditEvent` row with `correlation_id` and `reason_code`. Non-negotiable.    |
| Non-dismissibility          | `COOL_DOWN` and `HARD_DECLINE_HCZ` WGS modals inside this flow are non-dismissible. Cancel CTA is hidden.                     |
| Attempt counter             | MFA attempt counter is always visible to the guest ("X attempts remaining").                                                  |
| No detail leakage           | Denial copy must never reveal why a specific MFA attempt failed (e.g. wrong code vs expired code). Use the copy slot exactly. |
| Operator audit notification | On operator-triggered step-up, the modal must surface "This attempt was logged." in the denied state.                         |
| AV result immutability      | `AvStatus` transitions are append-only. The gate cannot clear a `FAILED` result without a new AV submission.                  |
| Bill 149                    | If the downstream surface is AI-generated, `<Bill149Prefix />` is required in the modal before the gate clears.               |

---

## 7. Cross-Stack Binding

Per [`07-cross-stack-vocabulary.md §Component ontology`](07-cross-stack-vocabulary.md),
the `<StepUpModal />` component is **identical** across ChatNow.Zone,
RedRoomRewards, and Cyrano. Layout, state machine, and audit path are
shared. Locally canonical copy slots are filled from the stack's own
`reason_code` → copy mapping.

| Stack          | Step-up trigger example               | AV trigger example                            |
| -------------- | ------------------------------------- | --------------------------------------------- |
| ChatNow.Zone   | Large CZT purchase, admin adjustment  | KYC at token purchase, age gate at VIP access |
| RedRoomRewards | Escrow release, payout adjustment     | KYC at first escrow, RRR adult-content access |
| Cyrano         | Cyrano top-up, session admin override | (Binds to CNZ KYC — no standalone AV)         |

---

## 8. Open Gaps (resolve before Alpha cutover)

| Gap                                                                                                     | Owner                              | Tracking                                                                                                    |
| ------------------------------------------------------------------------------------------------------- | ---------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Biometric fallback to OTP — exact retry UX on biometric prompt timeout                                  | `services/core-api/src/auth/`      | Pending auth-service spec                                                                                   |
| AV provider integration — concrete provider name for copy ("Verify with [Provider]")                    | Compliance / Legal                 | Pre-launch checklist item                                                                                   |
| MFA resend rate-limit copy — exact cooldown duration to surface in UI                                   | `06-idempotency-ratelimit.md` §MFA | Pending rate-limit config                                                                                   |
| Presenter contract for `<StepUpAuthModal />` — add to `ui/types/public-onboarding-contracts.ts`         | UI directive                       | Will be authored alongside Next.js app bootstrap (noted in `01-presenter-contracts.md §Open contract gaps`) |
| Cyrano Bill 149 edge case — when whisper output is AI-generated but the creator edits it before sending | Engineering / Compliance           | Flagged in `10-compliance-overlays.md`                                                                      |
