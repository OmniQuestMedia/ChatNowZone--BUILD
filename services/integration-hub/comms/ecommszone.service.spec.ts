// INFRA: Phase 1 — eCommsZone Comms Service Tests
// rule_applied_id: INFRA_v1.0
//
// Tests the mandatory routing, PII_REFERENCE_ONLY invariant, HMAC signature
// verification, and webhook processing.

import { ECommsZoneService, CommsDispatchRecord } from './ecommszone.service';
import type {
  IECommsZoneClient,
  ECommsDispatchRequest,
  ECommsDispatchResult,
  ECommsWebhookEvent,
} from '../src/ecommszone/ecommszone-client.interface';
import { createHmac } from 'crypto';

// ── Stub client ───────────────────────────────────────────────────────────────

const makeStubClient = (
  overrides: Partial<IECommsZoneClient> = {},
): IECommsZoneClient => ({
  async dispatch(req: ECommsDispatchRequest): Promise<ECommsDispatchResult> {
    return {
      success: true,
      ecomms_message_id: `stub-${req.correlation_id}`,
      error_code: null,
      correlation_id: req.correlation_id,
    };
  },
  verifyWebhookSignature(): boolean {
    return true;
  },
  ...overrides,
});

const makeService = (client: IECommsZoneClient = makeStubClient()): ECommsZoneService =>
  new ECommsZoneService(client);

// ── Test fixtures ─────────────────────────────────────────────────────────────

const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000';
const WEBHOOK_SECRET = 'test-signing-secret-32-chars-long!!';

const validRequest = (): ECommsDispatchRequest => ({
  pii_vault_ref: VALID_UUID,
  template_id: 'WELCOME_EMAIL_v1',
  template_vars: { display_name: 'Creator1', platform: 'ChatNow.Zone' },
  intent: 'TRANSACTIONAL_EMAIL',
  correlation_id: 'corr-abc-123',
  reason_code: 'USER_ONBOARDING',
  dispatched_at_utc: new Date().toISOString(),
});

const makeWebhookEvent = (secret: string): ECommsWebhookEvent => {
  const ecomms_message_id = 'msg-abc-123';
  const occurred_at_utc = '2026-05-09T00:00:00Z';
  const hmac_signature = createHmac('sha256', secret)
    .update(`${ecomms_message_id}|${occurred_at_utc}`)
    .digest('hex');

  return {
    event: 'DELIVERED',
    ecomms_message_id,
    pii_vault_ref: VALID_UUID,
    template_id: 'WELCOME_EMAIL_v1',
    occurred_at_utc,
    hmac_signature,
  };
};

// ── Unit tests ────────────────────────────────────────────────────────────────

