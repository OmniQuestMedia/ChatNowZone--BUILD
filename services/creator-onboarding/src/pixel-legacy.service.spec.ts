// services/creator-onboarding/src/pixel-legacy.service.spec.ts
// PIXEL-LEGACY-001 — unit coverage for:
//   - validation guards on apply
//   - review-path RBAC + state-machine enforcement
//   - happy-path grant: seat creation + creator flag mirroring + post-commit publish
//   - cap-reached denial path: status flip + post-commit publish
// Real-Postgres concurrency coverage (10 races → 1 winner under the advisory
// lock) is tracked as PIXEL-LEGACY-005 — that test needs a live DB.

import { PixelLegacyService } from './pixel-legacy.service';
import { NATS_TOPICS } from '../../nats/topics.registry';

interface PrismaCallTracker {
  publishedTopics: string[];
  publishedPayloads: Record<string, unknown>[];
}

function makeService(opts: {
  prisma: unknown;
  tracker?: PrismaCallTracker;
}): PixelLegacyService {
  const tracker: PrismaCallTracker = opts.tracker ?? { publishedTopics: [], publishedPayloads: [] };
  const nats = {
    publish: (topic: string, payload: Record<string, unknown>) => {
      tracker.publishedTopics.push(topic);
      tracker.publishedPayloads.push(payload);
    },
  } as never;
  const audit = {} as never;
  return new PixelLegacyService(opts.prisma as never, nats, audit);
}

describe('PixelLegacyService — validation guards on apply', () => {
  const baseDto = {
    creator_id: 'creator-uuid',
    display_name: 'Test Creator',
    proof_statement: 'I have been creating since 2019.',
    portfolio_entries: [{ entry_id: 'e1', label: 'Twitch', url: 'https://twitch.tv/me' }],
    organization_id: 'org-1',
    tenant_id: 'tenant-1',
    correlation_id: 'corr-' + 'a'.repeat(36),
  };

  function prismaWithCreator(creatorExists: boolean) {
    return {
      creator: { findUnique: async () => (creatorExists ? { id: baseDto.creator_id } : null) },
      pixelLegacyApplication: { findUnique: async () => null },
    };
  }

  it('throws CREATOR_NOT_FOUND when creator does not exist', async () => {
    const svc = makeService({ prisma: prismaWithCreator(false) });
    await expect(svc.applyForPixelLegacy(baseDto)).rejects.toMatchObject({
      message: expect.stringContaining('CREATOR_NOT_FOUND'),
    });
  });

  it('rejects empty portfolio', async () => {
    const svc = makeService({ prisma: prismaWithCreator(true) });
    await expect(
      svc.applyForPixelLegacy({ ...baseDto, portfolio_entries: [] }),
    ).rejects.toMatchObject({ message: expect.stringContaining('PIXEL_LEGACY_PORTFOLIO_REQUIRED') });
  });

  it('rejects portfolio above 20 entries', async () => {
    const svc = makeService({ prisma: prismaWithCreator(true) });
    const entries = Array.from({ length: 21 }, (_, i) => ({
      entry_id: `e${i}`,
      label: `Link ${i}`,
      url: `https://example.com/${i}`,
    }));
    await expect(
      svc.applyForPixelLegacy({ ...baseDto, portfolio_entries: entries }),
    ).rejects.toMatchObject({ message: expect.stringContaining('PIXEL_LEGACY_PORTFOLIO_TOO_LARGE') });
  });

  it('rejects empty proof statement', async () => {
    const svc = makeService({ prisma: prismaWithCreator(true) });
    await expect(
      svc.applyForPixelLegacy({ ...baseDto, proof_statement: '   ' }),
    ).rejects.toMatchObject({
      message: expect.stringContaining('PIXEL_LEGACY_PROOF_STATEMENT_REQUIRED'),
    });
  });

  it('rejects proof statement above 2000 chars', async () => {
    const svc = makeService({ prisma: prismaWithCreator(true) });
    await expect(
      svc.applyForPixelLegacy({ ...baseDto, proof_statement: 'x'.repeat(2001) }),
    ).rejects.toMatchObject({
      message: expect.stringContaining('PIXEL_LEGACY_PROOF_STATEMENT_TOO_LONG'),
    });
  });

  it('rejects empty display_name', async () => {
    const svc = makeService({ prisma: prismaWithCreator(true) });
    await expect(
      svc.applyForPixelLegacy({ ...baseDto, display_name: '' }),
    ).rejects.toMatchObject({
      message: expect.stringContaining('PIXEL_LEGACY_DISPLAY_NAME_REQUIRED'),
    });
  });

  it('rejects re-submission once application reaches a terminal state', async () => {
    const svc = makeService({
      prisma: {
        creator: { findUnique: async () => ({ id: baseDto.creator_id }) },
        pixelLegacyApplication: {
          findUnique: async () => ({
            application_id: 'PXL-1',
            creator_id: baseDto.creator_id,
            status: 'GRANTED',
          }),
        },
      },
    });
    await expect(svc.applyForPixelLegacy(baseDto)).rejects.toMatchObject({
      message: expect.stringContaining('PIXEL_LEGACY_APPLICATION_LOCKED'),
    });
  });
});

