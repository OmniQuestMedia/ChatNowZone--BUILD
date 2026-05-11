# R-CLARIFY-CONSOLIDATED.md — CEO Decision Pass

**Task:** CNZ-WORK-001-B001
**Wave:** B
**Filed by:** Grok (primary build agent — effective 2026-05-11)
**Date:** 2026-05-11
**CEO_GATE:** YES — CEO answers; Grok structures
**Status:** AWAITING CEO ANSWERS

**Purpose:** Surface all twelve R-CLARIFY items to the CEO in a single pass.
CEO provides one answer per item. Answers unblock Wave F tasks and downstream
BLOCKED directives in Waves D–G. No answers are assumed or filled in below.

---

## HOW TO USE THIS DOCUMENT

For each item below:
1. Read the **Question** and the **Options**.
2. Write your decision in the `CEO ANSWER:` field (e.g., `(a)`, `(b)`, or free text).
3. Once all items are answered, Grok will execute the downstream task conversions
   and close B001.

Partial answers are accepted — leave unanswered fields blank and Grok will hold
those downstream tasks as BLOCKED.

---

## R-CLARIFY-001 — CreatorControl.Zone™ scope vs My Zone Manager™

**Question:** Are `CreatorControl.Zone™` and `My Zone Manager™` the same surface
(different names for one thing) or separate products? What is the intended scope
of each?

**Options:**
- **(a)** Single surface — adopt `CreatorControl.Zone™` as canonical name; retire
  `My Zone Manager™` terminology.
- **(b)** Single surface — adopt `My Zone Manager™` as canonical name; retire
  `CreatorControl.Zone™` terminology.
- **(c)** Two distinct surfaces — define each scope separately.

**Downstream tasks blocked:** E001 (CNZ-WORK-001-E001, BUILD-NEW creator dashboard)

**CEO ANSWER:**

---

## R-CLARIFY-002 — MyCrew.Zone — custom or Twenty CRM integration?

**Question:** Is `MyCrew.Zone` built as a custom CRM service in this repo, or does
it integrate with the Twenty CRM open-source platform, or a hybrid of both?

**Options:**
- **(a)** Custom in-repo CRM service (BUILD-NEW at `services/mycrewzone/`).
- **(b)** Twenty CRM integration layer (define which Twenty objects/schemas are
  required; build integration service).
- **(c)** Hybrid — custom wrapper on top of Twenty CRM; define boundary.

**Downstream tasks blocked:** F001 (CNZ-WORK-001-F001, MyCrew.Zone BUILD-NEW)

**CEO ANSWER:**

---

## R-CLARIFY-003 — Flicker n'Flame Scoring (FFS) — standalone service or platform feature?

**Question:** Is Flicker n'Flame Scoring (FFS) implemented as a standalone
microservice, or as a feature embedded within HeartZone, Bijou, or another
existing service?

**Options:**
- **(a)** Standalone microservice (`services/ffs/` — already scaffolded in Payload 11).
- **(b)** Feature of HeartZone.
- **(c)** Feature of Bijou.
- **(d)** Shared feature across multiple parents — define parent list.

**Note:** FFS service is already scaffolded at `services/ffs/` (Payload 11 / Wave
Phase 1). Selecting (a) confirms the existing scaffold; any other option may require
re-homing the code.

