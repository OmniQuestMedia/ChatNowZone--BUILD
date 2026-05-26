// PAYLOAD 10 — Cyrano LLM Provider — In-memory deterministic stub.
//
// Used by tests, CI, and offline development. Production wiring swaps in the
// Anthropic Claude provider when CYR-006 lands the API client. The stub is
// fully deterministic — same inputs always produce the same refinedCopy.

import { Injectable } from '@nestjs/common';
import {
  type CyranoLlmProvider,
  type LlmProviderName,
  type LlmRefineRequest,
  type LlmRefineResponse,
} from './llm-provider.interface';

const RULE_APPLIED_ID = 'CYRANO_LLM_PROVIDER_v1';

@Injectable()
export class InMemoryCyranoLlmProvider implements CyranoLlmProvider {
  public readonly name: LlmProviderName = 'in-memory-stub';

  async refine(req: LlmRefineRequest): Promise<LlmRefineResponse> {
    const start = Date.now();
    // Deterministic transformation — append tier + persona tone hints without
    // any external dependency. Production providers swap this for a model call.
    const tone = req.context.personaTone ? `[${req.context.personaTone}] ` : '';
    const memoryHint = req.memorySummary ? ` (recall: ${req.memorySummary.slice(0, 80)})` : '';
    const refined = `${tone}${req.baseCopy}${memoryHint}`.slice(0, 280);
    const elapsed = Date.now() - start;
    return {
      refinedCopy: refined,
      providerName: this.name,
      latencyMs: elapsed,
      promptTokens: Math.ceil(req.baseCopy.length / 4),
      completionTokens: Math.ceil(refined.length / 4),
      fallback: false,
      ruleAppliedId: RULE_APPLIED_ID,
    };
  }
}
