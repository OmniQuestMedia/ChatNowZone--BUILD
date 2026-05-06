# Retirement Note — G101+ "Black-Glass Interface"

**Date retired:** 2026-05-06
**Authority:** Kevin B. Hartley, CEO — OmniQuest Media Inc.
**Scope:** All `G101..G199` placeholder rows in `CNZ-WORK-001`, every
`Black-Glass Interface` reference in live docs / code / launch manifests,
and the `BG:` directive prefix in the domain glossary.

## Why this is being retired

"Black-Glass Interface" is a redundant visual-treatment concept that was
scraped from the program a long time ago but kept sneaking back into
checklists, requirement rows, glossary entries, and architectural
overviews. Carrying it forward as `NEEDS_DIRECTIVE` work creates two
recurring failure modes:

1. **Recurring directive churn.** Every program-state refresh re-lists
   it as outstanding launch-blocker work, which then re-attracts proposals,
   ROADMAP entries, and decomposition tasks (`B003 → G101..G199`).
2. **Stylistic name leak.** The "Black-Glass" name shows up in product
   copy (`ui/config/seo.ts`), commit-prefix glossaries
   (`.github/copilot-instructions.md`'s `UI:` entry), and the domain
   glossary (`docs/DOMAIN_GLOSSARY.md`'s `BG:` entry) where it is no
   longer wanted.

The visual treatment that ChatNow.Zone Alpha actually ships is the dark-
mode token system in `ui/config/theme.ts`. That stack is sufficient for
the launch posture and does not need to be re-branded under a separate
visual doctrine. Per-feature UI work is tracked under the existing `UI:`
commit prefix.

## Replacement / forward path

* The `UI:` prefix in `.github/copilot-instructions.md` now reads
  "Frontend (admin panels, creator surfaces, public-facing UI)".
* `docs/DOMAIN_GLOSSARY.md`'s `UI:` row covers all front-end work; the
  `BG:` row is removed.
* `ui/config/theme.ts`'s file header documents the dark-mode token
  system on its own terms (no "Black-Glass" branding).
* `ui/config/seo.ts` description copy uses neutral wording ("premium
  concierge experience") instead of "Black-Glass concierge".
* `OQMI_SYSTEM_STATE.md` §4 L0 ship-gate table no longer carries the
  `Black-Glass Interface` row — UI work is tracked per-surface, not
  under a single visual doctrine.
* `CNZ-WORK-001` Wave G XL-decomposition slot for Black-Glass and the
  `G101..G199` placeholder block are marked **RETIRED 2026-05-06** with
  pointers back to this note.

## What was *not* changed

Historical artefacts that accurately reflect the state of the program
at the time they were written are **append-only** per the OQMI
governance doctrine and are left untouched:

* `PROGRAM_CONTROL/REPORT_BACK/POST-PAYLOAD9-HYGIENE-2026-05-03.md`
* `PROGRAM_CONTROL/REPORT_BACK/PAYLOAD-10-BACKEND-CLOSURE.md`
* `PROGRAM_CONTROL/DIRECTIVES/DONE/PAYLOAD-10-BACKEND-CLOSURE.md`

These files mention "Black-Glass" as part of their snapshot of the
backlog at write-time. Future report-backs will not reference the
concept.

## Contact

Questions about this retirement → file a directive in
`PROGRAM_CONTROL/DIRECTIVES/QUEUE/` and tag it `GOV:` so it routes
through the CEO gate.
