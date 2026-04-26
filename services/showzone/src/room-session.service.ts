// services/showzone/src/room-session.service.ts
// @deprecated SHOWZONE-DEPRECATED — ShowZone service is deprecated as of post-April 2026.
// Legacy ShowToken pricing fields (pass_price_st / phase2_price_st) and dual-wallet
// logic are retained here for historical reference, but are no longer exercised in
// production. Active token operations now use CZT exclusively via services/ledger/.
// BIJOU: SHOWZONE-001 — ShowZone room lifecycle state machine
// Lifecycle: DRAFT → SCHEDULED → COUNTDOWN → LIVE_PHASE_1 → LIVE_PHASE_2 → ENDED
// All transitions are logged. Invalid transitions throw and are never silent.
import { Injectable, Logger } from '@nestjs/common';
import { NatsService } from '../../core-api/src/nats/nats.service';
import { NATS_TOPICS } from '../../nats/topics.registry';
import { SHOWZONE_PRICING } from
  '../../core-api/src/config/governance.config';

export type RoomStatus =
  | 'DRAFT'
  | 'SCHEDULED'
  | 'COUNTDOWN'
  | 'LIVE_PHASE_1'
  | 'LIVE_PHASE_2'
  | 'ENDED'
  | 'CANCELLED';

export interface RoomSession {
  session_id: string;
  creator_id: string;
  venue: 'SHOWZONE';
  status: RoomStatus;
  scheduled_at_utc: string;
  phase2_enabled: boolean;
  phase2_capacity: number;
  pass_price_st: number;
  phase2_price_st: number;
  seats_sold: number;
  min_seats: number;
  countdown_started_at_utc?: string;
  live_started_at_utc?: string;
  phase2_started_at_utc?: string;
  ended_at_utc?: string;
  cancellation_reason?: string;
  rule_applied_id: string;
}

// Valid state transitions — any transition not listed here is prohibited
const VALID_TRANSITIONS: Record<RoomStatus, RoomStatus[]> = {
  DRAFT:        ['SCHEDULED', 'CANCELLED'],
  SCHEDULED:    ['COUNTDOWN', 'CANCELLED'],
  COUNTDOWN:    ['LIVE_PHASE_1', 'CANCELLED'],
  LIVE_PHASE_1: ['LIVE_PHASE_2', 'ENDED'],
  LIVE_PHASE_2: ['ENDED'],
  ENDED:        [],
  CANCELLED:    [],
};

@Injectable()
export class RoomSessionService {
  private readonly logger = new Logger(RoomSessionService.name);
  private readonly RULE_ID = 'SHOWZONE_LIFECYCLE_v1';

  constructor(private readonly nats: NatsService) {}

  /**
   * Transitions a session to a new status.
   * Validates the transition is permitted before applying.
   * Publishes NATS event for every transition.
   * Throws on invalid transition — no silent state corruption.
   */
  transition(
    session: RoomSession,
    to: RoomStatus,
    reason?: string,
  ): RoomSession {
    const allowed = VALID_TRANSITIONS[session.status];
    if (!allowed.includes(to)) {
      const msg =
        `INVALID_TRANSITION: ${session.status} → ${to} is not permitted ` +
        `for session ${session.session_id}. ` +
        `Allowed: [${allowed.join(', ')}]`;
      this.logger.error(msg, undefined, { session_id: session.session_id });
      throw new Error(msg);
    }

    const now = new Date().toISOString();
    const updated: RoomSession = { ...session, status: to };

    // Stamp the appropriate timestamp for this transition
    if (to === 'COUNTDOWN')    updated.countdown_started_at_utc = now;
    if (to === 'LIVE_PHASE_1') updated.live_started_at_utc = now;
    if (to === 'LIVE_PHASE_2') updated.phase2_started_at_utc = now;
    if (to === 'ENDED')        updated.ended_at_utc = now;
    if (to === 'CANCELLED')    updated.cancellation_reason = reason ?? 'NO_REASON_PROVIDED';

    this.logger.log('RoomSessionService: status transition', {
      session_id: session.session_id,
      from: session.status,
      to,
      reason: reason ?? null,
      rule_applied_id: this.RULE_ID,
    });

    // Publish transition event to NATS fabric
    const topic = to === 'ENDED' ? NATS_TOPICS.SHOWZONE_SHOW_ENDED
      : to === 'LIVE_PHASE_2'   ? NATS_TOPICS.SHOWZONE_PHASE2_TRIGGER
      : null;

    if (topic) {
      this.nats.publish(topic, {
        session_id: session.session_id,
        creator_id: session.creator_id,
        status: to,
        timestamp_utc: now,
        rule_applied_id: this.RULE_ID,
      });
    }

    return updated;
  }

  /**
   * Evaluates the T-1 hour auto-cancel gate.
   * Returns the session unchanged if gate passes.
   * Returns a CANCELLED session if seats_sold < min_seats.
   * Caller is responsible for persisting the result and issuing refunds.
   */
  evaluateMinSeatGate(session: RoomSession): {
    session: RoomSession;
    cancelled: boolean;
    reason_code: string;
  } {
    if (session.seats_sold >= session.min_seats) {
      return { session, cancelled: false, reason_code: 'MIN_SEAT_GATE_PASSED' };
    }

    const cancelled = this.transition(
      session,
      'CANCELLED',
      `MIN_SEAT_GATE_FAILED: ${session.seats_sold}/${session.min_seats} seats at T-1hr`,
    );

    this.logger.warn('RoomSessionService: auto-cancel triggered at T-1hr gate', {
      session_id: session.session_id,
      seats_sold: session.seats_sold,
      min_seats: session.min_seats,
      rule_applied_id: this.RULE_ID,
    });

    return {
      session: cancelled,
      cancelled: true,
      reason_code: `MIN_SEAT_GATE_FAILED: ${session.seats_sold}/${session.min_seats}`,
    };
  }

  /**
   * Builds a reconciliation snapshot on session end.
   * Returns the financial summary for ledger posting.
   * Caller posts to LedgerService — this method computes only.
   */
  buildReconciliationSnapshot(session: RoomSession): {
    session_id: string;
    creator_id: string;
    gross_st: number;
    creator_pool_st: number;
    platform_pool_st: number;
    phase2_gross_st: number;
    payout_rate_usd: number;
    rule_applied_id: string;
  } {
    const admissionGross = session.pass_price_st * session.seats_sold;
    const creatorPool = Math.round(admissionGross * 0.85);
    const platformPool = admissionGross - creatorPool;

    // Phase 2 is calculated separately — seats = 25% of Phase 1 capacity
    const phase2Seats = session.phase2_enabled
      ? Math.min(Math.round(session.seats_sold * SHOWZONE_PRICING.PHASE2_CAPACITY_PCT), session.seats_sold)
      : 0;
    const phase2Gross = session.phase2_enabled
      ? session.phase2_price_st * phase2Seats
      : 0;

    return {
      session_id: session.session_id,
      creator_id: session.creator_id,
      gross_st: admissionGross,
      creator_pool_st: creatorPool,
      platform_pool_st: platformPool,
      phase2_gross_st: phase2Gross,
      payout_rate_usd: SHOWZONE_PRICING.PAYOUT_RATE_PER_CZT,
      rule_applied_id: this.RULE_ID,
    };
  }
}
