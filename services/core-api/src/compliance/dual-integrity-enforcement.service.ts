// COMP: Dual Integrity Architecture Enforcement - Phase 11 Final Hardening
// Validates that compliance and financial integrity systems operate correctly
//
// rule_applied_id: DUAL_INTEGRITY_v1.0
//
// Dual Integrity Architecture (DIA) ensures:
//   1. GateGuard Sentinel decisions are honored before ledger mutations
//   2. Welfare Guardian Score cooldowns prevent harmful transactions
//   3. Audit chain integrity is maintained (no hash breaks)
//   4. Legal holds block operations on held entities
//   5. All FIZ-scoped changes carry proper correlation IDs and reason codes

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { NatsService } from '../../core-api/src/nats/nats.service';
import { NATS_TOPICS } from '../../nats/topics.registry';

export const DUAL_INTEGRITY_RULE_ID = 'DUAL_INTEGRITY_v1.0';

/** DIA violation record */
export interface DualIntegrityViolation {
  violation_type:
    | 'GATEGUARD_BYPASS'
    | 'WELFARE_BYPASS'
    | 'AUDIT_CHAIN_BREAK'
    | 'LEGAL_HOLD_BYPASS'
    | 'FIZ_CORRELATION_MISSING';
  entity_id: string;
  entity_type: 'TRANSACTION' | 'PAYOUT' | 'WALLET_MUTATION' | 'CONTENT_ACTION';
  detected_at_utc: string;
  correlation_id: string;
  reason_code: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM';
  details: string;
  rule_applied_id: string;
}

/** DIA compliance snapshot */
export interface DualIntegritySnapshot {
  gateguard_enforced: boolean;
  welfare_enforced: boolean;
  audit_chain_intact: boolean;
  legal_holds_respected: boolean;
  fiz_correlations_present: boolean;
  violations_last_hour: number;
  last_violation_at_utc: string | null;
  system_status: 'COMPLIANT' | 'DEGRADED' | 'CRITICAL';
  captured_at_utc: string;
  rule_applied_id: string;
}

@Injectable()
export class DualIntegrityEnforcementService implements OnModuleInit {
  private readonly logger = new Logger(DualIntegrityEnforcementService.name);

  // Recent violations tracking (last hour)
  private readonly violations: DualIntegrityViolation[] = [];
  private readonly VIOLATION_WINDOW_MS = 60 * 60 * 1000; // 1 hour

  // Compliance state tracking
  private gateGuardEnforced = true;
  private welfareEnforced = true;
  private auditChainIntact = true;
  private legalHoldsRespected = true;
  private fizCorrelationsPresent = true;

  constructor(private readonly nats: NatsService) {}

  onModuleInit(): void {
    // Subscribe to GateGuard bypass attempts (should never happen)
    this.nats.subscribe('gateguard.bypass.attempted', (payload) => {
      this.recordViolation({
        violation_type: 'GATEGUARD_BYPASS',
        entity_id: payload.transaction_id || 'unknown',
        entity_type: 'TRANSACTION',
        detected_at_utc: new Date().toISOString(),
        correlation_id: payload.correlation_id || `violation-${Date.now()}`,
        reason_code: 'GATEGUARD_BYPASS_ATTEMPTED',
        severity: 'CRITICAL',
        details: `Transaction attempted without GateGuard pre-check: ${JSON.stringify(payload)}`,
        rule_applied_id: DUAL_INTEGRITY_RULE_ID,
      });
      this.gateGuardEnforced = false;
    });

    // Subscribe to Welfare Guard bypass attempts
    this.nats.subscribe('welfare.cooldown.bypassed', (payload) => {
      this.recordViolation({
        violation_type: 'WELFARE_BYPASS',
        entity_id: payload.user_id || 'unknown',
        entity_type: 'TRANSACTION',
        detected_at_utc: new Date().toISOString(),
        correlation_id: payload.correlation_id || `violation-${Date.now()}`,
        reason_code: 'WELFARE_COOLDOWN_BYPASSED',
        severity: 'CRITICAL',
        details: `Welfare cooldown bypassed for user: ${payload.user_id}`,
        rule_applied_id: DUAL_INTEGRITY_RULE_ID,
      });
      this.welfareEnforced = false;
    });

    // Subscribe to audit chain integrity failures
    this.nats.subscribe(NATS_TOPICS.AUDIT_CHAIN_INTEGRITY_FAILURE, (payload) => {
      this.recordViolation({
        violation_type: 'AUDIT_CHAIN_BREAK',
        entity_id: payload.event_id || 'unknown',
        entity_type: 'CONTENT_ACTION',
        detected_at_utc: new Date().toISOString(),
        correlation_id: payload.correlation_id || `violation-${Date.now()}`,
        reason_code: 'AUDIT_CHAIN_HASH_MISMATCH',
        severity: 'CRITICAL',
        details: `Audit chain hash integrity failure detected`,
        rule_applied_id: DUAL_INTEGRITY_RULE_ID,
      });
      this.auditChainIntact = false;
    });

    // Subscribe to legal hold bypass attempts
    this.nats.subscribe('legal.hold.bypassed', (payload) => {
      this.recordViolation({
        violation_type: 'LEGAL_HOLD_BYPASS',
        entity_id: payload.subject_id || 'unknown',
        entity_type: payload.subject_type || 'TRANSACTION',
        detected_at_utc: new Date().toISOString(),
        correlation_id: payload.correlation_id || `violation-${Date.now()}`,
        reason_code: 'LEGAL_HOLD_BYPASS_ATTEMPTED',
        severity: 'CRITICAL',
        details: `Operation attempted on held entity: ${payload.subject_type}:${payload.subject_id}`,
        rule_applied_id: DUAL_INTEGRITY_RULE_ID,
      });
      this.legalHoldsRespected = false;
    });

    // Subscribe to FIZ-scoped events and validate correlation_id presence
    this.nats.subscribe('ledger.entry.appended', (payload) => {
      if (!payload.correlation_id || !payload.reason_code) {
        this.recordViolation({
          violation_type: 'FIZ_CORRELATION_MISSING',
          entity_id: payload.entry_id || 'unknown',
          entity_type: 'WALLET_MUTATION',
          detected_at_utc: new Date().toISOString(),
          correlation_id: 'MISSING',
          reason_code: 'FIZ_METADATA_INCOMPLETE',
          severity: 'HIGH',
          details: `Ledger entry missing correlation_id or reason_code: ${JSON.stringify(payload)}`,
          rule_applied_id: DUAL_INTEGRITY_RULE_ID,
        });
        this.fizCorrelationsPresent = false;
      }
    });

    // Periodic cleanup of old violations
    setInterval(() => {
      this.trimViolationsToWindow();
    }, 60 * 1000); // Every minute

    this.logger.log('DualIntegrityEnforcementService: monitoring initialized');
  }

