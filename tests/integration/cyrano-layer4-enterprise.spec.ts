/**
 * cyrano-layer4-enterprise.spec.ts
 * Phase 3.11 — multi-tenant enterprise API stub.
 *
 * Refreshed for the Layer-4 collaborator graph (tenant store, rate limiter,
 * audit service, voice bridge). The legacy `svc.registerTenant(...)` path
 * has moved to `CyranoLayer4TenantStore.upsertTenant(...)`.
 */
import { CyranoLayer4EnterpriseService } from '../../services/cyrano/src/cyrano-layer4-enterprise.service';
import { CyranoLayer4AuditService } from '../../services/cyrano/src/cyrano-layer4-audit.service';
import { CyranoLayer4RateLimiterService } from '../../services/cyrano/src/cyrano-layer4-rate-limiter.service';
import { CyranoLayer4TenantStore } from '../../services/cyrano/src/cyrano-layer4-tenant.store';
import { CyranoLayer4VoiceBridge } from '../../services/cyrano/src/cyrano-layer4-voice.bridge';
import type { NatsService } from '../../services/core-api/src/nats/nats.service';

class StubNats {
  public readonly published: Array<{ topic: string; payload: Record<string, unknown> }> = [];
  publish(topic: string, payload: Record<string, unknown>): void {
    this.published.push({ topic, payload });
  }
  subscribe(): void {
    /* no-op */
  }
}

function buildService(): {
  svc: CyranoLayer4EnterpriseService;
  tenantStore: CyranoLayer4TenantStore;
  nats: StubNats;
} {
  const nats = new StubNats();
  const natsTyped = nats as unknown as NatsService;
  const tenantStore = new CyranoLayer4TenantStore(natsTyped);
  const rateLimiter = new CyranoLayer4RateLimiterService(natsTyped);
  const audit = new CyranoLayer4AuditService(natsTyped);
  const voice = new CyranoLayer4VoiceBridge(natsTyped);
  const svc = new CyranoLayer4EnterpriseService(natsTyped, tenantStore, rateLimiter, audit, voice);
  return { svc, tenantStore, nats };
}

describe('CyranoLayer4EnterpriseService', () => {
  it('blocks unknown tenants', () => {
    const { svc } = buildService();
    const out = svc.resolvePrompt({
      tenant_id: 'unknown',
      session_id: 'sess-1',
      category: 'CAT_SESSION_OPEN',
      tier: 'COLD',
    });
    expect(out.blocked).toBe(true);
    expect(out.reason_code).toBe('TENANT_NOT_FOUND');
  });

  it('blocks medical tenants without a signed BAA', () => {
    const { svc, tenantStore } = buildService();
    tenantStore.upsertTenant({
      tenant_id: 'med-1',
      display_name: 'Acme Health',
      domain: 'MEDICAL',
      country_code: 'CA',
      baa_signed: false,
      compliance_regime: 'HIPAA',
    });
    const out = svc.resolvePrompt({
      tenant_id: 'med-1',
      session_id: 'sess-1',
      category: 'CAT_SESSION_OPEN',
      tier: 'COLD',
      consent_receipt_id: 'rcpt-stub',
    });
    expect(out.blocked).toBe(true);
    expect(out.reason_code).toBe('BAA_NOT_SIGNED');
  });

  it('returns a domain-appropriate template for a registered teaching tenant', () => {
    const { svc, tenantStore } = buildService();
    tenantStore.upsertTenant({
      tenant_id: 'edu-1',
      display_name: 'Acme U',
      domain: 'TEACHING',
      country_code: 'CA',
      baa_signed: true,
    });
    const out = svc.resolvePrompt({
      tenant_id: 'edu-1',
      session_id: 'sess-1',
      category: 'CAT_SESSION_OPEN',
      tier: 'COLD',
    });
    expect(out.blocked).toBe(false);
    expect(out.copy).toMatch(/learning objective/i);
  });
});
