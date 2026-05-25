// UI: Centralized Synthetic Feature Toggle Engine - Phase 11
// Runtime feature flag management without re-deploy
//
// rule_applied_id: SYNTHETIC_TOGGLES_v1.0
//
// Supports:
//   • Per-creator/studio/region toggles
//   • Runtime enable/disable (no re-deploy)
//   • Gradual rollout (percentage-based)
//   • A/B testing support
//   • Audit trail for all toggle changes

import { Injectable, Logger } from '@nestjs/common';
import { NatsService } from '../../core-api/src/nats/nats.service';

export const SYNTHETIC_TOGGLES_RULE_ID = 'SYNTHETIC_TOGGLES_v1.0';

/** Feature toggle scope granularity */
export type ToggleScope = 'GLOBAL' | 'CREATOR' | 'STUDIO' | 'REGION';

/** Toggle state */
export type ToggleState = 'ENABLED' | 'DISABLED' | 'ROLLOUT' | 'A_B_TEST';

/** Feature identifiers */
export type SyntheticFeature =
  | 'SAFE_SYNTHETIC_TWIN'
  | 'CYRANO_WHISPER'
  | 'OMNISYNC_TELEMETRY'
  | 'WELFARE_WATCH'
  | 'GATEGUARD_SENTINEL'
  | 'STUDIO_TOKENS'
  | 'VOICE_SYNTHESIS'
  | 'VIDEO_SYNTHESIS'
  | 'MEMORY_RAG';

/** Feature toggle configuration */
export interface FeatureToggleConfig {
  feature: SyntheticFeature;
  state: ToggleState;
  scope: ToggleScope;
  scope_id?: string; // creator_id, studio_id, or region code
  rollout_percentage?: number; // 0-100, used when state='ROLLOUT'
  ab_test_variant?: 'A' | 'B'; // used when state='A_B_TEST'
  enabled_at?: string;
  updated_at: string;
  updated_by: string; // admin user ID or 'SYSTEM'
  reason: string;
  rule_applied_id: string;
}

/** Toggle change audit record */
export interface ToggleChangeAudit {
  toggle_id: string;
  feature: SyntheticFeature;
  previous_state: ToggleState;
  new_state: ToggleState;
  scope: ToggleScope;
  scope_id?: string;
  changed_at_utc: string;
  changed_by: string;
  reason: string;
  correlation_id: string;
  rule_applied_id: string;
}

/** Feature availability check result */
export interface FeatureAvailability {
  feature: SyntheticFeature;
  available: boolean;
  reason: string;
  variant?: 'A' | 'B'; // for A/B tests
  rule_applied_id: string;
}

@Injectable()
export class SyntheticFeatureToggleService {
  private readonly logger = new Logger(SyntheticFeatureToggleService.name);

  // In-memory toggle registry (in production, sync with DB/Redis)
  private readonly toggles = new Map<string, FeatureToggleConfig>();

  // Rollout hash determinism cache (creator_id -> hash bucket 0-99)
  private readonly hashBuckets = new Map<string, number>();

  constructor(private readonly nats: NatsService) {
    this.initializeDefaults();
  }

  /**
   * Initialize default toggle states for Phase 11 go-live.
   */
  private initializeDefaults(): void {
    const defaults: Array<{ feature: SyntheticFeature; state: ToggleState }> = [
      { feature: 'SAFE_SYNTHETIC_TWIN', state: 'ENABLED' },
      { feature: 'CYRANO_WHISPER', state: 'ENABLED' },
      { feature: 'OMNISYNC_TELEMETRY', state: 'ENABLED' },
      { feature: 'WELFARE_WATCH', state: 'ENABLED' },
      { feature: 'GATEGUARD_SENTINEL', state: 'ENABLED' },
      { feature: 'STUDIO_TOKENS', state: 'ROLLOUT' }, // 50% rollout
      { feature: 'VOICE_SYNTHESIS', state: 'ENABLED' },
      { feature: 'VIDEO_SYNTHESIS', state: 'DISABLED' }, // Not ready yet
      { feature: 'MEMORY_RAG', state: 'ENABLED' },
    ];

    for (const { feature, state } of defaults) {
      this.setToggle({
        feature,
        state,
        scope: 'GLOBAL',
        rollout_percentage: state === 'ROLLOUT' ? 50 : undefined,
        updated_at: new Date().toISOString(),
        updated_by: 'SYSTEM',
        reason: 'Phase 11 default initialization',
        rule_applied_id: SYNTHETIC_TOGGLES_RULE_ID,
      });
    }

    this.logger.log('SyntheticFeatureToggleService: defaults initialized');
  }

