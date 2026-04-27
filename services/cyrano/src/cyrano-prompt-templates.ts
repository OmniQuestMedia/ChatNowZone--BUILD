// PAYLOAD 5+ — Cyrano shared prompt-template engine
// Phase 3.11 — Layers 1, 2, 3, and 4 share this template surface so the same
// (category, domain, tier) tuple resolves to the same baseline copy across
// runtimes. Concrete services may override individual lines via persona
// presets, but the canonical templates live here.

import type { CyranoCategory, CyranoDomain } from './cyrano.types';

export type CyranoTier = 'COLD' | 'WARM' | 'HOT' | 'INFERNO';

export interface CyranoPromptKey {
  category: CyranoCategory;
  domain: CyranoDomain;
  tier: CyranoTier;
}

export type CyranoPromptTemplate = (vars: { tone: string; tier: CyranoTier }) => string;

const ADULT_TEMPLATES: Partial<Record<CyranoCategory, CyranoPromptTemplate>> = {
  CAT_SESSION_OPEN: ({ tone }) =>
    `[${tone}] Open warmly — acknowledge the guest by name and set an expectation for this session.`,
  CAT_ENGAGEMENT: ({ tone }) =>
    `[${tone}] Keep the flow — ask one open question tied to their last reply.`,
  CAT_ESCALATION: ({ tone, tier }) =>
    `[${tone}] The room is ${tier}. Escalate intimacy with a direct, on-brand line.`,
  CAT_NARRATIVE: ({ tone }) =>
    `[${tone}] Reinforce the arc — reference the throughline you set up earlier.`,
  CAT_CALLBACK: ({ tone }) =>
    `[${tone}] Call back a detail from prior sessions to cement the bond.`,
  CAT_RECOVERY: ({ tone }) =>
    `[${tone}] Soft check-in — invite them to tell you what would make tonight memorable.`,
  CAT_MONETIZATION: ({ tone, tier }) =>
    `[${tone}] Make a confident, specific offer that matches room heat (${tier}).`,
  CAT_SESSION_CLOSE: ({ tone }) =>
    `[${tone}] Close with anchored intimacy — name the highlight and hint at next time.`,
};

const TEACHING_TEMPLATES: Partial<Record<CyranoCategory, CyranoPromptTemplate>> = {
  CAT_SESSION_OPEN: ({ tone }) =>
    `[${tone}] Open with the learning objective and invite the student to set their own goal for the session.`,
  CAT_ENGAGEMENT: ({ tone }) =>
    `[${tone}] Probe understanding — ask one diagnostic question rooted in the student's last attempt.`,
  CAT_NARRATIVE: ({ tone }) =>
    `[${tone}] Tie the current concept back to a previously mastered skill.`,
  CAT_CALLBACK: ({ tone }) =>
    `[${tone}] Reference the student's earlier breakthrough to anchor confidence.`,
  CAT_RECOVERY: ({ tone }) =>
    `[${tone}] Reset gently — offer a worked example before the next attempt.`,
  CAT_SESSION_CLOSE: ({ tone }) =>
    `[${tone}] Recap the takeaway and surface one practice item for the next session.`,
};

const COACHING_TEMPLATES: Partial<Record<CyranoCategory, CyranoPromptTemplate>> = {
  CAT_SESSION_OPEN: ({ tone }) =>
    `[${tone}] Open with a one-sentence check-in: "What's the most important thing for today?"`,
  CAT_ENGAGEMENT: ({ tone }) =>
    `[${tone}] Reflect back the client's stated outcome before moving to the next question.`,
  CAT_NARRATIVE: ({ tone }) =>
    `[${tone}] Surface the pattern across the last few sessions — name what you're noticing.`,
  CAT_CALLBACK: ({ tone }) =>
    `[${tone}] Reference the commitment made last session and ask what changed.`,
  CAT_RECOVERY: ({ tone }) =>
    `[${tone}] Slow down — invite the client to take 30 seconds before answering.`,
  CAT_SESSION_CLOSE: ({ tone }) =>
    `[${tone}] Lock the next concrete commitment and book the next session.`,
};

const FIRST_RESPONDER_TEMPLATES: Partial<Record<CyranoCategory, CyranoPromptTemplate>> = {
  CAT_SESSION_OPEN: ({ tone }) =>
    `[${tone}] Confirm scene safety and run a structured handoff briefing.`,
  CAT_ENGAGEMENT: ({ tone }) =>
    `[${tone}] Ask the next decision-tree question (PLAN-A vs PLAN-B fork).`,
  CAT_RECOVERY: ({ tone }) =>
    `[${tone}] Pause for tactical breathing — re-establish situational awareness.`,
  CAT_SESSION_CLOSE: ({ tone }) =>
    `[${tone}] Run the post-incident debrief checklist; capture lessons-learned.`,
};

const FACTORY_SAFETY_TEMPLATES: Partial<Record<CyranoCategory, CyranoPromptTemplate>> = {
  CAT_SESSION_OPEN: ({ tone }) =>
    `[${tone}] Confirm PPE check and review the shift's hazard register.`,
  CAT_ENGAGEMENT: ({ tone }) =>
    `[${tone}] Ask the operator to verbalise the next checkpoint before action.`,
  CAT_RECOVERY: ({ tone }) =>
    `[${tone}] Halt the line — re-check the lockout/tagout state.`,
  CAT_SESSION_CLOSE: ({ tone }) =>
    `[${tone}] Capture the end-of-shift safety report.`,
};

const MEDICAL_TEMPLATES: Partial<Record<CyranoCategory, CyranoPromptTemplate>> = {
  CAT_SESSION_OPEN: ({ tone }) =>
    `[${tone}] Confirm patient identity and consent before introducing the agenda.`,
  CAT_ENGAGEMENT: ({ tone }) =>
    `[${tone}] Ask one open question to invite the patient's perspective.`,
  CAT_NARRATIVE: ({ tone }) =>
    `[${tone}] Connect the current finding to the patient's stated goal.`,
  CAT_CALLBACK: ({ tone }) =>
    `[${tone}] Reference last visit's plan and check adherence.`,
  CAT_RECOVERY: ({ tone }) =>
    `[${tone}] Acknowledge difficulty before suggesting the next step.`,
  CAT_SESSION_CLOSE: ({ tone }) =>
    `[${tone}] Summarise the plan and confirm the next-step instructions are understood.`,
};

const TEMPLATES_BY_DOMAIN: Record<CyranoDomain, Partial<Record<CyranoCategory, CyranoPromptTemplate>>> = {
  ADULT_ENTERTAINMENT: ADULT_TEMPLATES,
  TEACHING: TEACHING_TEMPLATES,
  COACHING: COACHING_TEMPLATES,
  FIRST_RESPONDER: FIRST_RESPONDER_TEMPLATES,
  FACTORY_SAFETY: FACTORY_SAFETY_TEMPLATES,
  MEDICAL: MEDICAL_TEMPLATES,
};

/**
 * Resolve a prompt template for a (category, domain, tier) triple. Returns
 * `null` when the domain has intentionally suppressed the category (for
 * instance: ESCALATION/MONETIZATION are absent from non-adult domains).
 */
export function resolvePromptTemplate(key: CyranoPromptKey): CyranoPromptTemplate | null {
  const domainTemplates = TEMPLATES_BY_DOMAIN[key.domain];
  return domainTemplates[key.category] ?? null;
}
