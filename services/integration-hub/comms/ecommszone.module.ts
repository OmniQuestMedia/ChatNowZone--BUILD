// INFRA: Phase 1 — eCommsZone NestJS Module
// rule_applied_id: INFRA_v1.0
// Authority: OmniQuest Media Inc. — OQMInc Engineering Team
//
// §8.1 — Mandatory routing: wires IECommsZoneClient into the NestJS DI
// container. The concrete client (ECommsZoneClientNoop for dev/test, future
// ECommsZoneClientImpl for production) is swapped via the ECOMMSZONE_CLIENT
// injection token without changing call-sites.
//
// When the eCommsZone npm SDK is published:
//   1. Import ECommsZoneClientImpl from the SDK
//   2. Replace ECommsZoneClientNoop with ECommsZoneClientImpl below
//   3. Update INTEGRATION_AUDIT.md — ECZ-GAP-001 resolved
//
// Commit: INFRA: ECommsModule wired (mandatory routing) [rule_applied_id: INFRA_v1.0]

import { Module } from '@nestjs/common';
import { ECommsZoneService } from './ecommszone.service';
import { ECommsZoneWebhookController } from './ecommszone.controller';
import { ECOMMSZONE_CLIENT, ECOMMSZONE_WEBHOOK_SECRET } from './ecommszone.tokens';
import { ECommsZoneClientNoop } from '../src/ecommszone/ecommszone-client.interface';

@Module({
  controllers: [ECommsZoneWebhookController],
  providers: [
    ECommsZoneService,
    {
      // Inject IECommsZoneClient implementation.
      // Production: replace ECommsZoneClientNoop with ECommsZoneClientImpl
      // once the partner SDK is published (ECZ-GAP-001).
      provide: ECOMMSZONE_CLIENT,
      useClass: ECommsZoneClientNoop,
    },
    {
      // WEBHOOK_SIGNING_SECRET is injected at runtime from AWS Secrets Manager.
      // In dev/test NODE_ENV, falls back to a placeholder — production
      // MUST override via ECS task definition environment (INFRA_v1.0 §7).
      provide: ECOMMSZONE_WEBHOOK_SECRET,
      useFactory: (): string => {
        const secret = process.env['ECOMMSZONE_WEBHOOK_SIGNING_SECRET'];
        if (process.env.NODE_ENV === 'production' && !secret) {
          throw new Error(
            'HARD_STOP: ECOMMSZONE_WEBHOOK_SIGNING_SECRET must be set in production ' +
              '(injected from AWS Secrets Manager — INFRA_v1.0 §7)',
          );
        }
        return secret ?? 'dev-placeholder-not-for-production';
      },
    },
  ],
  exports: [ECommsZoneService],
})
export class ECommsModule {}
