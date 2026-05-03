// services/risk-engine/src/region-signal.service.ts
// Risk Engine — Trusted Region Signal.
//
// Doctrine:
//   - Deterministic. Same inputs → same output. No clocks, no randomness.
//   - GateGuard pre-processed. Callers MUST go through the GateGuard
//     middleware before invoking this service so the request envelope
//     already carries correlation_id + reason_code.
//   - NATS-driven. Every emission publishes RISK_REGION_SIGNAL_EMITTED so
//     the immutable audit chain can replay the decision.
//   - No PII logged. Country codes only — never raw IPs, BINs, etc.
import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { NatsService } from '../../core-api/src/nats/nats.service';
import { NATS_TOPICS } from '../../nats/topics.registry';

export const REGION_SIGNAL_RULE_ID = 'RISK_REGION_SIGNAL_v1';

/** Penalty weights — tuned to keep 0 ≤ score ≤ 1 for any input combination. */
export const REGION_SIGNAL_PENALTIES = Object.freeze({
  VPN_DETECTED: 0.5,
  BIN_BILLING_MISMATCH: 0.3,
  IP_LOCATION_MISMATCH: 0.1,
});

export interface RegionSignalInput {
  ipCountry: string;
  billingCountry: string;
  binCountry: string;
  isVpnDetected: boolean;
  /** Forwarded from GateGuard envelope; defaults to a deterministic sentinel. */
  correlationId?: string;
}

export type RegionSignalReasonCode =
  | 'TRUSTED'
  | 'IP_LOCATION_MISMATCH'
  | 'BIN_BILLING_MISMATCH'
  | 'VPN_DETECTED'
  | 'MULTIPLE_RISK_FLAGS';

export interface RegionSignalResult {
  confidence: number;
  region: string;
  vpnRisk: boolean;
  flags: readonly string[];
  reason_code: RegionSignalReasonCode;
  correlation_id: string;
  rule_applied_id: string;
}

@Injectable()
export class RegionSignalService {
  private readonly logger = new Logger(RegionSignalService.name);

  constructor(@Optional() @Inject(NatsService) private readonly nats?: NatsService) {}

  /**
   * Generate a Trusted Region Signal by comparing Payment BIN, Billing
   * Country, and IP Geolocation. The BIN country is the "anchor of trust".
   */
  getConfidenceScore(data: RegionSignalInput): RegionSignalResult {
    const correlation_id = data.correlationId ?? 'risk-region-signal-no-correlation';
    const flags: string[] = [];
    let score = 1.0;

    if (data.isVpnDetected) {
      score -= REGION_SIGNAL_PENALTIES.VPN_DETECTED;
      flags.push('VPN_DETECTED');
    }
    if (data.binCountry !== data.billingCountry) {
      score -= REGION_SIGNAL_PENALTIES.BIN_BILLING_MISMATCH;
      flags.push('BIN_BILLING_MISMATCH');
    }
    if (data.ipCountry !== data.billingCountry) {
      score -= REGION_SIGNAL_PENALTIES.IP_LOCATION_MISMATCH;
      flags.push('IP_LOCATION_MISMATCH');
    }

    const confidence = Math.max(0, Math.min(1, score));
    const reason_code = this.deriveReasonCode(flags);

    const result: RegionSignalResult = {
      confidence,
      region: data.binCountry,
      vpnRisk: data.isVpnDetected,
      flags: Object.freeze([...flags]),
      reason_code,
      correlation_id,
      rule_applied_id: REGION_SIGNAL_RULE_ID,
    };

    // No PII — country codes are coarse-grained signals only.
    this.logger.log('RegionSignalService: signal computed', {
      confidence,
      region: result.region,
      vpnRisk: result.vpnRisk,
      flags: result.flags,
      reason_code,
      correlation_id,
      rule_applied_id: REGION_SIGNAL_RULE_ID,
    });

    if (this.nats) {
      this.nats.publish(NATS_TOPICS.RISK_REGION_SIGNAL_EMITTED, {
        confidence,
        region: result.region,
        vpn_risk: result.vpnRisk,
        flags: [...result.flags],
        reason_code,
        correlation_id,
        rule_applied_id: REGION_SIGNAL_RULE_ID,
        emitted_at_utc: new Date().toISOString(),
      });
    }

    return result;
  }

  private deriveReasonCode(flags: readonly string[]): RegionSignalReasonCode {
    if (flags.length === 0) return 'TRUSTED';
    if (flags.length > 1) return 'MULTIPLE_RISK_FLAGS';
    return flags[0] as RegionSignalReasonCode;
  }
}
