# GOV-CNZ-CHARTER-CONSOLIDATE-001 — Charter Consolidation in ChatNowZone--BUILD

**Document ID:** GOV-CNZ-CHARTER-CONSOLIDATE-001
**Type:** Governance cleanup (judgment-heavy)
**Authority:** Kevin B. Hartley, CEO — OmniQuest Media Inc. (commissioned via Cowork orchestrator session, 2026-05-19)
**Repo:** `OmniQuestMediaInc/ChatNowZone--BUILD`
**Path:** `PROGRAM_CONTROL/DIRECTIVES/QUEUE/GOV-CNZ-CHARTER-CONSOLIDATE-001.md`
**Date opened:** 2026-05-19
**Status:** QUEUED
**Agent:** grok
**CEO_GATE:** YES — canonicalization decisions require CEO input
**Rule Applied:** OQMI_GOVERNANCE

-----

## 1. CONTEXT

`PROGRAM_CONTROL/DIRECTIVES/QUEUE/` in CNZ-BUILD currently contains the following charter-like or persistent documents:

- `CNZ-WORK-001.md` — Active Work Charter
- `CNZ-WORK-001-AMEND-C007.md` — amendment
- `WORK-ORDER-v0.1.md` — earlier work order
- `WORK-ORDER-v0.2.md` — current work order (per README)
- `CROSS-REPO-FLAG-001.md` — Webhook/eCommsZone client cross-repo flag (status: OPEN)
- `CNZ-GROK-STANDING-PROMPT.md` — Grok continuous execution authority
- `OQMI_GOVERNANCE.md` — governance (will become downstream-synced after propagation pipeline)
- `OQMI_SYSTEM_STATE.md` — state tracker (will become downstream-synced after propagation pipeline)
- `OSS-Lift-From-Index.md` — OSS context
- `OSS-Repo-Registry.md` — OSS context

A droid asked "what is the active charter for this repo?" has no single answer. The standing prompt (CNZ-GROK-STANDING-PROMPT.md) lists six files to read before any action, which is heavy and slows execution.

## 2. DELTAS

- [ ] **D1** — Audit each charter-like file. For each, decide:
  - **KEEP** as canonical at current path (note in INDEX)
  - **AMEND-IN-PLACE** (live document; document in INDEX)
  - **ARCHIVE** to `archive/charters/` (with reason)
  - **MERGE** into another canonical file (with target)
- [ ] **D2** — Author `PROGRAM_CONTROL/DIRECTIVES/QUEUE/CHARTER_INDEX.md` — single canonical pointer listing exactly which files are active charters, their lifecycle, and their relationship to each other. New entry to the standing prompt's STEP 1 read order replaces the current six-file list with `CHARTER_INDEX.md → [resolved canonical files]`.
- [ ] **D3** — Resolve `CROSS-REPO-FLAG-001.md` (status: OPEN since 2026-05-06) — either close out (move to DONE if eCommsZone Node.js client and webhook contracts are now confirmed) or amend with current status.
- [ ] **D4** — Update `CNZ-GROK-STANDING-PROMPT.md` STEP 1 read order to reference `CHARTER_INDEX.md` as the canonical entry point.
- [ ] **D5** — Update `.github/copilot-instructions.md` "Active Charter" pointer if applicable.

## 3. ACCEPTANCE CRITERIA

- `CHARTER_INDEX.md` exists with exhaustive list of charter-like files and their canonical status.
- Standing prompt STEP 1 read order references CHARTER_INDEX.md, not the six-file list.
- All files marked ARCHIVE relocated to `archive/charters/` with git-tracked move (preserves history).
- All files marked MERGE consolidated into target.
- A droid following the standing prompt has unambiguous answer to "what is the active charter?"
- Green ship-gate.

## 4. JUDGMENT POINTS (CEO_GATE)

CEO confirms canonicalization decisions for any file marked AMEND-IN-PLACE vs ARCHIVE vs MERGE before PR merges. PR uses CEO_GATE: YES.

## 5. BLOCKERS / DEPENDENCIES

None — independent cleanup.

## 6. BLOCKS

- Future directives that depend on a single canonical charter pointer.

## HANDOFF

Assign to grok. PR on `grok/gov-cnz-charter-consolidate-001` branch. CEO reviews D1 audit + D2 INDEX before merge.
