// services/creator-onboarding/src/pixel-legacy.service.ts
// PIXEL-LEGACY-001 — Pixel Legacy creator onboarding + seat-cap allocation.
//
// Surface:
//   applyForPixelLegacy()  — creator submits / updates an application
//   reviewApplication()    — operator GRANT or DENY (RBAC: COMPLIANCE|ADMIN)
//   getSeatMeter()         — aggregate seat-availability snapshot for the UI
//   getApplication()       — load a creator's application
//   isPixelLegacy()        — fast lookup used by payout + Cyrano resolvers
//
// Concurrency invariant on grantSeat():
//   The 3,500-seat cap is enforced inside a single DB transaction guarded by
//   a Postgres advisory lock (PIXEL_LEGACY.SEAT_ALLOCATION_ADVISORY_LOCK_KEY).
//   Two concurrent applications cannot both observe seats_taken = 3,499 and
//   both succeed — the lock serializes them. The append-only trigger on
//   pixel_legacy_seat_allocations is the second line of defence.

import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { PixelLegacyApplication, PixelLegacySeatAllocation } from '@prisma/client';
import { PrismaService } from '../../core-api/src/prisma.service';
import { NatsService } from '../../core-api/src/nats/nats.service';
import { ImmutableAuditService } from '../../core-api/src/audit/immutable-audit.service';
import { NATS_TOPICS } from '../../nats/topics.registry';
import { PIXEL_LEGACY } from '../../core-api/src/config/governance.config';
import {
  ApplyPixelLegacyDto,
  PixelLegacyApplicationPublic,
  PixelLegacyPortfolioEntryDto,
  PixelLegacySeatAllocationPublic,
  ReviewPixelLegacyDto,
  toApplicationPublic,
  toSeatAllocationPublic,
} from './dto/pixel-legacy.dto';

export const PIXEL_LEGACY_RULE_ID = PIXEL_LEGACY.RULE_APPLIED_ID;

const ALLOWED_REVIEWER_ROLES = new Set(['COMPLIANCE', 'ADMIN']);

@Injectable()
export class PixelLegacyService {
  private readonly logger = new Logger(PixelLegacyService.name);
  private readonly RULE_ID = PIXEL_LEGACY_RULE_ID;

  constructor(
    private readonly prisma: PrismaService,
    private readonly nats: NatsService,
    private readonly audit: ImmutableAuditService,
  ) {}

  // ────────────────────────────────────────────────────────────────────────
  // Reads
  // ────────────────────────────────────────────────────────────────────────

  async getApplication(creatorId: string): Promise<PixelLegacyApplicationPublic | null> {
    const row = await this.prisma.pixelLegacyApplication.findUnique({
      where: { creator_id: creatorId },
    });
    return row ? toApplicationPublic(row) : null;
  }

  async getSeatMeter(): Promise<{
    seats_taken: number;
    seats_total: number;
    seats_remaining: number;
    cap_reached: boolean;
  }> {
    const seats_taken = await this.prisma.pixelLegacySeatAllocation.count();
    const seats_total = PIXEL_LEGACY.SEAT_CAP;
    const seats_remaining = Math.max(0, seats_total - seats_taken);
    return {
      seats_taken,
      seats_total,
      seats_remaining,
      cap_reached: seats_taken >= seats_total,
    };
  }

  async isPixelLegacy(creatorId: string): Promise<boolean> {
    const seat = await this.prisma.pixelLegacySeatAllocation.findUnique({
      where: { creator_id: creatorId },
      select: { id: true },
    });
    return seat !== null;
  }

  // ────────────────────────────────────────────────────────────────────────
  // Writes
  // ────────────────────────────────────────────────────────────────────────