  /**
   * Check if a feature is available for a given scope/entity.
   */
  isFeatureAvailable(args: {
    feature: SyntheticFeature;
    creator_id?: string;
    studio_id?: string;
    region?: string;
  }): FeatureAvailability {
    // Check scope hierarchy: CREATOR > STUDIO > REGION > GLOBAL
    const creatorToggle = args.creator_id
      ? this.toggles.get(`${args.feature}:CREATOR:${args.creator_id}`)
      : undefined;

    const studioToggle = args.studio_id
      ? this.toggles.get(`${args.feature}:STUDIO:${args.studio_id}`)
      : undefined;

    const regionToggle = args.region
      ? this.toggles.get(`${args.feature}:REGION:${args.region}`)
      : undefined;

    const globalToggle = this.toggles.get(`${args.feature}:GLOBAL`);

    const effectiveToggle = creatorToggle || studioToggle || regionToggle || globalToggle;

    if (!effectiveToggle) {
      return {
        feature: args.feature,
        available: false,
        reason: 'NO_TOGGLE_CONFIGURED',
        rule_applied_id: SYNTHETIC_TOGGLES_RULE_ID,
      };
    }

    switch (effectiveToggle.state) {
      case 'ENABLED':
        return {
          feature: args.feature,
          available: true,
          reason: 'TOGGLE_ENABLED',
          rule_applied_id: SYNTHETIC_TOGGLES_RULE_ID,
        };

      case 'DISABLED':
        return {
          feature: args.feature,
          available: false,
          reason: 'TOGGLE_DISABLED',
          rule_applied_id: SYNTHETIC_TOGGLES_RULE_ID,
        };

      case 'ROLLOUT': {
        const rolloutPercentage = effectiveToggle.rollout_percentage ?? 0;
        const hashBucket = this.getHashBucket(
          args.creator_id || args.studio_id || args.region || 'unknown',
        );
        const available = hashBucket < rolloutPercentage;
        return {
          feature: args.feature,
          available,
          reason: available
            ? `ROLLOUT_INCLUDED (${rolloutPercentage}%)`
            : `ROLLOUT_EXCLUDED (${rolloutPercentage}%)`,
          rule_applied_id: SYNTHETIC_TOGGLES_RULE_ID,
        };
      }

      case 'A_B_TEST': {
        const variant = this.getAbTestVariant(
          args.creator_id || args.studio_id || args.region || 'unknown',
        );
        const available = variant === effectiveToggle.ab_test_variant;
        return {
          feature: args.feature,
          available,
          reason: `A_B_TEST_VARIANT_${variant}`,
          variant,
          rule_applied_id: SYNTHETIC_TOGGLES_RULE_ID,
        };
      }

      default:
        return {
          feature: args.feature,
          available: false,
          reason: 'INVALID_TOGGLE_STATE',
          rule_applied_id: SYNTHETIC_TOGGLES_RULE_ID,
        };
    }
  }

