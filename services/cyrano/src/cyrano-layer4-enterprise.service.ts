// PAYLOAD 5+ — Cyrano Layer 4 (enterprise multi-tenant API) stub
// Phase 3.11 — Layer 4 exposes domain-specific Cyrano flows to enterprise
// tenants (teaching, coaching, first-responder, factory-safety, medical).
// Tenants resolve to a domain at sign-up; every prompt request is routed
// through the shared template engine + persona manager.
//
// Implementation status: STUB. The real Layer 4 carries tenant credentials,
// per-tenant rate limits, and SLA contracts. This scaffolding is the shape
// downstream services depend on.

import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { resolvePromptTemplate, type CyranoTier } from './cyrano-prompt-templates';
import type { CyranoCategory, CyranoDomain } from './cyrano.types';

export const CYRANO_LAYER4_RULE_ID = 'CYRANO_LAYER_4_ENTERPRISE_v1';

export interface EnterpriseTenant {
  tenant_id: string;
  display_name: string;
  domain: CyranoDomain;
  /** ISO-3166 country code for residency-aware routing. */
  country_code: string;
  /** Whether the tenant has signed the BAA / equivalent. */
  baa_signed: boolean;
}

export interface EnterprisePromptRequest {
  tenant_id: string;
  session_id: string;
  category: CyranoCategory;
  tier: CyranoTier;
  /** Persona tone override (e.g. "warm_clinical"). */
  tone?: string;
}

export interface EnterprisePromptResponse {
  request_id: string;
  tenant_id: string;
  domain: CyranoDomain;
  category: CyranoCategory;
  tier: CyranoTier;
  copy: string;
  blocked?: boolean;
  reason_code?: string;
  rule_applied_id: string;
}

@Injectable()
export class CyranoLayer4EnterpriseService {
  private readonly logger = new Logger(CyranoLayer4EnterpriseService.name);
  private readonly tenants = new Map<string, EnterpriseTenant>();

  registerTenant(tenant: EnterpriseTenant): void {
    this.tenants.set(tenant.tenant_id, tenant);
    this.logger.log('CyranoLayer4EnterpriseService: tenant registered', {
      tenant_id: tenant.tenant_id,
      domain: tenant.domain,
    });
  }

  getTenant(tenant_id: string): EnterpriseTenant | undefined {
    return this.tenants.get(tenant_id);
  }

  /**
   * Resolve a prompt for a tenant + category + tier. Returns a blocked
   * response when:
   *   • the tenant is unknown,
   *   • the BAA has not been signed (HIPAA-bearing tenants only),
   *   • the (category, domain) is not defined in the template engine.
   */
  resolvePrompt(req: EnterprisePromptRequest): EnterprisePromptResponse {
    const tenant = this.tenants.get(req.tenant_id);
    if (!tenant) {
      return this.blocked(req, 'TENANT_NOT_FOUND', 'ADULT_ENTERTAINMENT');
    }
    if (tenant.domain === 'MEDICAL' && !tenant.baa_signed) {
      return this.blocked(req, 'BAA_NOT_SIGNED', tenant.domain);
    }

    const template = resolvePromptTemplate({
      category: req.category,
      domain: tenant.domain,
      tier: req.tier,
    });
    if (!template) {
      return this.blocked(req, 'TEMPLATE_UNAVAILABLE', tenant.domain);
    }

    const copy = template({ tone: req.tone ?? 'enterprise_neutral', tier: req.tier });
    return {
      request_id: randomUUID(),
      tenant_id: tenant.tenant_id,
      domain: tenant.domain,
      category: req.category,
      tier: req.tier,
      copy,
      rule_applied_id: CYRANO_LAYER4_RULE_ID,
    };
  }

  private blocked(
    req: EnterprisePromptRequest,
    reason_code: string,
    domain: CyranoDomain,
  ): EnterprisePromptResponse {
    return {
      request_id: randomUUID(),
      tenant_id: req.tenant_id,
      domain,
      category: req.category,
      tier: req.tier,
      copy: '',
      blocked: true,
      reason_code,
      rule_applied_id: CYRANO_LAYER4_RULE_ID,
    };
  }
}
