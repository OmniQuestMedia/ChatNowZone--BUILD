# TASK-HYG-001 — ChatNowZone--BUILD Hygiene Verification

**Type:** One-time hygiene verification task  
**Status:** READY FOR ASSIGNMENT  
**Priority:** Medium  
**Repo:** `OmniQuestMediaInc/ChatNowZone--BUILD`  
**Created by:** Senior Engineering & Coding Thread  
**Date:** 2026-05-23  

## Objective
Complete a full hygiene verification pass on ChatNowZone--BUILD and confirm it meets current MaxZoneGPT / OQMInc hygiene and alignment standards.

## Scope
- Verify `archive/` folder and `README.md` exist and are correctly formatted.
- Scan for any remaining old PROGRAM_CONTROL documents, duplicate governance files, scattered task lists, or outdated standards outside of `archive/`.
- Confirm basic structural hygiene (folder consistency, absence of duplicate policy artifacts).
- Produce a short verification report.

## Success Criteria
- `archive/` structure is present and properly documented.
- No active duplicate/outdated governance or task documents remain outside `archive/`.
- A clear `HYGIENE-VERIFICATION-REPORT.md` (or equivalent) is created in the repo or `archive/` folder.
- Any issues found are logged with clear next-step recommendations.

## Constraints & Guardrails
- This is a **hygiene and verification task only**.
- Do **not** modify code, architecture, integration points, or any files related to CNZ ↔ SynthiMatesAi work.
- Do not create new features or change existing functionality.
- Follow OQMI_GOVERNANCE and current hygiene process standards.

## Output
Create a short report (e.g. `HYGIENE-VERIFICATION-REPORT.md`) summarizing findings and confirming completion.

## Assignment Notes
This task can be worked by a single copilot in Droid mode. It is low-risk and non-blocking for current architecture work.