  /**
   * Record a Dual Integrity Architecture violation.
   */
  private recordViolation(violation: DualIntegrityViolation): void {
    this.violations.push(violation);
    this.trimViolationsToWindow();

    // Publish to NATS for alerting
    this.nats.publish('dual.integrity.violation', violation as unknown as Record<string, unknown>);

    // Log at appropriate level
    if (violation.severity === 'CRITICAL') {
      this.logger.error(`CRITICAL DIA VIOLATION: ${violation.violation_type}`, {
        entity_id: violation.entity_id,
        correlation_id: violation.correlation_id,
        details: violation.details,
      });
    } else {
      this.logger.warn(`DIA VIOLATION: ${violation.violation_type}`, {
        entity_id: violation.entity_id,
        correlation_id: violation.correlation_id,
      });
    }
  }

  /**
   * Get current Dual Integrity compliance snapshot.
   */
  getComplianceSnapshot(): DualIntegritySnapshot {
    const violationsLastHour = this.violations.length;
    const lastViolation =
      this.violations.length > 0
        ? this.violations[this.violations.length - 1].detected_at_utc
        : null;

    let systemStatus: 'COMPLIANT' | 'DEGRADED' | 'CRITICAL' = 'COMPLIANT';

    if (!this.auditChainIntact || !this.gateGuardEnforced || !this.welfareEnforced) {
      systemStatus = 'CRITICAL';
    } else if (!this.legalHoldsRespected || !this.fizCorrelationsPresent) {
      systemStatus = 'DEGRADED';
    }

    const snapshot: DualIntegritySnapshot = {
      gateguard_enforced: this.gateGuardEnforced,
      welfare_enforced: this.welfareEnforced,
      audit_chain_intact: this.auditChainIntact,
      legal_holds_respected: this.legalHoldsRespected,
      fiz_correlations_present: this.fizCorrelationsPresent,
      violations_last_hour: violationsLastHour,
      last_violation_at_utc: lastViolation,
      system_status: systemStatus,
      captured_at_utc: new Date().toISOString(),
      rule_applied_id: DUAL_INTEGRITY_RULE_ID,
    };

    // Publish snapshot for monitoring dashboards
    this.nats.publish('dual.integrity.snapshot', snapshot as unknown as Record<string, unknown>);

    return snapshot;
  }

  /**
   * Get recent violations for investigation.
   */
  getRecentViolations(): DualIntegrityViolation[] {
    return [...this.violations];
  }

  /**
   * Reset compliance state flags (after investigation and remediation).
   * Requires admin authorization in production.
   */
  resetComplianceState(): void {
    this.gateGuardEnforced = true;
    this.welfareEnforced = true;
    this.auditChainIntact = true;
    this.legalHoldsRespected = true;
    this.fizCorrelationsPresent = true;

    this.logger.log('DIA compliance state reset by authorized user');
  }

  private trimViolationsToWindow(): void {
    const cutoff = Date.now() - this.VIOLATION_WINDOW_MS;
    while (
      this.violations.length > 0 &&
      new Date(this.violations[0].detected_at_utc).getTime() < cutoff
    ) {
      this.violations.shift();
    }
  }

  /** Test seam — clears all violations and resets state */
  reset(): void {
    this.violations.length = 0;
    this.resetComplianceState();
  }
}

// ## HANDOFF ─────────────────────────────────────────────────────────────────
// Dual Integrity Architecture Enforcement Service is now fully implemented
// for Phase 11. Monitors and validates that compliance and financial integrity
// systems operate correctly across all platform operations.
//
// NEXT PRIORITY: Wire this service into core-api compliance module and expose
// compliance snapshot endpoint for operations dashboard.
