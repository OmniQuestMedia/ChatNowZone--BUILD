// PAYLOAD 5 — Cyrano Layer 1 service
// Business Plan B.3.5 — invisible whisper copilot for the creator panel.
//
// Contract:
//   • Eight suggestion categories (see CyranoCategory in cyrano.types).
//   • Real-time telemetry consumed from Flicker n'Flame Scoring (FFS) + session frames via NATS.
//   • Session memory keyed (creator_id, guest_id); persona manager supports
//     multiple active personas per creator (one-per-session).
//   • Latency SLO: ideal <2s, hard cutoff <4s — slow suggestions are
//     silently discarded (never shown) and an audit-only drop event fires.
//   • Invisible UI: suggestions are emitted on CYRANO_SUGGESTION_EMITTED
//     for the creator's copilot panel. Nothing reaches the guest.

import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { NatsService } from '../../core-api/src/nats/nats.service';
import { NATS_TOPICS } from '../../nats/topics.registry';
import {
  CYRANO_CATEGORIES,
  type CyranoCategory,
  type CyranoDropReason,
  type CyranoInputFrame,
  type CyranoSuggestion,
} from './cyrano.types';
import { PersonaManager } from './persona.manager';
import { SessionMemoryStore } from './session-memory.store';

export const CYRANO_RULE_ID = 'CYRANO_LAYER_1_v1';

/** Latency SLOs — governance constant. */
export const CYRANO_LATENCY = {
  IDEAL_MS: 2_000,
  HARD_CUTOFF_MS: 4_000,
} as const;

/**
 * Heat-tier → category weight matrix. Columns = tiers, rows = categories.
 * Values in 0..100. Higher = more relevant for that tier.
 *
 * Spec: Business Plan B.3.5 §2 (weighting by room state).
 *   • COLD   → OPEN / ENGAGEMENT / RECOVERY dominate
 *   • WARM   → ENGAGEMENT / NARRATIVE / CALLBACK
 *   • HOT    → ESCALATION / NARRATIVE / MONETIZATION
 *   • INFERNO→ MONETIZATION / ESCALATION / CLOSE (peak is for revenue)
 */
const CATEGORY_TIER_WEIGHTS: Record<CyranoCategory, Record<'COLD' | 'WARM' | 'HOT' | 'INFERNO', number>> = {
  CAT_SESSION_OPEN:  { COLD: 90, WARM: 40, HOT: 10, INFERNO: 5  },
  CAT_ENGAGEMENT:    { COLD: 70, WARM: 80, HOT: 55, INFERNO: 30 },
  CAT_ESCALATION:    { COLD: 20, WARM: 55, HOT: 85, INFERNO: 80 },
  CAT_NARRATIVE:     { COLD: 35, WARM: 70, HOT: 70, INFERNO: 45 },
  CAT_CALLBACK:      { COLD: 45, WARM: 65, HOT: 40, INFERNO: 25 },
  CAT_RECOVERY:      { COLD: 80, WARM: 50, HOT: 20, INFERNO: 10 },
  CAT_MONETIZATION:  { COLD: 15, WARM: 45, HOT: 80, INFERNO: 95 },
  CAT_SESSION_CLOSE: { COLD: 10, WARM: 15, HOT: 35, INFERNO: 60 },
};

@Injectable()
export class CyranoService {
  private readonly logger = new Logger(CyranoService.name);

  constructor(
    private readonly nats: NatsService,
    private readonly memory: SessionMemoryStore,
    private readonly personas: PersonaManager,
    private readonly clock: () => number = () => Date.now(),
  ) {}

  /**
   * Evaluate a telemetry frame and produce (and emit) a suggestion.
   * Returns null if:
   *   • no category matched (silence), OR
   *   • latency exceeded the hard cutoff (silent discard, drop event).
   */
  evaluate(frame: CyranoInputFrame, frameReceivedAtMs?: number): CyranoSuggestion | null {
    const t0 = frameReceivedAtMs ?? this.clock();
    const category = this.selectCategory(frame);

    if (!category) {
      this.publishDrop({
        session_id: frame.session_id,
        creator_id: frame.creator_id,
        category: 'UNKNOWN',
        reason_code: 'NO_CATEGORY_MATCH',
        latency_ms: this.clock() - t0,
        rule_applied_id: CYRANO_RULE_ID,
      });
      return null;
    }

    const persona = this.personas.getActiveForSession(frame.session_id, frame.creator_id);
    const weight = this.computeWeight(category, frame);
    const copy = this.buildCopy(category, frame, persona?.tone ?? 'neutral');

    const latency_ms = this.clock() - t0;
    if (latency_ms > CYRANO_LATENCY.HARD_CUTOFF_MS) {
      // Silent discard — never shown to the creator. Audit-only event.
      this.publishDrop({
        session_id: frame.session_id,
        creator_id: frame.creator_id,
        category,
        reason_code: 'LATENCY_EXCEEDED',
        latency_ms,
        rule_applied_id: CYRANO_RULE_ID,
      });
      return null;
    }

    const suggestion: CyranoSuggestion = {
      suggestion_id: randomUUID(),
      session_id: frame.session_id,
      creator_id: frame.creator_id,
      guest_id: frame.guest_id,
      category,
      weight,
      tier_context: frame.heat.tier,
      copy,
      reason_codes: this.reasonCodes(category, frame),
      persona_id: persona?.persona_id ?? null,
      latency_ms,
      emitted_at_utc: new Date().toISOString(),
      rule_applied_id: CYRANO_RULE_ID,
    };

    this.nats.publish(NATS_TOPICS.CYRANO_SUGGESTION_EMITTED, { ...suggestion });
    return suggestion;
  }

