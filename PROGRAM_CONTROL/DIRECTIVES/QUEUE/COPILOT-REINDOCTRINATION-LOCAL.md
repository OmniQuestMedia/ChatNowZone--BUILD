# COPILOT-REINDOCTRINATION-LOCAL — ChatNowZone--BUILD

**Document ID:** COPILOT-REINDOCTRINATION-LOCAL
**Type:** Local standing prompt — pointer to canonical master
**Authority:** OQMInc Engineering Team
**Orchestrator:** Claude (Cowork) — Architectural + Coding Authority per 2026-05-19
**Repo:** `OmniQuestMediaInc/ChatNowZone--BUILD`
**Path:** `PROGRAM_CONTROL/DIRECTIVES/QUEUE/COPILOT-REINDOCTRINATION-LOCAL.md`
**Effective:** 2026-05-19
**Master:** `OmniQuestMediaInc/MaxZoneGPT/PROGRAM_CONTROL/DIRECTIVES/QUEUE/COPILOT-DROID-REINDOCTRINATION-MASTER.md`

---

## YOU ARE COPILOT IN STRICT DROID MODE

For the complete, canonical Strict Droid Mode contract — read order, execution loop, hard-stop conditions, report-back format — fetch and read the master file above. That is the binding source of truth.

```
gh api repos/OmniQuestMediaInc/MaxZoneGPT/contents/PROGRAM_CONTROL/DIRECTIVES/QUEUE/COPILOT-DROID-REINDOCTRINATION-MASTER.md --jq '.content' | base64 -d
```

This local file adds repo-specific context only.

## REPO ROLE & STATUS

**Role:** Live streaming creator platform (chatnow.zone); consumer of CyranoEngines adult Whisper path via API call (not vendored)
**Status:** BUILD COMPLETE — Canonical Compliant — Alpha Launch Ready (April 30, 2026 hard launch)

## PRIORITY DIRECTIVES IN THIS REPO'S QUEUE

1. **GOV-CNZ-CHARTER-CONSOLIDATE-001** (CEO_GATE: YES) — collapse 8+ charter files to single canonical CHARTER_INDEX.md before any feature work proceeds.

## REPO-SPECIFIC NOTES

Active charter is CNZ-WORK-001 (persistent, see lifecycle in its §0). FIZ-scoped commits require REASON/IMPACT/CORRELATION_ID per OQMI Coding Doctrine. eCommsZone Node.js client integration is Phase 0 exit criterion (still open per CROSS-REPO-FLAG-001). PR fast-path: `copilot/*` and `agent/*` branches.

## START

1. Workspace probe (`pwd`, `git status`, `git remote -v`)
2. Fetch and read the canonical master (command above)
3. Read this repo's `.github/copilot-instructions.md` (if present)
4. Read this file (you are here)
5. `ls PROGRAM_CONTROL/DIRECTIVES/QUEUE/`
6. Pick the highest-priority directive matching this repo's scope
7. Begin the master's execution loop

## ROUTING

- `Agent: copilot` → execute
- `Agent: grok` (queued before 2026-05-19) → re-routed to copilot per GOV-CANONICAL-AGENT-CHANGE-001 §3
- `CEO_GATE: YES` → draft + flag, do not auto-merge
- Cross-repo coordination → file `CROSS-REPO-FLAG-*` in both affected repos
