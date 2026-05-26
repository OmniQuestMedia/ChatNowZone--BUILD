// PAYLOAD 10 — Risk Engine (D002) types.
// Service: services/risk-engine/. Append-only audit on risk_engine_decisions.
// Wire authority: RISK_ENGINE_v1.

export const RISK_ENGINE_RULE_ID = 'RISK_ENGINE_v1';

/** Coarse business intent the evaluator was invoked for. */
export type RiskIntent = 'PURCHASE' | 'SPEND' | 'DIAMOND_INTAKE' | 'EXTENSION' | 'RECOVERY';

/** Final tier — drives downstream UX and step-up requirements. */
export type RiskTier = 'GREEN' | 'AMBER' | 'RED' | 'CRITICAL';

/** Final disposition — drives the downstream gate. */
export type RiskDecision = 'PASS' | 'REVIEW' | 'BLOCK' | 'ESCALATE';

/** Region-signal slice — sourced from RegionSignalService. */
export interface RegionSignals {
  ipCountry: string;
  billingCountry: string;
  binCountry: string;
  isVpnDetected: boolean;
}

/** Behavioural slice — captured from the wallet / chat / spend timeline. */
export interface BehaviouralSignals {
  spendVelocity24hUsd: number; // recent spend velocity
  prevDisputeCount: number; // historical dispute count
  failedAuthCount24h: number; // failed payment auths last 24h
  accountTenureDays: number; // age of the account
  silenceSecondsInSession: number; // 0 if not in a session
  highHeatBurstFlag: boolean; // FFS spike + tip burst
}

/**
 * Diamond Concierge intake slice (DIA-003 / DIA-004). Only populated when
 * the agent is recording a Diamond Concierge call. All flags are heuristic
 * — the agent has the authoritative read; the engine surfaces the bundle for
 * the audit trail.
 */
export interface DiamondConciergeSignals {
  intoxicationFlag: boolean;
  belligerenceFlag: boolean;
  coercionFlag: boolean;
  duressFlag: boolean;
  agentId?: string;
  /**
   * Auto-populated bundle (DIA-004). Persisted on the RiskAssessment row as
   * account_signal_snapshot. Shape is flexible — the engine treats it as
   * pass-through metadata.
   */
  accountSignalSnapshot?: Record<string, unknown>;
}

/** Composite input envelope. */
export interface RiskEvaluationInput {
  correlationId: string;
  intent: RiskIntent;
  subjectUserId: string;
  amountTokens?: number;
  amountUsdCents?: bigint;
  region?: RegionSignals;
  behavioural?: BehaviouralSignals;
  diamond?: DiamondConciergeSignals;
}

/** Per-signal contribution to the composite score. */
export interface SignalBreakdown {
  region: number;
  behavioural: number;
  diamond: number;
  /** Raw contributions for debug — not persisted to risk_engine_decisions. */
  contributions: Record<string, number>;
}

/** Result envelope returned to callers (Hub, GateGuard, Diamond Concierge). */
export interface RiskEvaluationResult {
  id: string | null; // null when persistence is skipped
  correlationId: string;
  compositeScore: number; // 0..100
  tier: RiskTier;
  decision: RiskDecision;
  reasonCodes: readonly string[]; // ≤5
  signalBreakdown: SignalBreakdown;
  ruleAppliedId: string;
  evaluatedAtUtc: string;
}

/** Tier thresholds — mirrored against welfare-guardian.scorer for parity. */
export const RISK_TIER_THRESHOLDS = {
  GREEN_MAX: 29,
  AMBER_MAX: 59,
  RED_MAX: 84,
  // 85..100 = CRITICAL
} as const;
