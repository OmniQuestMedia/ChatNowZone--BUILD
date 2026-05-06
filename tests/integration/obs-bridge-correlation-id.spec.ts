// tests/integration/obs-bridge-correlation-id.spec.ts
// OBS Bridge — verifies that every NATS event carries correlation_id and
// reason_code so the immutable audit chain can pair start/stop transitions.
import { OBSBridgeService } from '../../services/obs-bridge/src/obs-bridge.service';
import { NATS_TOPICS } from '../../services/nats/topics.registry';

class StubNats {
  public readonly published: Array<{ topic: string; payload: Record<string, unknown> }> = [];
  publish(topic: string, payload: Record<string, unknown>): void {
    this.published.push({ topic, payload });
  }
}

interface Creator {
  id: string;
  stream_key_hash: string | null;
}

class StubPrisma {
  public creators: Creator[] = [];
  creator = {
    findUnique: async ({ where }: { where: { id: string } }) =>
      this.creators.find((c) => c.id === where.id) ?? null,
    update: async ({
      where,
      data,
    }: {
      where: { id: string };
      data: { stream_key_hash: string };
    }) => {
      const c = this.creators.find((x) => x.id === where.id);
      if (!c) throw new Error('not found');
      c.stream_key_hash = data.stream_key_hash;
      return c;
    },
  };
}

function sha256Hex(input: string): string {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { createHash } = require('crypto');
  return createHash('sha256').update(input).digest('hex');
}

describe('OBSBridgeService — correlation_id propagation', () => {
  it('publishes OBS_STREAM_STARTED with caller-supplied correlation_id', async () => {
    const nats = new StubNats();
    const prisma = new StubPrisma();
    const goodKey = 'cnz-key-a1b2c3';
    prisma.creators.push({ id: 'creator-1', stream_key_hash: sha256Hex(goodKey) });

    const svc = new OBSBridgeService(prisma as never, nats as never);
    const result = await svc.acceptConnection({
      creatorId: 'creator-1',
      streamKey: goodKey,
      organizationId: 'org-1',
      tenantId: 'tenant-1',
      correlationId: 'corr-start-123',
    });

    expect(result.ok).toBe(true);
    expect(result.correlation_id).toBe('corr-start-123');
    const startEvt = nats.published.find((p) => p.topic === NATS_TOPICS.OBS_STREAM_STARTED);
    expect(startEvt?.payload.correlation_id).toBe('corr-start-123');
    expect(startEvt?.payload.reason_code).toBe('OBS_STREAM_STARTED');
  });

  it('mints a fresh correlation_id when none is provided', async () => {
    const nats = new StubNats();
    const prisma = new StubPrisma();
    const goodKey = 'cnz-key-mint';
    prisma.creators.push({ id: 'creator-2', stream_key_hash: sha256Hex(goodKey) });

    const svc = new OBSBridgeService(prisma as never, nats as never);
    const result = await svc.acceptConnection({
      creatorId: 'creator-2',
      streamKey: goodKey,
      organizationId: 'org-1',
      tenantId: 'tenant-1',
    });

    expect(typeof result.correlation_id).toBe('string');
    expect(result.correlation_id).toMatch(/[0-9a-f-]{36}/i);
    expect(nats.published[0].payload.correlation_id).toBe(result.correlation_id);
  });

  it('rejects an invalid stream key with reason_code OBS_STREAM_KEY_INVALID', async () => {
    const nats = new StubNats();
    const prisma = new StubPrisma();
    prisma.creators.push({ id: 'creator-3', stream_key_hash: sha256Hex('the-real-key') });

    const svc = new OBSBridgeService(prisma as never, nats as never);
    await expect(
      svc.acceptConnection({
        creatorId: 'creator-3',
        streamKey: 'imposter',
        organizationId: 'org-1',
        tenantId: 'tenant-1',
        correlationId: 'corr-deny',
      }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        reason_code: 'OBS_STREAM_KEY_INVALID',
        correlation_id: 'corr-deny',
      }),
    });
    // No NATS event on a denied connection — the audit log captures the
    // attempt via the Logger only.
    expect(nats.published).toHaveLength(0);
  });

  it('endStream emits OBS_STREAM_ENDED with the same correlation_id when supplied', async () => {
    const nats = new StubNats();
    const prisma = new StubPrisma();
    const svc = new OBSBridgeService(prisma as never, nats as never);
    const result = await svc.endStream({
      creatorId: 'creator-1',
      organizationId: 'org-1',
      tenantId: 'tenant-1',
      correlationId: 'corr-stop-123',
    });
    expect(result.correlation_id).toBe('corr-stop-123');
    const evt = nats.published.find((p) => p.topic === NATS_TOPICS.OBS_STREAM_ENDED);
    expect(evt?.payload.correlation_id).toBe('corr-stop-123');
    expect(evt?.payload.reason_code).toBe('OBS_STREAM_ENDED');
  });
});