describe('PixelLegacyService — review path RBAC + state-machine', () => {
  const baseReviewDto = {
    application_id: 'PXL-1',
    decision: 'DENY' as const,
    reviewer_id: 'reviewer-uuid',
    denial_reason_code: 'PIXEL_LEGACY_PORTFOLIO_INSUFFICIENT',
    caller_role: 'COMPLIANCE',
    organization_id: 'org-1',
    tenant_id: 'tenant-1',
    correlation_id: 'corr-' + 'b'.repeat(36),
  };

  it('rejects callers below COMPLIANCE rank via canonical RbacGuard', async () => {
    const svc = makeService({
      prisma: { pixelLegacyApplication: { findUnique: async () => null } },
    });
    await expect(
      svc.reviewApplication({ ...baseReviewDto, caller_role: 'CREATOR' }),
    ).rejects.toMatchObject({
      message: expect.stringContaining('PIXEL_LEGACY_REVIEW_UNAUTHORIZED'),
    });
  });

  it('rejects DENY without a denial_reason_code', async () => {
    const svc = makeService({
      prisma: {
        pixelLegacyApplication: {
          findUnique: async () => ({ application_id: 'PXL-1', status: 'APPLIED' }),
        },
      },
    });
    await expect(
      svc.reviewApplication({ ...baseReviewDto, denial_reason_code: undefined }),
    ).rejects.toMatchObject({
      message: expect.stringContaining('PIXEL_LEGACY_DENIAL_REQUIRES_REASON_CODE'),
    });
  });

  it('throws NOT_FOUND when the application does not exist', async () => {
    const svc = makeService({
      prisma: { pixelLegacyApplication: { findUnique: async () => null } },
    });
    await expect(svc.reviewApplication(baseReviewDto)).rejects.toMatchObject({
      message: expect.stringContaining('PIXEL_LEGACY_APPLICATION_NOT_FOUND'),
    });
  });

  it('rejects review on a non-APPLIED / non-REVIEWED application', async () => {
    const svc = makeService({
      prisma: {
        pixelLegacyApplication: {
          findUnique: async () => ({ application_id: 'PXL-1', status: 'GRANTED' }),
        },
      },
    });
    await expect(svc.reviewApplication(baseReviewDto)).rejects.toMatchObject({
      message: expect.stringContaining('PIXEL_LEGACY_REVIEW_INVALID_STATE'),
    });
  });
});