**Downstream tasks blocked:** F002 (Flicker n'Flame Scoring BUILD-NEW). Also affects
plan §B.5.3 F1 precision/recall claim (C007).

**CEO ANSWER:**

---

## R-CLARIFY-004 — FairPay / FairPlay — inside Wallet or separate service?

**Question:** Is the FairPay / FairPlay rate engine implemented inside
`services/wallet/` or as a separate `services/fairpay/` service?

**Options:**
- **(a)** Inside `services/wallet/` — rate engine is a Wallet extension.
- **(b)** Separate service — `services/fairpay/` (or `services/fairplay/`).
- **(c)** FairPay is inside Wallet; FairPlay is a separate surface.

**Downstream tasks blocked:** D006 (CNZ-WORK-001-D006, FairPay + NOWPayouts EXTEND)

**CEO ANSWER:**

---

## R-CLARIFY-005 — DFSP™ — define acronym and clarify scope

**Question:** What does DFSP™ stand for, and what is its scope relative to the
Welfare Guardian Score (WGS)?

**Options:**
- **(a)** Define acronym expansion + scope (free-text answer required; agent will
  create `services/dfsp/` BUILD-NEW directive after CEO defines scope).
- **(b)** DFSP™ is the same as Welfare Guardian Score — retire one name; adopt the
  other as canonical.
- **(c)** DFSP™ is a parent layer; WGS is a sub-score within it.

**Downstream tasks blocked:** F003 (CNZ-WORK-001-F003, DFSP™ BUILD-NEW)

**CEO ANSWER:**

---

## R-CLARIFY-006 — Human Contact Zone vs HeartZone — confirm separate; clarify HZ commit prefix

**Question:** Are `Human Contact Zone (HCZ)` and `HeartZone (HZ)` confirmed as
two separate domains? The prefix resolution was partially resolved in A012
(HCZ split from HZ, confirmed 2026-04-23). This item closes the scope clarification
half.

**Options:**
- **(a)** Confirmed separate — HZ = HeartZone IoT/biometric; HCZ = Human Contact
  Zone (human moderator/concierge/support layer). Prefixes HZ and HCZ are both
  in canonical enum (per A012).
- **(b)** Merge — consolidate into one service/prefix (specify which name and prefix
  to keep).

**Note:** A012 landed HCZ as a split from HZ. This answer confirms or amends that
decision.

**Downstream tasks blocked:** F004 (CNZ-WORK-001-F004, Human Contact Zone BUILD-NEW)

**CEO ANSWER:**

---

## R-CLARIFY-007 — Cyrano™ — which of 4 architectural layers is in launch scope?

**Question:** The Cyrano™ architecture has four layers. Which layer(s) are in scope
for the 2026-10-01 hard launch?

Documented layers (from `services/cyrano/` and prior directives):
1. **L1** — Twin narrative scaffolding / prompt orchestration
2. **L2** — LLM provider abstraction (already scaffolded — CYR-006 / Payload 10)
3. **L3** — Age + consent engine integration
4. **L4** — Real-time stream response (live voice/video narrative)

**Options:**
- **(a)** L2 only (current scaffold is launch scope; L1/L3/L4 are post-launch).
- **(b)** L1 + L2 (narrative + provider abstraction).
- **(c)** L2 + L3 (provider abstraction + consent engine).
- **(d)** All four layers.
- **(e)** Custom selection — specify which layers and timeline.

**Downstream tasks blocked:** B002 (Cyrano XL decomposition), G-series tasks (G001+)

**CEO ANSWER:**

---

## R-CLARIFY-008 — Welfare Guardian Score — subsume into Risk Engine or standalone?

**Question:** Is the Welfare Guardian Score (WGS) a sub-component of the Risk
Engine (`services/risk/`) or a standalone service?

**Options:**
- **(a)** Sub-component of Risk Engine — WGS is an output metric of the Risk
  Assessment Toolkit (non-gating, advisory only, per Corpus Ch.4 §6.3).
- **(b)** Standalone service (`services/welfare-guardian/`) — separate lifecycle
  from Risk Engine.
- **(c)** Sub-component of DFSP™ (pending R-CLARIFY-005 resolution).

**Downstream tasks blocked:** F005 (CNZ-WORK-001-F005, WGS build/extend). Also
unblocks D002 extension (Risk Engine — confirm WGS interface).

**CEO ANSWER:**

---

## R-CLARIFY-009 — RedRoomRewards™ — separate repo or inside this repo?

**Question:** Is `RedRoomRewards™` implemented in a separate repository
(`OmniQuestMediaInc/RedRoomRewards`) or inside `ChatNowZone--BUILD`?

**Options:**
- **(a)** Separate repo — this charter row retires from `CNZ-WORK-001`; webhook
  contract is tracked in `CROSS-REPO-FLAG-001.md`.
- **(b)** Inside this repo — convert to BUILD-NEW task(s) in this charter; define
  scope.

**Downstream tasks blocked:** F006 (RedRoomRewards scope definition)

**CEO ANSWER:**

---

## R-CLARIFY-010 — HeartZone IoT Loop ↔ HeartPleasureExperiences™ relationship

**Question:** What is the relationship between `HeartZone IoT Loop` and
`HeartPleasureExperiences™`? Are they the same surface, or does HPE consume
HeartZone data?

**Options:**
- **(a)** Same surface — HPE is the product name; HeartZone IoT Loop is the
  implementation name. One service.
- **(b)** HPE is a consumer/presentation layer above the HeartZone IoT Loop service.
  Two services with a defined data contract.
- **(c)** Separate products with separate scopes — define each.

**Note:** SenSync™ (`services/sensync/`) is already scaffolded as the biometric
aggregation layer (Payload 11). This answer defines where HPE fits relative to
SenSync™.

**Downstream tasks blocked:** D005 (CNZ-WORK-001-D005, HeartZone IoT Loop VERIFY +
EXTEND — currently BLOCKED)

**CEO ANSWER:**

---

## R-CLARIFY-011 — Bijou.Zone Theatre — which Park(s)?

**Question:** Which Parks are in scope for the 2026-10-01 launch of Bijou.Zone
Theatre?

**Context:** The Bijou.Zone Theatre architecture supports multiple named "Parks"
(presentation environments). The launch set needs to be defined so the D007 task
can scope the SFU (LiveKit/Mediasoup) and Dwell-Credit algorithm.

**Options:**
- **(a)** Free-text: list which Park(s) are launch-scoped.
- **(b)** Single Park only (default "Main Stage" or equivalent) — all others are
  post-launch.
- **(c)** All Parks — full Bijou Theatre is launch scope.

**Downstream tasks blocked:** D007 (CNZ-WORK-001-D007, Bijou.Zone Theatre VERIFY +
EXTEND — currently BLOCKED)

**CEO ANSWER:**

---

## R-CLARIFY-012 — Frontend repo / app location

**Question:** Where does the ChatNow.Zone frontend application live? The repo
currently has `ui/types/` only (TypeScript interfaces). No `apps/` directory exists.

**Options:**
- **(a)** Frontend is in a separate repo — name the repo; this charter row retires
  from `CNZ-WORK-001`; add cross-repo flag.
- **(b)** Frontend will be added to this repo under `apps/` — confirm and Grok will
  create the scaffold.
- **(c)** Frontend is intentionally deferred — mark as post-launch; retire this
  clarify row.

**Downstream tasks blocked:** H-series (UI hardening tasks depend on knowing where
the frontend lives).

**CEO ANSWER:**

---

## Summary — Downstream Task Map

| R-CLARIFY ID | Blocks | Wave |
|---|---|---|
| R-CLARIFY-001 | E001 (CreatorControl.Zone BUILD-NEW) | E |
| R-CLARIFY-002 | F001 (MyCrew.Zone BUILD-NEW) | F |
| R-CLARIFY-003 | F002 (FFS BUILD-NEW — scaffold exists) | F |
| R-CLARIFY-004 | D006 (FairPay EXTEND) | D |
| R-CLARIFY-005 | F003 (DFSP™ BUILD-NEW) | F |
| R-CLARIFY-006 | F004 (HCZ BUILD-NEW) | F |
| R-CLARIFY-007 | B002, G001+ (Cyrano layers) | B / G |
| R-CLARIFY-008 | F005 (WGS), D002 extension | D / F |
| R-CLARIFY-009 | F006 (RedRoomRewards) | F |
| R-CLARIFY-010 | D005 (HeartZone IoT EXTEND) | D |
| R-CLARIFY-011 | D007 (Bijou Theatre EXTEND) | D |
| R-CLARIFY-012 | H-series (frontend tasks) | H |

---

## Implementation Flow After Sign-Off

1. CEO fills each `CEO ANSWER:` field.
2. Grok converts each answer into updated task statuses in `CNZ-WORK-001.md`
   (BLOCKED items become CLAIMED or have Depends-on cleared).
3. Grok files `PROGRAM_CONTROL/DIRECTIVES/DONE/CNZ-WORK-001-B001-DONE.md`.
4. Grok updates `CNZ-WORK-001.md` B001 status to `DONE`.
5. B002 (Cyrano XL decomposition) opens once R-CLARIFY-007 is answered.

---

**End of R-CLARIFY-CONSOLIDATED.md**
