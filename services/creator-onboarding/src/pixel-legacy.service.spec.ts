// services/creator-onboarding/src/pixel-legacy.service.spec.ts
// PIXEL-LEGACY-001 — unit coverage for validation guards and review-path
// state-machine enforcement. Concurrency-safe seat allocation is exercised
// by tests/integration/pixel-legacy-seat-cap.spec.ts against a real Postgres
// (follow-up — not included in this unit spec because the advisory-lock +
// transaction semantics require an actual DB to verify meaningfully).

import { PixelLegacyService } from './pixel-legacy.service';

function makeService(prismaStub: unknown): PixelLegacyService {
  // NatsService.publish is a no-op without a connection; safe to construct
  // and inject. ImmutableAuditService is unused on the validation paths
  // exercised here, but the constructor requires a non-null reference.
  const nats = { publish: () => undefined } as never;
  const audit = {} as never;
  return new PixelLegacyService(prismaStub as never, nats, audit);
}

describe('PixelLegacyService — validation guards', () => {
  const baseDto = {
    creator_id: 'creator-uuid',
    display_name: 'Test Creator',
    proof_statement: 'I have been creating since 2019.',
    portfolio_entries: [{ entry_id: 'e1', label: 'Twitch', url: 'https://twitch.tv/me' }],
    organization_id: 'org-1',
    tenant_id: 'tenant-1',
    correlation_id: 'corr-' + 'a'.repeat(36),
  };

  it('rejects empty portfolio', async () => {
    const svc = makeService({
      pixelLegacyApplication: { findUnique: async () => null },
    });
    await expect(
      svc.applyForPixelLegacy({ ...baseDto, portfolio_entries: [] }),
    ).rejects.toMatchObject({ message: expect.stringContaining('PIXEL_LEGACY_PORTFOLIO_REQUIRED') });
  });

  it('rejects portfolio above 20 entries', async () => {
    const svc = makeService({
      pixelLegacyApplication: { findUnique: async () => null },
    });
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
    const svc = makeService({
      pixelLegacyApplication: { findUnique: async () => null },
    });
    await expect(
      svc.applyForPixelLegacy({ ...baseDto, proof_statement: '   ' }),
    ).rejects.toMatchObject({
      message: expect.stringContaining('PIXEL_LEGACY_PROOF_STATEMENT_REQUIRED'),
    });
  });

  it('rejects proof statement above 2000 chars', async () => {
    const svc = makeService({
      pixelLegacyApplication: { findUnique: async () => null },
    });
    await expect(
      svc.applyForPixelLegacy({ ...baseDto, proof_statement: 'x'.repeat(2001) }),
    ).rejects.toMatchObject({
      message: expect.stringContaining('PIXEL_LEGACY_PROOF_STATEMENT_TOO_LONG'),
    });
  });

  it('rejects re-submission once application reaches a terminal state', async () => {
    const svc = makeService({
      pixelLegacyApplication: {
        findUnique: async () => ({
          application_id: 'PXL-1',
          creator_id: baseDto.creator_id,
          status: 'GRANTED',
        }),
      },
    });
    await expect(svc.applyForPixelLegacy(baseDto)).rejects.toMatchObject({
      message: expect.stringContaining('PIXEL_LEGACY_APPLICATION_LOCKED'),
    });
  });
});

describe('PixelLegacyService — review path', () => {
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

  it('rejects callers outside COMPLIANCE / ADMIN', async () => {
    const svc = makeService({
      pixelLegacyApplication: { findUnique: async () => null },
    });
    await expect(
      svc.reviewApplication({ ...baseReviewDto, caller_role: 'CREATOR' }),
    ).rejects.toMatchObject({
      message: expect.stringContaining('PIXEL_LEGACY_REVIEW_UNAUTHORIZED'),
    });
  });

  it('rejects DENY without a denial_reason_code', async () => {
    const svc = makeService({
      pixelLegacyApplication: {
        findUnique: async () => ({ application_id: 'PXL-1', status: 'APPLIED' }),
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
      pixelLegacyApplication: { findUnique: async () => null },
    });
    await expect(svc.reviewApplication(baseReviewDto)).rejects.toMatchObject({
      message: expect.stringContaining('PIXEL_LEGACY_APPLICATION_NOT_FOUND'),
    });
  });

  it('rejects review on a non-APPLIED / non-REVIEWED application', async () => {
    const svc = makeService({
      pixelLegacyApplication: {
        findUnique: async () => ({ application_id: 'PXL-1', status: 'GRANTED' }),
      },
    });
    await expect(svc.reviewApplication(baseReviewDto)).rejects.toMatchObject({
      message: expect.stringContaining('PIXEL_LEGACY_REVIEW_INVALID_STATE'),
    });
  });
});