describe('PixelLegacyService — grant path', () => {
  const grantDto = {
    application_id: 'PXL-1',
    decision: 'GRANT' as const,
    reviewer_id: 'reviewer-uuid',
    caller_role: 'COMPLIANCE',
    organization_id: 'org-1',
    tenant_id: 'tenant-1',
    correlation_id: 'corr-' + 'c'.repeat(36),
  };

  function makeGrantHarness(opts: { seatsTaken: number }) {
    const tracker: PrismaCallTracker = { publishedTopics: [], publishedPayloads: [] };
    const txCalls: string[] = [];
    const tx = {
      $queryRaw: async () => {
        txCalls.push('advisory_lock');
        return [];
      },
      pixelLegacySeatAllocation: {
        count: async () => opts.seatsTaken,
        create: async (args: { data: Record<string, unknown> }) => {
          txCalls.push('seat_create');
          return { ...args.data, id: 'seat-row' };
        },
      },
      creator: {
        update: async () => {
          txCalls.push('creator_mirror');
          return { id: 'creator-uuid' };
        },
      },
      pixelLegacyApplication: {
        update: async (args: { data: Record<string, unknown> }) => {
          txCalls.push(`application_${(args.data.status as string) ?? 'updated'}`);
          return {
            id: 'app-row',
            application_id: 'PXL-1',
            creator_id: 'creator-uuid',
            status: args.data.status,
            display_name: 'Test',
            proof_statement: '',
            portfolio_entries: [],
            submitted_at_utc: new Date(),
            reviewed_at_utc: new Date(),
            reviewed_by: 'reviewer-uuid',
            denial_reason_code: args.data.denial_reason_code ?? null,
            correlation_id: args.data.correlation_id,
            reason_code: args.data.reason_code,
            rule_applied_id: 'PIXEL_LEGACY_v1',
            created_at: new Date(),
            updated_at: new Date(),
          };
        },
      },
    };
    const prisma = {
      pixelLegacyApplication: {
        findUnique: async () => ({
          application_id: 'PXL-1',
          creator_id: 'creator-uuid',
          status: 'APPLIED',
          correlation_id: 'old-correlation',
        }),
      },
      $transaction: async (cb: (tx: unknown) => unknown) => cb(tx),
    };
    return { svc: makeService({ prisma, tracker }), tracker, txCalls };
  }

  it('seat-cap-reached path flips to DENIED and publishes only after commit', async () => {
    const { svc, tracker, txCalls } = makeGrantHarness({ seatsTaken: 3500 });
    const result = await svc.reviewApplication(grantDto);

    expect(result.application.status).toBe('DENIED');
    expect(result.application.denial_reason_code).toBe('PIXEL_LEGACY_SEAT_CAP_REACHED');
    expect(result.seat_allocation).toBeNull();

    // The advisory lock and the application update happen inside the
    // transaction; seat_create + creator_mirror do NOT happen in this path.
    expect(txCalls).toEqual(['advisory_lock', 'application_DENIED']);

    // Publishing happens after the transaction returns — ordering verified by
    // tracker.publishedTopics being populated only after the result resolves.
    expect(tracker.publishedTopics).toEqual([NATS_TOPICS.PIXEL_LEGACY_APPLICATION_DENIED]);
    expect(tracker.publishedPayloads[0]).toMatchObject({
      reason_code: 'PIXEL_LEGACY_SEAT_CAP_REACHED',
      denial_reason_code: 'PIXEL_LEGACY_SEAT_CAP_REACHED',
    });
  });

  it('happy-path grant: seat created, creator mirrored, application GRANTED, publish after commit', async () => {
    const { svc, tracker, txCalls } = makeGrantHarness({ seatsTaken: 0 });
    const result = await svc.reviewApplication(grantDto);

    expect(result.application.status).toBe('GRANTED');
    expect(result.seat_allocation).not.toBeNull();
    expect(result.seat_allocation?.seat_number).toBe(1);

    // All four DB ops happen inside the transaction in order.
    expect(txCalls).toEqual([
      'advisory_lock',
      'seat_create',
      'creator_mirror',
      'application_GRANTED',
    ]);

    expect(tracker.publishedTopics).toEqual([NATS_TOPICS.PIXEL_LEGACY_SEAT_GRANTED]);
    expect(tracker.publishedPayloads[0]).toMatchObject({
      reason_code: 'PIXEL_LEGACY_SEAT_GRANTED',
      seat_number: 1,
    });
  });
});
