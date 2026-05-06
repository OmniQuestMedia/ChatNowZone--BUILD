// PAYLOAD 10 — Cyrano LLM Provider Abstraction (CYR-006).
//
// Cyrano Layer 2 (consumer audio platform) and the Layer 1 whisper copilot
// both delegate any model-backed refinement of suggestions through this
// interface. Concrete providers implement it (Anthropic Claude, on-prem,
// stub for tests). Switching providers must NOT touch business code.

export type LlmProviderName = 'anthropic-claude' | 'in-memory-stub';

export interface LlmRequestContext {
  /** Stable request id — flows into provider audit logs (no PII). */
  correlationId: string;
  /** Cyrano category (CAT_*) the request belongs to. */
  category: string;
  /** Heat tier at request time. */
  tier: 'COLD' | 'WARM' | 'HOT' | 'INFERNO';
  /** Optional persona metadata (tone / style hints). */
  personaTone?: string;
}

export interface LlmRefineRequest {
  context: LlmRequestContext;
  /** Base copy proposed by the deterministic Cyrano engine. */
  baseCopy: string;
  /** Compact session memory bundle — facts + arcs already extracted. */
  memorySummary?: string;
  /** Hard latency budget in milliseconds. */
  latencyBudgetMs: number;
}

export interface LlmRefineResponse {
  refinedCopy: string;
  providerName: LlmProviderName;
  /** Total elapsed milliseconds inside the provider call. */
  latencyMs: number;
  /** Token-count summary for billing audit. */
  promptTokens: number;
  completionTokens: number;
  /** True when the provider declined / timed out / returned the base copy. */
  fallback: boolean;
  ruleAppliedId: string;
}

/**
 * The contract every Cyrano L2 LLM provider must satisfy.
 *
 * Implementations MUST:
 *   • respect the latencyBudgetMs (return a fallback rather than block);
 *   • never log raw chat content;
 *   • emit no NATS topics on their own — the CyranoService owns emission;
 *   • be deterministic when an in-memory test seed is provided.
 */
export interface CyranoLlmProvider {
  readonly name: LlmProviderName;
  refine(req: LlmRefineRequest): Promise<LlmRefineResponse>;
}
