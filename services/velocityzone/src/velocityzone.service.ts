// services/velocityzone/src/velocityzone.service.ts
// VelocityZone — time-window payout boost engine.
//
// Contract:
//   • On every tip, the payout engine calls resolveVelocityZoneRate() with the
//     current FFS score and tip timestamp.
//   • If a VelocityZone event is active at tip_time, the FFS score (0–100) is
//     linearly interpolated to a rate in [rate_floor_usd, rate_ceil_usd].
//   • Rate is locked at tip processing time — not retroactively adjustable.
//   • Admin UI calls createEvent() to define new time-window events.
//   • No ledger or balance mutations in this service. Payout engine owns writes.
//
// FIZ: Any payout rate resolution that flows through this service is FIZ-scoped.
// CORRELATION_ID: passed through from the tip event to all NATS emissions.

import { Injectable, Logger } from '@nestjs/common';
import Decimal from 'decimal.js';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../core-api/src/prisma.service';
import { NatsService } from '../../core-api/src/nats/nats.service';
import { NATS_TOPICS } from '../../nats/topics.registry';
import { GovernanceConfig } from '../../core-api/src/governance/governance.config';
import {
  VELOCITYZONE_RULE_ID,
  type CreateVelocityZoneEventDto,
  type VelocityZoneRateInput,
  type VelocityZoneRateResult,
} from './velocityzone.types';

@Injectable()
export class VelocityZoneService {
  private readonly logger = new Logger(VelocityZoneService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly nats: NatsService,
  ) {}

  /**
   * Resolve the payout rate for a tip event under any active VelocityZone window.
   * Returns { active: false } when no window is active at tip_time.
   *
   * Linear interpolation:  rate = floor + (ffs/100) * (ceil - floor)
   *
   * FIZ: Caller (payout engine) is responsible for persisting the returned rate
   * alongside the ledger entry.  This service only resolves and emits NATS.
   */
  async resolveVelocityZoneRate(input: VelocityZoneRateInput): Promise<VelocityZoneRateResult> {
    if (input.ffs_score < 0 || input.ffs_score > 100) {
      throw new Error(`ffs_score must be 0–100 (got ${input.ffs_score})`);
    }

    const event = await this.prisma.velocityZoneEvent.findFirst({
      where: {
        is_active: true,
        starts_at: { lte: input.tip_time },
        ends_at:   { gt:  input.tip_time },
      },
      orderBy: { starts_at: 'desc' },
    });

    if (!event) {
      return { active: false, event_id: null, rate_usd_per_czt: null, ffs_score: input.ffs_score };
    }

    const floor = new Decimal(event.rate_floor_usd.toString());
    const ceil  = new Decimal(event.rate_ceil_usd.toString());

    // Guard: operator-defined rates must not exceed platform governance limits.
    const govFloor = GovernanceConfig.VELOCITYZONE_RATE_FLOOR_MIN;
    const govCeil  = GovernanceConfig.VELOCITYZONE_RATE_CEIL_MAX;
    const effectiveFloor = Decimal.max(floor, govFloor);
    const effectiveCeil  = Decimal.min(ceil,  govCeil);

    const ratio      = new Decimal(input.ffs_score).div(100);
    const rate       = effectiveFloor.plus(ratio.mul(effectiveCeil.minus(effectiveFloor)));
    const rateNumber = rate.toDecimalPlaces(4).toNumber();

    // Emit NATS: rate locked for this tip event.
    await this.nats.publish(NATS_TOPICS.VELOCITYZONE_RATE_LOCKED, {
      event_id:        event.id,
      label:           event.label,
      ffs_score:       input.ffs_score,
      rate_usd_per_czt: rateNumber,
      correlation_id:  input.correlation_id,
      rule_applied_id: VELOCITYZONE_RULE_ID,
      locked_at:       input.tip_time.toISOString(),
    });

    this.logger.log('VelocityZone rate locked', {
      event_id: event.id,
      ffs_score: input.ffs_score,
      rate_usd_per_czt: rateNumber,
      correlation_id: input.correlation_id,
    });

    return {
      active:           true,
      event_id:         event.id,
      rate_usd_per_czt: rateNumber,
      ffs_score:        input.ffs_score,
    };
  }

  /**
   * Create a new VelocityZone event window. Admin-only.
   * Validates that rate_floor_usd ≥ governance min and rate_ceil_usd ≤ governance max.
   */
  async createEvent(dto: CreateVelocityZoneEventDto): Promise<{ id: string }> {
    const floor = new Decimal(dto.rate_floor_usd);
    const ceil  = new Decimal(dto.rate_ceil_usd);

    if (floor.lt(GovernanceConfig.VELOCITYZONE_RATE_FLOOR_MIN)) {
      throw new Error(
        `rate_floor_usd (${floor}) is below governance minimum ` +
        `(${GovernanceConfig.VELOCITYZONE_RATE_FLOOR_MIN})`,
      );
    }
    if (ceil.gt(GovernanceConfig.VELOCITYZONE_RATE_CEIL_MAX)) {
      throw new Error(
        `rate_ceil_usd (${ceil}) exceeds governance maximum ` +
        `(${GovernanceConfig.VELOCITYZONE_RATE_CEIL_MAX})`,
      );
    }
    if (floor.gte(ceil)) {
      throw new Error(`rate_floor_usd must be strictly less than rate_ceil_usd`);
    }

    const startsAt = new Date(dto.starts_at);
    const endsAt   = new Date(dto.ends_at);
    if (endsAt <= startsAt) {
      throw new Error(`ends_at must be after starts_at`);
    }

    const event = await this.prisma.velocityZoneEvent.create({
      data: {
        label:           dto.label,
        starts_at:       startsAt,
        ends_at:         endsAt,
        rate_floor_usd:  floor,
        rate_ceil_usd:   ceil,
        is_active:       true,
        correlation_id:  dto.correlation_id,
        reason_code:     dto.reason_code,
        rule_applied_id: VELOCITYZONE_RULE_ID,
        created_by:      dto.created_by,
      },
    });

    await this.nats.publish(NATS_TOPICS.VELOCITYZONE_EVENT_ACTIVE, {
      event_id:       event.id,
      label:          event.label,
      starts_at:      event.starts_at.toISOString(),
      ends_at:        event.ends_at.toISOString(),
      rate_floor_usd: dto.rate_floor_usd,
      rate_ceil_usd:  dto.rate_ceil_usd,
      correlation_id: dto.correlation_id,
    });

    this.logger.log('VelocityZone event created', { id: event.id, label: event.label });
    return { id: event.id };
  }

  /**
   * Deactivate a VelocityZone event (admin-only, soft delete via is_active=false).
   * Note: this is NOT append-only — it sets is_active = false.
   * The event row is retained for audit. No financial data is modified.
   */
  async deactivateEvent(id: string, correlationId: string): Promise<void> {
    await this.prisma.velocityZoneEvent.update({
      where: { id },
      data:  { is_active: false, updated_at: new Date() },
    });

    await this.nats.publish(NATS_TOPICS.VELOCITYZONE_EVENT_ENDED, {
      event_id:       id,
      correlation_id: correlationId,
      ended_at:       new Date().toISOString(),
    });

    this.logger.log('VelocityZone event deactivated', { id, correlationId });
  }

  /**
   * List all upcoming and currently active VelocityZone events (admin dashboard).
   */
  async listActiveAndUpcoming(): Promise<unknown[]> {
    return this.prisma.velocityZoneEvent.findMany({
      where: {
        is_active: true,
        ends_at:   { gt: new Date() },
      },
      orderBy: { starts_at: 'asc' },
    });
  }
}
