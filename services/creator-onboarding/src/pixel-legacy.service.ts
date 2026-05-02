// services/creator-onboarding/src/pixel-legacy.service.ts
// PIXEL-LEGACY-002 — first-come-first-served gateway (supersedes -001).
//
// There is no application or operator-review flow. The first 3,500 creators
// completing onboarding receive a PIXEL_LEGACY seat automatically; after
// that the gateway closes and all new creators stay STANDARD (the default).
// The public seat meter clamps at MARKETING_SEAT_CAP (3,000); the actual
// gateway closes at SEAT_CAP (3,500).
//
// Surface:
//   tryGrantSeatOnOnboarding()  — automatic, called by CreatorOnboardingService
//                                 when an onboarding flips to COMPLETE.
//                                 Idempotent on creator_id (re-completion of
//                                 onboarding for an existing seat-holder
//                                 returns the existing seat without rewriting).
//   getCreatorStatus()          — drives the /creator/pixel-legacy status page
//                                 (PixelLegacyStatusView in the UI contract).
//   getSeatMeter()              — public seat-availability snapshot (clamped
//                                 to MARKETING_SEAT_CAP).
//   isPixelLegacy()             — fast lookup used by payout + Cyrano resolvers.
//
// Concurrency invariant on tryGrantSeatOnOnboarding:
//   The seat allocation runs inside a Prisma $transaction guarded by a
//   Postgres advisory lock (PIXEL_LEGACY.SEAT_ALLOCATION_ADVISORY_LOCK_KEY).
//   Two concurrent onboarding completions cannot both observe seats_taken
//   = 3,499 and both succeed — the lock serializes them. The append-only
//   trigger on pixel_legacy_seat_allocations is the second line of defence.
//
// NATS publish ordering:
//   Domain events are collected inside the transaction and emitted only
//   AFTER the transaction commits successfully. A rollback never broadcasts
//   a ghost grant or gateway-closed event to subscribers.

import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../core-api/src/prisma.service';
import { NatsService } from '../../core-api/src/nats/nats.service';
import { NATS_TOPICS } from '../../nats/topics.registry';
import { PIXEL_LEGACY } from '../../core-api/src/config/governance.config';
import {
  PixelLegacyCreatorStatusPublic,
  PixelLegacySeatAllocationPublic,
  PixelLegacySeatMeterPublic,
  toSeatAllocationPublic,
} from './dto/pixel-legacy.dto';

export const PIXEL_LEGACY_RULE_ID = PIXEL_LEGACY.RULE_APPLIED_ID;

interface PendingNatsEvent {
  topic: string;
  payload: Record<string, unknown>;
}

export interface TryGrantParams {
  creator_id: string;
  granted_by: string;
  organization_id: string;
  tenant_id: string;
  correlation_id: string;
}

export interface TryGrantResult {
  granted: boolean;
  /** 1..3500 when granted; null otherwise. */
  seat_number: number | null;
  /** True iff the gateway is no longer accepting new grants at the moment
   *  this call returns — composes two cases: (a) this call allocated the
   *  final seat (3,500) and just closed the gateway, OR (b) the gateway
   *  was already closed when called and the creator stays STANDARD. False
   *  on idempotent replay (the creator already had a seat; we cannot tell
   *  the gateway state cheaply and the answer is not actionable for
   *  callers). */
  gateway_closed: boolean;
  /** True iff the creator already had a seat — call was idempotent. */
  idempotent_replay: boolean;
  rule_applied_id: string;
}

@Injectable()
export class PixelLegacyService {
  private readonly logger = new Logger(PixelLegacyService.name);
  private readonly RULE_ID = PIXEL_LEGACY_RULE_ID;

  constructor(
    private readonly prisma: PrismaService,
    private readonly nats: NatsService,
  ) {}

  // ────────────────────────────────────────────────────────────────────────
  // Reads
  // ────────────────────────────────────────────────────────────────────────

  async getSeatMeter(): Promise<PixelLegacySeatMeterPublic> {
    const actual = await this.prisma.pixelLegacySeatAllocation.count();
    const marketingCap = PIXEL_LEGACY.MARKETING_SEAT_CAP;
    const realCap = PIXEL_LEGACY.SEAT_CAP;

    const seats_taken = Math.min(actual, marketingCap);
    const seats_remaining = Math.max(0, marketingCap - actual);
    return {
      seats_taken,
      seats_total: marketingCap,
      seats_remaining,
      cap_reached: actual >= marketingCap,
      gateway_open: actual < realCap,
      rule_applied_id: this.RULE_ID,
    };
  }