  async applyForPixelLegacy(dto: ApplyPixelLegacyDto): Promise<PixelLegacyApplicationPublic> {
    this.assertPortfolioBounded(dto.portfolio_entries);
    this.assertProofStatementBounded(dto.proof_statement);

    const existing = await this.prisma.pixelLegacyApplication.findUnique({
      where: { creator_id: dto.creator_id },
    });

    if (existing && existing.status !== 'DRAFT' && existing.status !== 'APPLIED') {
      throw new ConflictException(
        `PIXEL_LEGACY_APPLICATION_LOCKED: application is in terminal state ${existing.status}`,
      );
    }

    const application_id = existing?.application_id ?? `PXL-${randomUUID()}`;
    const now = new Date();

    const row = await this.prisma.pixelLegacyApplication.upsert({
      where: { creator_id: dto.creator_id },
      create: {
        application_id,
        creator_id: dto.creator_id,
        status: 'APPLIED',
        proof_statement: dto.proof_statement,
        portfolio_entries: dto.portfolio_entries as unknown as object,
        submitted_at_utc: now,
        organization_id: dto.organization_id,
        tenant_id: dto.tenant_id,
        correlation_id: dto.correlation_id,
        reason_code: 'PIXEL_LEGACY_APPLICATION_SUBMITTED',
        rule_applied_id: this.RULE_ID,
      },
      update: {
        status: 'APPLIED',
        proof_statement: dto.proof_statement,
        portfolio_entries: dto.portfolio_entries as unknown as object,
        submitted_at_utc: existing?.submitted_at_utc ?? now,
        correlation_id: dto.correlation_id,
        reason_code: 'PIXEL_LEGACY_APPLICATION_RESUBMITTED',
      },
    });

    this.logger.log('PixelLegacyService: application submitted', {
      application_id,
      creator_id: dto.creator_id,
      correlation_id: dto.correlation_id,
      rule_applied_id: this.RULE_ID,
    });

    this.nats.publish(NATS_TOPICS.PIXEL_LEGACY_APPLICATION_SUBMITTED, {
      application_id,
      creator_id: dto.creator_id,
      actor_id: dto.creator_id,
      actor_role: 'creator',
      submitted_at_utc: now.toISOString(),
      correlation_id: dto.correlation_id,
      reason_code: row.reason_code,
      rule_applied_id: this.RULE_ID,
    });

    return toApplicationPublic(row);
  }

  async reviewApplication(dto: ReviewPixelLegacyDto): Promise<{
    application: PixelLegacyApplicationPublic;
    seat_allocation: PixelLegacySeatAllocationPublic | null;
  }> {
    if (!ALLOWED_REVIEWER_ROLES.has(dto.caller_role)) {
      throw new ForbiddenException(
        `PIXEL_LEGACY_REVIEW_UNAUTHORIZED: caller_role ${dto.caller_role} is not COMPLIANCE or ADMIN`,
      );
    }

    const application = await this.prisma.pixelLegacyApplication.findUnique({
      where: { application_id: dto.application_id },
    });
    if (!application) {
      throw new NotFoundException(`PIXEL_LEGACY_APPLICATION_NOT_FOUND: ${dto.application_id}`);
    }
    if (application.status !== 'APPLIED' && application.status !== 'REVIEWED') {
      throw new ConflictException(
        `PIXEL_LEGACY_REVIEW_INVALID_STATE: application is ${application.status}, expected APPLIED or REVIEWED`,
      );
    }

    if (dto.decision === 'DENY') {
      if (!dto.denial_reason_code) {
        throw new BadRequestException('PIXEL_LEGACY_DENIAL_REQUIRES_REASON_CODE');
      }
      const denied = await this.recordDenial(application, dto);
      return { application: toApplicationPublic(denied), seat_allocation: null };
    }

    // GRANT path — concurrency-safe seat allocation inside a transaction.
    const result = await this.grantSeatAtomic(application, dto);
    return result;
  }

  // ────────────────────────────────────────────────────────────────────────
  // Internal — denial path
  // ────────────────────────────────────────────────────────────────────────

  private async recordDenial(
    application: PixelLegacyApplication,
    dto: ReviewPixelLegacyDto,
  ): Promise<PixelLegacyApplication> {
    const now = new Date();
    const updated = await this.prisma.pixelLegacyApplication.update({
      where: { application_id: dto.application_id },
      data: {
        status: 'DENIED',
        reviewed_at_utc: now,
        reviewed_by: dto.reviewer_id,
        denial_reason_code: dto.denial_reason_code,
        correlation_id: dto.correlation_id,
        reason_code: 'PIXEL_LEGACY_APPLICATION_DENIED',
      },
    });

    this.logger.log('PixelLegacyService: application denied', {
      application_id: dto.application_id,
      reviewer_id: dto.reviewer_id,
      denial_reason_code: dto.denial_reason_code,
      correlation_id: dto.correlation_id,
      rule_applied_id: this.RULE_ID,
    });

    this.nats.publish(NATS_TOPICS.PIXEL_LEGACY_APPLICATION_DENIED, {
      application_id: dto.application_id,
      creator_id: application.creator_id,
      actor_id: dto.reviewer_id,
      actor_role: dto.caller_role.toLowerCase(),
      reviewed_at_utc: now.toISOString(),
      denial_reason_code: dto.denial_reason_code,
      correlation_id: dto.correlation_id,
      reason_code: 'PIXEL_LEGACY_APPLICATION_DENIED',
      rule_applied_id: this.RULE_ID,
    });

    return updated;
  }

  // ────────────────────────────────────────────────────────────────────────
  // Internal — grant path with atomic seat allocation
  // ────────────────────────────────────────────────────────────────────────

