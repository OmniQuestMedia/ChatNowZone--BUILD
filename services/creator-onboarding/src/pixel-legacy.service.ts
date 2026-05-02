// services/creator-onboarding/src/pixel-legacy.service.ts
// PIXEL-LEGACY-001 — Pixel Legacy creator onboarding + seat-cap allocation.
//
// Surface:
//   applyForPixelLegacy()    — creator submits / updates an application
//   reviewApplication()      — operator GRANT or DENY (RBAC: pixel_legacy:seat:allocate)
//   buildApplicationView()   — full PixelLegacyApplicationView for the UI binding
//   getSeatMeter()           — aggregate seat-availability snapshot for the UI
//   getApplication()         — load a creator's application (raw row)
//   isPixelLegacy()          — fast lookup used by payout + Cyrano resolvers
//
// Concurrency invariant on grantSeat():
//   The 3,500-seat cap is enforced inside a single Prisma $transaction guarded
//   by a Postgres advisory lock (PIXEL_LEGACY.SEAT_ALLOCATION_ADVISORY_LOCK_KEY).
//   Two concurrent applications cannot both observe seats_taken = 3,499 and
//   both succeed — the lock serializes them. The append-only trigger on
//   pixel_legacy_seat_allocations is the second line of defence.
//
// NATS publish ordering:
//   Domain events are collected inside the transaction and emitted only AFTER
//   the transaction commits successfully. A rollback never broadcasts a ghost
//   event to subscribers.
//
// Auth:
//   Body-supplied reviewer_id / caller_role is INTERIM. Once the platform
//   auth middleware lands, both fields will come from the authenticated
//   session and the Controller will set them on the dto from req.user.
//   Tracked: PIXEL-LEGACY-006 (step-up auth modal flow).

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
import { RbacGuard, RbacRole } from '../../core-api/src/auth/rbac.guard';
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
export const PIXEL_LEGACY_SEAT_PERMISSION = 'pixel_legacy:seat:allocate';

/**
 * Full view shape consumed by ui/app/creator/pixel-legacy/page.ts.
 * Structurally matches ui/types/creator-panel-contracts.ts
 * PixelLegacyApplicationView. Kept as a local interface so the service
 * package does not take a runtime dependency on the ui/ tree.
 */
export interface PixelLegacyApplicationView {
  application_id: string | null;
  creator_id: string;
  display_name: string;
  status: 'DRAFT' | 'APPLIED' | 'REVIEWED' | 'GRANTED' | 'DENIED';
  seat_meter: {
    seats_taken: number;
    seats_total: number;
    seats_remaining: number;
    cap_reached: boolean;
  };
  portfolio_entries: PixelLegacyPortfolioEntryDto[];
  proof_statement: string;
  submitted_at_utc: string | null;
  reviewed_at_utc: string | null;
  denial_reason_code: string | null;
  benefits: {
    payout_range_min_usd: number;
    payout_range_max_usd: number;
    lifetime_cyrano: boolean;
    signing_bonus_month: number;
    badge_label: 'Pixel Legacy';
  };
  cyrano_panel_unlocked: boolean;
  generated_at_utc: string;
  rule_applied_id: string;
}

/** Domain event collected inside a transaction; published only after commit. */
interface PendingNatsEvent {
  topic: string;
  payload: Record<string, unknown>;
}

@Injectable()
export class PixelLegacyService {
  private readonly logger = new Logger(PixelLegacyService.name);
  private readonly RULE_ID = PIXEL_LEGACY_RULE_ID;
  private readonly rbac = new RbacGuard();

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