  async getCreatorStatus(creatorId: string): Promise<PixelLegacyCreatorStatusPublic> {
    const [creator, seat] = await Promise.all([
      this.prisma.creator.findUnique({ where: { id: creatorId } }),
      this.prisma.pixelLegacySeatAllocation.findUnique({ where: { creator_id: creatorId } }),
    ]);
    if (!creator) {
      throw new NotFoundException(`CREATOR_NOT_FOUND: ${creatorId}`);
    }

    return {
      creator_id: creatorId,
      is_pixel_legacy: creator.creator_type === 'PIXEL_LEGACY',
      seat_number: seat?.seat_number ?? null,
      granted_at_utc: seat?.granted_at_utc.toISOString() ?? null,
      lifetime_cyrano: creator.lifetime_cyrano_membership,
      rule_applied_id: this.RULE_ID,
      generated_at_utc: new Date().toISOString(),
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

  /**
   * Atomically grants a Pixel Legacy seat to the creator iff the gateway is
   * open. Idempotent: re-completion of onboarding for an existing seat-holder
   * returns the existing seat without re-writing.
   *
   * Designed to be called from CreatorOnboardingService.complete() once the
   * onboarding row flips to COMPLETE — the seat is automatic.
   */
  async tryGrantSeatOnOnboarding(params: TryGrantParams): Promise<TryGrantResult> {
    const lockKey = PIXEL_LEGACY.SEAT_ALLOCATION_ADVISORY_LOCK_KEY;
    const cap = PIXEL_LEGACY.SEAT_CAP;
    const now = new Date();

    const { result, events } = await this.prisma.$transaction(async (tx) => {
      // Advisory lock — released on COMMIT/ROLLBACK. Serializes concurrent
      // onboarding completions through this allocation path.
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(${lockKey}::bigint)`;

      // Idempotent replay — creator already has a seat (e.g. onboarding
      // re-completion). Return the existing seat unchanged.
      const existingSeat = await tx.pixelLegacySeatAllocation.findUnique({
        where: { creator_id: params.creator_id },
      });
      if (existingSeat) {
        return {
          result: {
            granted: true,
            seat_number: existingSeat.seat_number,
            gateway_closed: false,
            idempotent_replay: true,
            rule_applied_id: this.RULE_ID,
          } as TryGrantResult,
          events: [] as PendingNatsEvent[],
        };
      }

      const seats_taken = await tx.pixelLegacySeatAllocation.count();
      if (seats_taken >= cap) {
        // Gateway closed — creator silently stays STANDARD. No event,
        // no error, no application-style denial. The marketing copy
        // ("Pixel Legacy seats are filled — you are a Standard creator")
        // is rendered by the UI based on the seat-meter.
        return {
          result: {
            granted: false,
            seat_number: null,
            gateway_closed: true,
            idempotent_replay: false,
            rule_applied_id: this.RULE_ID,
          } as TryGrantResult,
          events: [] as PendingNatsEvent[],
        };
      }

      const seat_number = seats_taken + 1;

      const seat = await tx.pixelLegacySeatAllocation.create({
        data: {
          seat_number,
          creator_id: params.creator_id,
          granted_by: params.granted_by,
          granted_at_utc: now,
          organization_id: params.organization_id,
          tenant_id: params.tenant_id,
          correlation_id: params.correlation_id,
          rule_applied_id: this.RULE_ID,
        },
      });

      // Mirror the grant onto the Creator row for fast profile reads.
      await tx.creator.update({
        where: { id: params.creator_id },
        data: {
          creator_type: 'PIXEL_LEGACY',
          pixel_legacy_granted_at: now,
          lifetime_cyrano_membership: true,
        },
      });

      const events: PendingNatsEvent[] = [
        {
          topic: NATS_TOPICS.PIXEL_LEGACY_SEAT_GRANTED,
          payload: {
            creator_id: params.creator_id,
            seat_number,
            actor_id: params.granted_by,
            actor_role: 'system',
            granted_at_utc: now.toISOString(),
            correlation_id: params.correlation_id,
            reason_code: 'PIXEL_LEGACY_SEAT_GRANTED',
            rule_applied_id: this.RULE_ID,
          },
        },
      ];

      // Last seat allocated — gateway closes. Fire the ops event so
      // downstream dashboards can flag the milestone.
      const isLastSeat = seat_number === cap;
      if (isLastSeat) {
        events.push({
          topic: NATS_TOPICS.PIXEL_LEGACY_GATEWAY_CLOSED,
          payload: {
            final_seat_number: seat_number,
            final_creator_id: params.creator_id,
            closed_at_utc: now.toISOString(),
            correlation_id: params.correlation_id,
            reason_code: 'PIXEL_LEGACY_GATEWAY_CLOSED',
            rule_applied_id: this.RULE_ID,
          },
        });
      }

      return {
        result: {
          granted: true,
          seat_number,
          gateway_closed: isLastSeat,
          idempotent_replay: false,
          rule_applied_id: this.RULE_ID,
        } as TryGrantResult,
        events,
        seat,
      };
    });

    // Publish only after the transaction commits successfully.
    this.publishAfterCommit(events);

    if (result.granted && !result.idempotent_replay) {
      this.logger.log('PixelLegacyService: seat granted on onboarding completion', {
        creator_id: params.creator_id,
        seat_number: result.seat_number,
        gateway_closed: result.gateway_closed,
        correlation_id: params.correlation_id,
        rule_applied_id: this.RULE_ID,
      });
    } else if (!result.granted) {
      this.logger.log('PixelLegacyService: gateway closed — creator stays STANDARD', {
        creator_id: params.creator_id,
        correlation_id: params.correlation_id,
        rule_applied_id: this.RULE_ID,
      });
    }

    return result;
  }

  /**
   * Convenience read used by tests and ops surfaces — returns the raw seat
   * allocation if it exists. Most callers should use isPixelLegacy() or
   * getCreatorStatus() instead.
   */
  async getSeatAllocation(creatorId: string): Promise<PixelLegacySeatAllocationPublic | null> {
    const seat = await this.prisma.pixelLegacySeatAllocation.findUnique({
      where: { creator_id: creatorId },
    });
    return seat ? toSeatAllocationPublic(seat) : null;
  }

  // ────────────────────────────────────────────────────────────────────────
  // Internal
  // ────────────────────────────────────────────────────────────────────────

  private publishAfterCommit(events: PendingNatsEvent[]): void {
    for (const event of events) {
      this.nats.publish(event.topic, event.payload);
    }
  }
}