  private async grantSeatAtomic(
    application: PixelLegacyApplication,
    dto: ReviewPixelLegacyDto,
  ): Promise<{
    application: PixelLegacyApplicationPublic;
    seat_allocation: PixelLegacySeatAllocationPublic | null;
  }> {
    const now = new Date();
    const lockKey = PIXEL_LEGACY.SEAT_ALLOCATION_ADVISORY_LOCK_KEY;
    const cap = PIXEL_LEGACY.SEAT_CAP;

    return this.prisma.$transaction(async (tx) => {
      // Advisory lock — released automatically on COMMIT/ROLLBACK. Two
      // concurrent grants will serialize through this lock.
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(${lockKey}::bigint)`;

      const seats_taken = await tx.pixelLegacySeatAllocation.count();
      if (seats_taken >= cap) {
        // Cap reached — flip the application to DENIED with the canonical
        // reason. The UI seat meter will reflect cap_reached = true.
        const denied = await tx.pixelLegacyApplication.update({
          where: { application_id: dto.application_id },
          data: {
            status: 'DENIED',
            reviewed_at_utc: now,
            reviewed_by: dto.reviewer_id,
            denial_reason_code: 'PIXEL_LEGACY_SEAT_CAP_REACHED',
            correlation_id: dto.correlation_id,
            reason_code: 'PIXEL_LEGACY_SEAT_CAP_REACHED',
          },
        });

        this.nats.publish(NATS_TOPICS.PIXEL_LEGACY_APPLICATION_DENIED, {
          application_id: dto.application_id,
          creator_id: application.creator_id,
          actor_id: dto.reviewer_id,
          actor_role: dto.caller_role.toLowerCase(),
          reviewed_at_utc: now.toISOString(),
          denial_reason_code: 'PIXEL_LEGACY_SEAT_CAP_REACHED',
          correlation_id: dto.correlation_id,
          reason_code: 'PIXEL_LEGACY_SEAT_CAP_REACHED',
          rule_applied_id: this.RULE_ID,
        });

        return { application: toApplicationPublic(denied), seat_allocation: null };
      }

      const seat_number = seats_taken + 1;

      const seat = await tx.pixelLegacySeatAllocation.create({
        data: {
          seat_number,
          creator_id: application.creator_id,
          application_id: dto.application_id,
          granted_by: dto.reviewer_id,
          granted_at_utc: now,
          organization_id: dto.organization_id,
          tenant_id: dto.tenant_id,
          correlation_id: dto.correlation_id,
        },
      });

      // Mirror the grant onto the Creator row for fast profile reads.
      await tx.creator.update({
        where: { id: application.creator_id },
        data: {
          creator_type: 'PIXEL_LEGACY',
          pixel_legacy_granted_at: now,
          lifetime_cyrano_membership: true,
        },
      });

      const granted = await tx.pixelLegacyApplication.update({
        where: { application_id: dto.application_id },
        data: {
          status: 'GRANTED',
          reviewed_at_utc: now,
          reviewed_by: dto.reviewer_id,
          denial_reason_code: null,
          correlation_id: dto.correlation_id,
          reason_code: 'PIXEL_LEGACY_APPLICATION_GRANTED',
        },
      });

      this.logger.log('PixelLegacyService: seat granted', {
        application_id: dto.application_id,
        creator_id: application.creator_id,
        seat_number,
        reviewer_id: dto.reviewer_id,
        correlation_id: dto.correlation_id,
        rule_applied_id: this.RULE_ID,
      });

      this.nats.publish(NATS_TOPICS.PIXEL_LEGACY_SEAT_GRANTED, {
        application_id: dto.application_id,
        creator_id: application.creator_id,
        seat_number,
        actor_id: dto.reviewer_id,
        actor_role: dto.caller_role.toLowerCase(),
        granted_at_utc: now.toISOString(),
        correlation_id: dto.correlation_id,
        reason_code: 'PIXEL_LEGACY_SEAT_GRANTED',
        rule_applied_id: this.RULE_ID,
      });

      return {
        application: toApplicationPublic(granted),
        seat_allocation: toSeatAllocationPublic(seat),
      };
    });
  }

  // ────────────────────────────────────────────────────────────────────────
  // Validation guards
  // ────────────────────────────────────────────────────────────────────────

  private assertPortfolioBounded(entries: PixelLegacyPortfolioEntryDto[]): void {
    if (!Array.isArray(entries) || entries.length === 0) {
      throw new BadRequestException('PIXEL_LEGACY_PORTFOLIO_REQUIRED');
    }
    if (entries.length > 20) {
      throw new BadRequestException('PIXEL_LEGACY_PORTFOLIO_TOO_LARGE');
    }
  }

  private assertProofStatementBounded(statement: string): void {
    if (typeof statement !== 'string' || statement.trim().length === 0) {
      throw new BadRequestException('PIXEL_LEGACY_PROOF_STATEMENT_REQUIRED');
    }
    if (statement.length > 2000) {
      throw new BadRequestException('PIXEL_LEGACY_PROOF_STATEMENT_TOO_LONG');
    }
  }
}