  /**
   * Builds the full PixelLegacyApplicationView for /creator/pixel-legacy.
   * For first-time visits with no application row, returns a synthetic DRAFT
   * view so the UI has a coherent shape to render the apply form against.
   * Throws CREATOR_NOT_FOUND when the creator_id does not exist — the UI
   * should never bind for a non-existent creator.
   */
  async buildApplicationView(creatorId: string): Promise<PixelLegacyApplicationView> {
    const [creator, application, seatCount] = await Promise.all([
      this.prisma.creator.findUnique({ where: { id: creatorId } }),
      this.prisma.pixelLegacyApplication.findUnique({ where: { creator_id: creatorId } }),
      this.prisma.pixelLegacySeatAllocation.count(),
    ]);
    if (!creator) {
      throw new NotFoundException(`CREATOR_NOT_FOUND: ${creatorId}`);
    }

    const seats_total = PIXEL_LEGACY.SEAT_CAP;
    const seat_meter = {
      seats_taken: seatCount,
      seats_total,
      seats_remaining: Math.max(0, seats_total - seatCount),
      cap_reached: seatCount >= seats_total,
    };

    const benefits = {
      payout_range_min_usd: PIXEL_LEGACY.PAYOUT_FLOOR_USD,
      payout_range_max_usd: PIXEL_LEGACY.PAYOUT_CEILING_USD,
      lifetime_cyrano: true,
      signing_bonus_month: PIXEL_LEGACY.SIGNING_BONUS_MONTH,
      badge_label: 'Pixel Legacy' as const,
    };
    const generated_at_utc = new Date().toISOString();

    if (!application) {
      return {
        application_id: null,
        creator_id: creatorId,
        display_name: creatorId, // Display name is captured at apply-time; fall back to id for first-time view.
        status: 'DRAFT',
        seat_meter,
        portfolio_entries: [],
        proof_statement: '',
        submitted_at_utc: null,
        reviewed_at_utc: null,
        denial_reason_code: null,
        benefits,
        cyrano_panel_unlocked: false,
        generated_at_utc,
        rule_applied_id: this.RULE_ID,
      };
    }

    return {
      application_id: application.application_id,
      creator_id: application.creator_id,
      display_name: application.display_name,
      status: application.status,
      seat_meter,
      portfolio_entries: (application.portfolio_entries as unknown as PixelLegacyPortfolioEntryDto[]) ?? [],
      proof_statement: application.proof_statement,
      submitted_at_utc: application.submitted_at_utc?.toISOString() ?? null,
      reviewed_at_utc: application.reviewed_at_utc?.toISOString() ?? null,
      denial_reason_code: application.denial_reason_code,
      benefits,
      cyrano_panel_unlocked: application.status === 'GRANTED',
      generated_at_utc,
      rule_applied_id: this.RULE_ID,
    };
  }

  // ────────────────────────────────────────────────────────────────────────
  // Writes
  // ────────────────────────────────────────────────────────────────────────

