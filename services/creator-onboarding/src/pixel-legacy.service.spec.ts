// services/creator-onboarding/src/pixel-legacy.service.spec.ts
// PIXEL-LEGACY-002 — unit coverage for the FCFS gateway:
//   - happy-path grant (seat created + creator mirrored + post-commit publish)
//   - last-seat (3,500): emits PIXEL_LEGACY_GATEWAY_CLOSED
//   - gateway-closed: silent fall-through to STANDARD (no event, no error)
//   - idempotent replay: existing seat returned unchanged
//   - seat-meter clamping at MARKETING_SEAT_CAP (3,000)
//   - getCreatorStatus shape (granted vs not granted)
// Real-Postgres concurrency coverage (10 races → 1 winner under the advisory
// lock) is tracked separately as a follow-up — that test needs a live DB.

import { PixelLegacyService } from './pixel-legacy.service';
import { NATS_TOPICS } from '../../nats/topics.registry';
import { PIXEL_LEGACY } from '../../core-api/src/config/governance.config';

interface PrismaTracker {
  publishedTopics: string[];
  publishedPayloads: Record<string, unknown>[];
}

function makeService(opts: { prisma: unknown; tracker?: PrismaTracker }): PixelLegacyService {
  const tracker = opts.tracker ?? { publishedTopics: [], publishedPayloads: [] };
  const nats = {
    publish: (topic: string, payload: Record<string, unknown>) => {
      tracker.publishedTopics.push(topic);
      tracker.publishedPayloads.push(payload);
    },
  } as never;
  return new PixelLegacyService(opts.prisma as never, nats);
}

describe('PixelLegacyService.tryGrantSeatOnOnboarding (FCFS)', () => {
  const baseParams = {
    creator_id: 'creator-uuid',
    granted_by: 'onboarding.complete',
    organization_id: 'org-1',
    tenant_id: 'tenant-1',
    correlation_id: 'corr-' + 'a'.repeat(36),
  };

  function makeHarness(opts: {
    seatsTaken: number;
    existingSeat?: { seat_number: number; creator_id: string } | null;
  }) {
    const tracker: PrismaTracker = { publishedTopics: [], publishedPayloads: [] };
    const txCalls: string[] = [];
    const tx = {
      $queryRaw: async () => {
        txCalls.push('advisory_lock');
        return [];
      },
      pixelLegacySeatAllocation: {
        findUnique: async () => opts.existingSeat ?? null,
        count: async () => opts.seatsTaken,
        create: async (args: { data: Record<string, unknown> }) => {
          txCalls.push('seat_create');
          return { ...args.data, id: 'seat-row', granted_at_utc: new Date() };
        },
      },
      creator: {
        update: async () => {
          txCalls.push('creator_mirror');
          return { id: baseParams.creator_id };
        },
      },
    };
    const prisma = {
      $transaction: async (cb: (tx: unknown) => unknown) => cb(tx),
    };
    return { svc: makeService({ prisma, tracker }), tracker, txCalls };
  }

  it('happy path — first seat: creates allocation, mirrors creator, publishes after commit', async () => {
    const { svc, tracker, txCalls } = makeHarness({ seatsTaken: 0 });
    const result = await svc.tryGrantSeatOnOnboarding(baseParams);

    expect(result).toMatchObject({
      granted: true,
      seat_number: 1,
      gateway_closed: false,
      idempotent_replay: false,
    });
    expect(txCalls).toEqual(['advisory_lock', 'seat_create', 'creator_mirror']);
    expect(tracker.publishedTopics).toEqual([NATS_TOPICS.PIXEL_LEGACY_SEAT_GRANTED]);
    expect(tracker.publishedPayloads[0]).toMatchObject({
      seat_number: 1,
      reason_code: 'PIXEL_LEGACY_SEAT_GRANTED',
    });
  });

  it('last seat (3,499 → 3,500): emits PIXEL_LEGACY_GATEWAY_CLOSED', async () => {
    const { svc, tracker, txCalls } = makeHarness({ seatsTaken: 3499 });
    const result = await svc.tryGrantSeatOnOnboarding(baseParams);

    expect(result.granted).toBe(true);
    expect(result.seat_number).toBe(3500);
    expect(result.gateway_closed).toBe(true);
    expect(txCalls).toEqual(['advisory_lock', 'seat_create', 'creator_mirror']);
    expect(tracker.publishedTopics).toEqual([
      NATS_TOPICS.PIXEL_LEGACY_SEAT_GRANTED,
      NATS_TOPICS.PIXEL_LEGACY_GATEWAY_CLOSED,
    ]);
    expect(tracker.publishedPayloads[1]).toMatchObject({
      final_seat_number: 3500,
      reason_code: 'PIXEL_LEGACY_GATEWAY_CLOSED',
    });
  });

  it('gateway closed (>= 3,500): silent fall-through to STANDARD, no event', async () => {
    const { svc, tracker, txCalls } = makeHarness({ seatsTaken: PIXEL_LEGACY.SEAT_CAP });
    const result = await svc.tryGrantSeatOnOnboarding(baseParams);

    expect(result).toMatchObject({
      granted: false,
      seat_number: null,
      gateway_closed: true,
      idempotent_replay: false,
    });
    // Lock was acquired and count was checked; nothing else happened.
    expect(txCalls).toEqual(['advisory_lock']);
    expect(tracker.publishedTopics).toEqual([]);
  });

  it('idempotent replay: existing seat returned, no new allocation, no event', async () => {
    const { svc, tracker, txCalls } = makeHarness({
      seatsTaken: 100,
      existingSeat: { seat_number: 42, creator_id: baseParams.creator_id },
    });
    const result = await svc.tryGrantSeatOnOnboarding(baseParams);

    expect(result).toMatchObject({
      granted: true,
      seat_number: 42,
      idempotent_replay: true,
      gateway_closed: false,
    });
    expect(txCalls).toEqual(['advisory_lock']);
    expect(tracker.publishedTopics).toEqual([]);
  });
});