  /**
   * Set or update a feature toggle.
   */
  setToggle(config: FeatureToggleConfig): void {
    const toggleId = this.buildToggleId(config.feature, config.scope, config.scope_id);
    const previousToggle = this.toggles.get(toggleId);

    this.toggles.set(toggleId, config);

    // Emit audit trail event
    const audit: ToggleChangeAudit = {
      toggle_id: toggleId,
      feature: config.feature,
      previous_state: previousToggle?.state || 'DISABLED',
      new_state: config.state,
      scope: config.scope,
      scope_id: config.scope_id,
      changed_at_utc: new Date().toISOString(),
      changed_by: config.updated_by,
      reason: config.reason,
      correlation_id: `toggle-${Date.now()}`,
      rule_applied_id: SYNTHETIC_TOGGLES_RULE_ID,
    };

    this.nats.publish('synthetic.toggle.changed', audit as unknown as Record<string, unknown>);

    this.logger.log(`Toggle updated: ${toggleId} -> ${config.state}`, {
      feature: config.feature,
      state: config.state,
      scope: config.scope,
      updated_by: config.updated_by,
    });
  }

  /**
   * Get all toggles for a specific feature.
   */
  getTogglesForFeature(feature: SyntheticFeature): FeatureToggleConfig[] {
    const toggles: FeatureToggleConfig[] = [];
    for (const [key, toggle] of this.toggles.entries()) {
      if (key.startsWith(`${feature}:`)) {
        toggles.push(toggle);
      }
    }
    return toggles;
  }

  /**
   * Get all active toggles across all features.
   */
  getAllToggles(): FeatureToggleConfig[] {
    return Array.from(this.toggles.values());
  }

  /**
   * Delete a toggle (revert to hierarchy default).
   */
  deleteToggle(feature: SyntheticFeature, scope: ToggleScope, scope_id?: string): boolean {
    const toggleId = this.buildToggleId(feature, scope, scope_id);
    const deleted = this.toggles.delete(toggleId);

    if (deleted) {
      this.nats.publish('synthetic.toggle.deleted', {
        toggle_id: toggleId,
        feature,
        scope,
        scope_id,
        deleted_at_utc: new Date().toISOString(),
        rule_applied_id: SYNTHETIC_TOGGLES_RULE_ID,
      } as unknown as Record<string, unknown>);

      this.logger.log(`Toggle deleted: ${toggleId}`);
    }

    return deleted;
  }

  /**
   * Deterministic hash bucket assignment (0-99) for gradual rollout.
   */
  private getHashBucket(identifier: string): number {
    if (this.hashBuckets.has(identifier)) {
      return this.hashBuckets.get(identifier)!;
    }

    // Simple hash function for demo (use crypto in production)
    let hash = 0;
    for (let i = 0; i < identifier.length; i++) {
      hash = (hash << 5) - hash + identifier.charCodeAt(i);
      hash = hash & hash; // Convert to 32bit integer
    }

    const bucket = Math.abs(hash) % 100;
    this.hashBuckets.set(identifier, bucket);
    return bucket;
  }

  /**
   * Deterministic A/B test variant assignment.
   */
  private getAbTestVariant(identifier: string): 'A' | 'B' {
    const bucket = this.getHashBucket(identifier);
    return bucket < 50 ? 'A' : 'B';
  }

  /**
   * Build toggle ID key.
   */
  private buildToggleId(feature: SyntheticFeature, scope: ToggleScope, scope_id?: string): string {
    return scope_id ? `${feature}:${scope}:${scope_id}` : `${feature}:${scope}`;
  }

  /** Test seam — clears all toggles and re-initializes defaults */
  reset(): void {
    this.toggles.clear();
    this.hashBuckets.clear();
    this.initializeDefaults();
  }
}

// ## HANDOFF ─────────────────────────────────────────────────────────────────
// Synthetic Feature Toggle Engine is now fully implemented for Phase 11.
// Supports runtime feature flags, gradual rollouts, A/B testing, and audit trails.
//
// NEXT PRIORITY: Wire this service into creator-control.module.ts and create
// admin API endpoints for toggle management (/admin/toggles).
