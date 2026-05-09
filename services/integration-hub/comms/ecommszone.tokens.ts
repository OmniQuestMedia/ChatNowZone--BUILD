// INFRA: Phase 1 — eCommsZone DI token constants
// rule_applied_id: INFRA_v1.0
//
// Centralize injection tokens to avoid circular-import issues and keep
// the module boundary clean.

/** NestJS injection token for the IECommsZoneClient implementation. */
export const ECOMMSZONE_CLIENT = 'ECOMMSZONE_CLIENT';

/** NestJS injection token for the WEBHOOK_SIGNING_SECRET string. */
export const ECOMMSZONE_WEBHOOK_SECRET = 'ECOMMSZONE_WEBHOOK_SIGNING_SECRET';