  async applyForPixelLegacy(dto: ApplyPixelLegacyDto): Promise<PixelLegacyApplicationPublic> {
    this.assertPortfolioBounded(dto.portfolio_entries);
    this.assertProofStatementBounded(dto.proof_statement);
    this.assertDisplayNameBounded(dto.display_name);

    // Explicit creator existence check — surface CREATOR_NOT_FOUND rather
    // than letting Prisma raise a raw foreign-key violation from upsert.
    const creatorExists = await this.prisma.creator.findUnique({
      where: { id: dto.creator_id },
      select: { id: true },
    });
    if (!creatorExists) {
      throw new NotFoundException(`CREATOR_NOT_FOUND: ${dto.creator_id}`);
    }

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
        display_name: dto.display_name,
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
        display_name: dto.display_name,
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

    // Single non-transactional write; safe to publish synchronously after
    // the upsert returns.
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
    // Route the role check through the canonical RbacGuard against the
    // 'pixel_legacy:seat:allocate' permission. NOTE: caller_role and
    // reviewer_id are accepted from the request body for now (interim).
    // Once the platform auth middleware lands they come from req.user;
    // tracked under PIXEL-LEGACY-006 alongside the step-up auth wiring.
    const rbacResult = this.rbac.check({
      actor_id: dto.reviewer_id,
      actor_role: dto.caller_role as RbacRole,
      permission: PIXEL_LEGACY_SEAT_PERMISSION,
    });
    if (!rbacResult.permitted) {
      throw new ForbiddenException(
        `PIXEL_LEGACY_REVIEW_UNAUTHORIZED: ${rbacResult.failure_reason ?? 'INSUFFICIENT_ROLE'} ` +
          `(actor_role=${dto.caller_role}, required=${rbacResult.required_role})`,
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
      const { application: deniedRow, events } = await this.recordDenial(application, dto);
      this.publishAfterCommit(events);
      return { application: toApplicationPublic(deniedRow), seat_allocation: null };
    }

    // GRANT path — concurrency-safe seat allocation inside a transaction.
    const { application: applicationRow, seat, events } = await this.grantSeatAtomic(
      application,
      dto,
    );
    this.publishAfterCommit(events);

    return {
      application: toApplicationPublic(applicationRow),
      seat_allocation: seat ? toSeatAllocationPublic(seat) : null,
    };
  }

  // ────────────────────────────────────────────────────────────────────────
  // Internal — denial path
  // ────────────────────────────────────────────────────────────────────────

  private async recordDenial(
    application: PixelLegacyApplication,
    dto: ReviewPixelLegacyDto,
  ): Promise<{ application: PixelLegacyApplication; events: PendingNatsEvent[] }> {
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

    return {
      application: updated,
      events: [
        {
          topic: NATS_TOPICS.PIXEL_LEGACY_APPLICATION_DENIED,
          payload: {
            application_id: dto.application_id,
            creator_id: application.creator_id,
            actor_id: dto.reviewer_id,
            actor_role: dto.caller_role.toLowerCase(),
            reviewed_at_utc: now.toISOString(),
            denial_reason_code: dto.denial_reason_code,
            correlation_id: dto.correlation_id,
            reason_code: 'PIXEL_LEGACY_APPLICATION_DENIED',
            rule_applied_id: this.RULE_ID,
          },
        },
      ],
    };
  }

  // ────────────────────────────────────────────────────────────────────────
  // Internal — grant path with atomic seat allocation
  // ────────────────────────────────────────────────────────────────────────

  private async grantSeatAtomic(
    application: PixelLegacyApplication,
    dto: ReviewPixelLegacyDto,
  ): Promise<{
    application: PixelLegacyApplication;
    seat: PixelLegacySeatAllocation | null;
    events: PendingNatsEvent[];
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

        return {
          application: denied,
          seat: null,
          events: [
            {
              topic: NATS_TOPICS.PIXEL_LEGACY_APPLICATION_DENIED,
              payload: {
                application_id: dto.application_id,
                creator_id: application.creator_id,
                actor_id: dto.reviewer_id,
                actor_role: dto.caller_role.toLowerCase(),
                reviewed_at_utc: now.toISOString(),
                denial_reason_code: 'PIXEL_LEGACY_SEAT_CAP_REACHED',
                correlation_id: dto.correlation_id,
                reason_code: 'PIXEL_LEGACY_SEAT_CAP_REACHED',
                rule_applied_id: this.RULE_ID,
              },
            },
          ],
        };
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

      return {
        application: granted,
        seat,
        events: [
          {
            topic: NATS_TOPICS.PIXEL_LEGACY_SEAT_GRANTED,
            payload: {
              application_id: dto.application_id,
              creator_id: application.creator_id,
              seat_number,
              actor_id: dto.reviewer_id,
              actor_role: dto.caller_role.toLowerCase(),
              granted_at_utc: now.toISOString(),
              correlation_id: dto.correlation_id,
              reason_code: 'PIXEL_LEGACY_SEAT_GRANTED',
              rule_applied_id: this.RULE_ID,
            },
          },
        ],
      };
    });
  }

  // ────────────────────────────────────────────────────────────────────────
  // Post-commit publishing
  // ────────────────────────────────────────────────────────────────────────

  private publishAfterCommit(events: PendingNatsEvent[]): void {
    for (const event of events) {
      this.nats.publish(event.topic, event.payload);
    }
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

  private assertDisplayNameBounded(displayName: string): void {
    if (typeof displayName !== 'string' || displayName.trim().length === 0) {
      throw new BadRequestException('PIXEL_LEGACY_DISPLAY_NAME_REQUIRED');
    }
    if (displayName.length > 100) {
      throw new BadRequestException('PIXEL_LEGACY_DISPLAY_NAME_TOO_LONG');
    }
  }
}