  /**
   * Pick the highest-weighted category for this frame. Deterministic —
   * ties break by the canonical CYRANO_CATEGORIES order.
   */
  selectCategory(frame: CyranoInputFrame): CyranoCategory | null {
    // Hard phase gates — OPENING always produces OPEN; CLOSING → CLOSE.
    if (frame.phase === 'OPENING') return 'CAT_SESSION_OPEN';
    if (frame.phase === 'CLOSING') return 'CAT_SESSION_CLOSE';

    // Recovery override — a never-tipped guest in long silence needs RECOVERY.
    if (
      !frame.guest_has_tipped &&
      frame.silence_seconds >= 30 &&
      frame.heat.tier !== 'INFERNO'
    ) {
      return 'CAT_RECOVERY';
    }

    // Callback override — we have a durable fact for this guest and they
    // are in a mid-session WARM/HOT window.
    if (
      (frame.phase === 'MID' || frame.phase === 'PEAK') &&
      (frame.heat.tier === 'WARM' || frame.heat.tier === 'HOT')
    ) {
      const facts = this.memory.listFacts(frame.creator_id, frame.guest_id);
      if (facts.length >= 2) {
        // Only prefer callback if its tier-weight is within 20 of the max.
        const cbWeight = CATEGORY_TIER_WEIGHTS.CAT_CALLBACK[frame.heat.tier];
        const maxWeight = Math.max(
          ...CYRANO_CATEGORIES.map((c) => CATEGORY_TIER_WEIGHTS[c][frame.heat.tier]),
        );
        if (maxWeight - cbWeight <= 20) return 'CAT_CALLBACK';
      }
    }

    // General case — take the max by tier weight.
    let best: { cat: CyranoCategory; weight: number } | null = null;
    for (const cat of CYRANO_CATEGORIES) {
      const w = CATEGORY_TIER_WEIGHTS[cat][frame.heat.tier];
      if (!best || w > best.weight) {
        best = { cat, weight: w };
      }
    }
    return best?.cat ?? null;
  }

  /**
   * Compute the final 0..100 weight with modulators.
   * Base = CATEGORY_TIER_WEIGHTS[cat][tier]
   * Modulators:
   *   • +10 if monetization + guest_has_tipped (warm lead)
   *   • +15 if recovery + silence_seconds >= 60
   *   • −20 if session_open emitted after dwell_minutes >= 5 (stale)
   */
  computeWeight(category: CyranoCategory, frame: CyranoInputFrame): number {
    let w = CATEGORY_TIER_WEIGHTS[category][frame.heat.tier];
    if (category === 'CAT_MONETIZATION' && frame.guest_has_tipped) w += 10;
    if (category === 'CAT_RECOVERY' && frame.silence_seconds >= 60) w += 15;
    if (category === 'CAT_SESSION_OPEN' && frame.dwell_minutes >= 5) w -= 20;
    return Math.max(0, Math.min(100, Math.round(w)));
  }

  private reasonCodes(category: CyranoCategory, frame: CyranoInputFrame): string[] {
    const codes: string[] = [`TIER_${frame.heat.tier}`, `PHASE_${frame.phase}`, `CAT_${category}`];
    if (!frame.guest_has_tipped) codes.push('GUEST_NO_TIP_YET');
    if (frame.silence_seconds >= 60) codes.push('SILENCE_HIGH');
    return codes;
  }

  private buildCopy(
    category: CyranoCategory,
    frame: CyranoInputFrame,
    tone: string,
  ): string {
    const toneTag = `[${tone}]`;
    switch (category) {
      case 'CAT_SESSION_OPEN':
        return `${toneTag} Open warmly — acknowledge the guest by name and set an expectation for this session.`;
      case 'CAT_ENGAGEMENT':
        return `${toneTag} Keep the flow — ask one open question tied to their last reply.`;
      case 'CAT_ESCALATION':
        return `${toneTag} The room is ${frame.heat.tier}. Escalate intimacy with a direct, on-brand line.`;
      case 'CAT_NARRATIVE':
        return `${toneTag} Reinforce the arc — reference the throughline you set up earlier.`;
      case 'CAT_CALLBACK':
        return `${toneTag} Call back a detail from prior sessions to cement the bond.`;
      case 'CAT_RECOVERY':
        return `${toneTag} Soft check-in — invite them to tell you what would make tonight memorable.`;
      case 'CAT_MONETIZATION':
        return `${toneTag} Make a confident, specific offer that matches room heat (${frame.heat.tier}).`;
      case 'CAT_SESSION_CLOSE':
        return `${toneTag} Close with anchored intimacy — name the highlight and hint at next time.`;
    }
  }

  private publishDrop(drop: CyranoDropReason): void {
    this.logger.warn('CyranoService: suggestion dropped', drop);
    this.nats.publish(NATS_TOPICS.CYRANO_SUGGESTION_DROPPED, { ...drop });
  }
}

// ## HANDOFF ─────────────────────────────────────────────────────────────────
// Cyrano Layer 1 is live: eight-category suggestion engine, tier-weighted
// selection, persona-tone copy, persistent session memory (creator_id,
// guest_id), latency SLO enforcement (<2s ideal, <4s hard cutoff with silent
// discard + audit event), and NATS whisper emission on
// CYRANO_SUGGESTION_EMITTED.
//
// All major creator-facing systems (ledger, gateguard, recovery, diamond
// concierge, ffs, creator-control, cyrano, integration hub) are now
// integrated.
//
// NEXT PRIORITY: Layer 2 — LLM-backed suggestion refinement + a Prisma-
// persisted memory store for restart-safety; plus full frontend polish on
// /creator/cyrano-panel and the pre-launch readiness checklist.