describe('PixelLegacyService.getSeatMeter — marketing-cap clamping', () => {
  function makeMeterService(actualSeatsTaken: number): PixelLegacyService {
    return makeService({
      prisma: {
        pixelLegacySeatAllocation: { count: async () => actualSeatsTaken },
      },
    });
  }

  it('returns marketing-cap-relative values when actual < marketing cap', async () => {
    const svc = makeMeterService(1500);
    const meter = await svc.getSeatMeter();
    expect(meter.seats_taken).toBe(1500);
    expect(meter.seats_total).toBe(PIXEL_LEGACY.MARKETING_SEAT_CAP);
    expect(meter.seats_remaining).toBe(PIXEL_LEGACY.MARKETING_SEAT_CAP - 1500);
    expect(meter.cap_reached).toBe(false);
    expect(meter.gateway_open).toBe(true);
  });

  it('clamps at marketing cap (3,000) when actual is between marketing and real cap', async () => {
    const svc = makeMeterService(3200);
    const meter = await svc.getSeatMeter();
    // Public seat-meter freezes at 100% — buffer (3,000..3,500) is invisible.
    expect(meter.seats_taken).toBe(PIXEL_LEGACY.MARKETING_SEAT_CAP);
    expect(meter.seats_remaining).toBe(0);
    expect(meter.cap_reached).toBe(true);
    // But the gateway is still open (room within the actual 3,500 cap).
    expect(meter.gateway_open).toBe(true);
  });

  it('reports gateway_open=false once the actual cap is reached', async () => {
    const svc = makeMeterService(PIXEL_LEGACY.SEAT_CAP);
    const meter = await svc.getSeatMeter();
    expect(meter.cap_reached).toBe(true);
    expect(meter.gateway_open).toBe(false);
  });
});

describe('PixelLegacyService.getCreatorStatus', () => {
  it('returns is_pixel_legacy=true with seat fields when creator has a seat', async () => {
    const grantedAt = new Date('2026-04-30T12:00:00Z');
    const svc = makeService({
      prisma: {
        creator: {
          findUnique: async () => ({
            id: 'creator-uuid',
            creator_type: 'PIXEL_LEGACY',
            lifetime_cyrano_membership: true,
          }),
        },
        pixelLegacySeatAllocation: {
          findUnique: async () => ({
            seat_number: 7,
            creator_id: 'creator-uuid',
            granted_at_utc: grantedAt,
          }),
        },
      },
    });
    const status = await svc.getCreatorStatus('creator-uuid');
    expect(status).toMatchObject({
      creator_id: 'creator-uuid',
      is_pixel_legacy: true,
      seat_number: 7,
      lifetime_cyrano: true,
      granted_at_utc: grantedAt.toISOString(),
    });
  });

  it('returns is_pixel_legacy=false with null seat fields when creator is STANDARD', async () => {
    const svc = makeService({
      prisma: {
        creator: {
          findUnique: async () => ({
            id: 'creator-uuid',
            creator_type: 'STANDARD',
            lifetime_cyrano_membership: false,
          }),
        },
        pixelLegacySeatAllocation: { findUnique: async () => null },
      },
    });
    const status = await svc.getCreatorStatus('creator-uuid');
    expect(status).toMatchObject({
      creator_id: 'creator-uuid',
      is_pixel_legacy: false,
      seat_number: null,
      granted_at_utc: null,
      lifetime_cyrano: false,
    });
  });

  it('throws CREATOR_NOT_FOUND when creator does not exist', async () => {
    const svc = makeService({
      prisma: {
        creator: { findUnique: async () => null },
        pixelLegacySeatAllocation: { findUnique: async () => null },
      },
    });
    await expect(svc.getCreatorStatus('ghost-creator')).rejects.toMatchObject({
      message: expect.stringContaining('CREATOR_NOT_FOUND'),
    });
  });
});