describe('ECommsZoneService — mandatory comms routing (INFRA_v1.0 §8.1)', () => {
  describe('dispatch()', () => {
    it('routes through the eCommsZone client and returns a dispatch record', async () => {
      const svc = makeService();
      const record = await svc.dispatch(validRequest());

      expect(record.success).toBe(true);
      expect(record.correlation_id).toBe('corr-abc-123');
      expect(record.intent).toBe('TRANSACTIONAL_EMAIL');
      expect(record.template_id).toBe('WELCOME_EMAIL_v1');
      expect(record.ecomms_message_id).toMatch(/^stub-/);
    });

    it('records the pii_vault_ref (opaque ref — not raw PII)', async () => {
      const svc = makeService();
      const record = await svc.dispatch(validRequest());
      // Stored as-is; downstream systems use the ref to resolve PII
      expect(record.pii_vault_ref).toBe(VALID_UUID);
    });

    it('surfaces client failures as failed dispatch records (does not throw)', async () => {
      const failingClient = makeStubClient({
        async dispatch(): Promise<ECommsDispatchResult> {
          throw new Error('network timeout');
        },
      });
      const svc = makeService(failingClient);
      const record = await svc.dispatch(validRequest());

      expect(record.success).toBe(false);
      expect(record.error_code).toBe('DISPATCH_EXCEPTION');
      expect(record.ecomms_message_id).toBeNull();
    });

    it('returns a failed record when client returns success=false', async () => {
      const failingClient = makeStubClient({
        async dispatch(req): Promise<ECommsDispatchResult> {
          return {
            success: false,
            ecomms_message_id: null,
            error_code: 'RATE_LIMITED',
            correlation_id: req.correlation_id,
          };
        },
      });
      const svc = makeService(failingClient);
      const record = await svc.dispatch(validRequest());

      expect(record.success).toBe(false);
      expect(record.error_code).toBe('RATE_LIMITED');
    });

    // PII_REFERENCE_ONLY invariant (INFRA_v1.0 §4.1)
    describe('PII_REFERENCE_ONLY guard', () => {
      it.each([
        ['raw email address', 'user@example.com'],
        ['phone number', '+14165551234'],
        ['name string', 'John Doe'],
        ['empty string', ''],
        ['partial UUID', '550e8400-e29b'],
        ['non-UUID-v4 UUID (wrong version digit)', '550e8400-e29b-31d4-a716-446655440000'],
      ])('throws HARD_STOP for %s as pii_vault_ref', async (_label, badRef) => {
        const svc = makeService();
        const req = { ...validRequest(), pii_vault_ref: badRef };
        await expect(svc.dispatch(req)).rejects.toThrow('HARD_STOP');
      });

      it('accepts a valid UUID v4 pii_vault_ref', async () => {
        const svc = makeService();
        await expect(svc.dispatch(validRequest())).resolves.toBeDefined();
      });
    });
  });

  describe('verifyWebhookSignature()', () => {
    it('returns true for a correctly signed webhook event', () => {
      const svc = makeService();
      const event = makeWebhookEvent(WEBHOOK_SECRET);
      expect(svc.verifyWebhookSignature(event, WEBHOOK_SECRET)).toBe(true);
    });

    it('returns false when the signature is wrong', () => {
      const svc = makeService();
      const event = makeWebhookEvent(WEBHOOK_SECRET);
      const tampered = { ...event, hmac_signature: 'deadbeef'.repeat(8) };
      expect(svc.verifyWebhookSignature(tampered, WEBHOOK_SECRET)).toBe(false);
    });

    it('returns false when the secret is different', () => {
      const svc = makeService();
      const event = makeWebhookEvent(WEBHOOK_SECRET);
      expect(svc.verifyWebhookSignature(event, 'wrong-secret')).toBe(false);
    });

    it('returns false for a malformed (odd-length hex) signature', () => {
      const svc = makeService();
      const event = { ...makeWebhookEvent(WEBHOOK_SECRET), hmac_signature: 'abc' };
      expect(svc.verifyWebhookSignature(event, WEBHOOK_SECRET)).toBe(false);
    });
  });

  describe('processWebhookEvent()', () => {
    it('returns verified:true + event for a valid signature', () => {
      const svc = makeService();
      const event = makeWebhookEvent(WEBHOOK_SECRET);
      const result = svc.processWebhookEvent(event, WEBHOOK_SECRET);
      expect(result.verified).toBe(true);
      expect(result.event.event).toBe('DELIVERED');
    });

    it('throws INVALID_WEBHOOK_SIGNATURE for a bad signature', () => {
      const svc = makeService();
      const event = { ...makeWebhookEvent(WEBHOOK_SECRET), hmac_signature: 'badhex01'.repeat(8) };
      expect(() => svc.processWebhookEvent(event, WEBHOOK_SECRET)).toThrow(
        'INVALID_WEBHOOK_SIGNATURE',
      );
    });
  });

  describe('RULE_APPLIED_ID', () => {
    it('is ECOMMSZONE_COMMS_v1', () => {
      expect(ECommsZoneService.RULE_APPLIED_ID).toBe('ECOMMSZONE_COMMS_v1');
    });
  });
});

describe('ECommsDispatchRecord shape', () => {
  it('contains all required fields per INFRA_v1.0 contract', async () => {
    const svc = makeService();
    const record: CommsDispatchRecord = await svc.dispatch(validRequest());

    // All fields must be present
    expect(typeof record.correlation_id).toBe('string');
    expect(typeof record.reason_code).toBe('string');
    expect(typeof record.intent).toBe('string');
    expect(typeof record.template_id).toBe('string');
    expect(typeof record.pii_vault_ref).toBe('string');
    expect(typeof record.dispatched_at_utc).toBe('string');
    expect(typeof record.success).toBe('boolean');
    // ecomms_message_id and error_code may be null
  });
});
