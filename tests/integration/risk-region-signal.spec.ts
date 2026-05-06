// tests/integration/risk-region-signal.spec.ts
// Risk Engine — Trusted Region Signal coverage. Verifies that the service
// is deterministic, emits a NATS audit event with correlation_id +
// rule_applied_id, and produces the canonical reason_code vocabulary.
import {
  RegionSignalService,
  REGION_SIGNAL_RULE_ID,
} from '../../services/risk-engine/src/region-signal.service';
import { NATS_TOPICS } from '../../services/nats/topics.registry';

class StubNats {
  public readonly published: Array<{ topic: string; payload: Record<string, unknown> }> = [];
  publish(topic: string, payload: Record<string, unknown>): void {
    this.published.push({ topic, payload });
  }
}

describe('RegionSignalService — deterministic risk scoring', () => {
  it('returns confidence 1.0 + reason_code TRUSTED when all signals align', () => {
    const nats = new StubNats();
    const svc = new RegionSignalService(nats as never);
    const result = svc.getConfidenceScore({
      ipCountry: 'CA',
      billingCountry: 'CA',
      binCountry: 'CA',
      isVpnDetected: false,
      correlationId: 'corr-trusted-001',
    });
    expect(result.confidence).toBe(1.0);
    expect(result.flags).toEqual([]);
    expect(result.reason_code).toBe('TRUSTED');
    expect(result.rule_applied_id).toBe(REGION_SIGNAL_RULE_ID);
    expect(result.correlation_id).toBe('corr-trusted-001');
  });

  it('emits a NATS event on every signal computation', () => {
    const nats = new StubNats();
    const svc = new RegionSignalService(nats as never);
    svc.getConfidenceScore({
      ipCountry: 'CA',
      billingCountry: 'US',
      binCountry: 'US',
      isVpnDetected: false,
      correlationId: 'corr-ip-mismatch',
    });
    expect(nats.published).toHaveLength(1);
    expect(nats.published[0].topic).toBe(NATS_TOPICS.RISK_REGION_SIGNAL_EMITTED);
    expect(nats.published[0].payload.correlation_id).toBe('corr-ip-mismatch');
    expect(nats.published[0].payload.reason_code).toBe('IP_LOCATION_MISMATCH');
    expect(nats.published[0].payload.rule_applied_id).toBe(REGION_SIGNAL_RULE_ID);
  });

  it('clamps confidence to [0, 1] and tags multiple flags MULTIPLE_RISK_FLAGS', () => {
    const svc = new RegionSignalService();
    const result = svc.getConfidenceScore({
      ipCountry: 'RU',
      billingCountry: 'CA',
      binCountry: 'US',
      isVpnDetected: true,
      correlationId: 'corr-multi',
    });
    expect(result.confidence).toBeGreaterThanOrEqual(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
    // 1 - 0.5 (VPN) - 0.3 (BIN/Billing) - 0.1 (IP/Billing) = 0.1
    expect(result.confidence).toBeCloseTo(0.1, 5);
    expect(result.flags).toEqual(
      expect.arrayContaining(['VPN_DETECTED', 'BIN_BILLING_MISMATCH', 'IP_LOCATION_MISMATCH']),
    );
    expect(result.reason_code).toBe('MULTIPLE_RISK_FLAGS');
  });

  it('is deterministic — same input → same output (no clocks, no randomness in result)', () => {
    const svc = new RegionSignalService();
    const input = {
      ipCountry: 'GB',
      billingCountry: 'GB',
      binCountry: 'GB',
      isVpnDetected: true,
      correlationId: 'corr-determinism',
    };
    const a = svc.getConfidenceScore(input);
    const b = svc.getConfidenceScore(input);
    // Spread to drop the readonly tuple identity.
    expect({ ...a, flags: [...a.flags] }).toEqual({ ...b, flags: [...b.flags] });
  });

  it('throws when correlationId is missing — GateGuard envelope is required', () => {
    const svc = new RegionSignalService();
    const baseInput = {
      ipCountry: 'CA',
      billingCountry: 'CA',
      binCountry: 'CA',
      isVpnDetected: false,
    };
    expect(() =>
      svc.getConfidenceScore({ ...baseInput, correlationId: undefined as unknown as string }),
    ).toThrow(/correlationId is required/);
    expect(() => svc.getConfidenceScore({ ...baseInput, correlationId: '   ' })).toThrow(
      /correlationId is required/,
    );
  });
});
