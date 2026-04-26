// services/nats/topics.registry.ts
// NATS: Canonical topic registry — all NATS subjects in one place.
// No service may publish or subscribe to a topic not listed here.
// Any new topic requires a NATS: commit adding it to this registry first.

export const NATS_TOPICS = {
  // ── Geo-pricing & chat stream ──────────────────────────────────────────
  GEO_TIP_TRANSLATED:       'geo.tip.translated',
  GEO_BLOCK_ENFORCED:       'geo.block.enforced',

  // ── Gamification ──────────────────────────────────────────────────────
  GAME_OUTCOME:             'game.outcome',        // game.outcome.<session_id>

  // ── Bijou Play.Zone ────────────────────────────────────────────────────
  BIJOU_DWELL_TICK:         'bijou.dwell.tick',
  BIJOU_SEAT_OPENED:        'bijou.seat.opened',
  BIJOU_STANDBY_ALERT:      'bijou.standby.alert',
  BIJOU_CAMERA_VIOLATION:   'bijou.camera.violation',
  BIJOU_EJECTION:           'bijou.ejection',

  // ── ShowZone Theatre ───────────────────────────────────────────────────
  SHOWZONE_DWELL_TICK:      'showzone.dwell.tick',
  SHOWZONE_SEAT_OPENED:     'showzone.seat.opened',
  SHOWZONE_PHASE2_TRIGGER:  'showzone.phase2.trigger',
  SHOWZONE_SHOW_ENDED:      'showzone.show.ended',

  // ── Chat aggregation (OBS multi-platform) ─────────────────────────────
  CHAT_INGEST_RAW:          'chat.ingest.raw',
  CHAT_RESPONSE_OUTBOUND:   'chat.response.outbound',
  CHAT_BROADCAST_STAGGERED: 'chat.broadcast.staggered',

  // ── HeartZone biometrics ───────────────────────────────────────────────
  HZ_BPM_UPDATE:            'hz.bpm.update',
  HZ_HAPTIC_TRIGGER:        'hz.haptic.trigger',
  HZ_WISH_FULFILLED:        'hz.wish.fulfilled',

  // ── SenSync™ biometric relay ──────────────────────────────────────────
  SENSYNC_SAMPLE_RECEIVED:        'sensync.sample.received',
  SENSYNC_RELAY_EMITTED:          'sensync.relay.emitted',
  SENSYNC_COMBINED_BPM:           'sensync.combined.bpm',
  SENSYNC_CONSENT_GRANTED:        'sensync.consent.granted',
  SENSYNC_CONSENT_REVOKED:        'sensync.consent.revoked',
  SENSYNC_HAPTIC_DISPATCHED:      'sensync.haptic.dispatched',
  SENSYNC_PLAUSIBILITY_REJECTED:  'sensync.plausibility.rejected',
  SENSYNC_TIER_DISABLED:          'sensync.tier.disabled',

  // ── Guest-Heat intelligence layer ─────────────────────────────────────
  GUEST_HEAT_WHALE_SCORED:          'guest_heat.whale.scored',
  GUEST_HEAT_OFFER_TRIGGERED:       'guest_heat.offer.triggered',
  GUEST_HEAT_OFFER_ACCEPTED:        'guest_heat.offer.accepted',
  GUEST_HEAT_GEMSTONE_QUEUED:       'guest_heat.gemstone.queued',
  GUEST_HEAT_GEMSTONE_SENT:         'guest_heat.gemstone.sent',
  GUEST_HEAT_DUAL_FLAME_TRIGGERED:  'guest_heat.dual_flame.triggered',
  GUEST_HEAT_FORECAST_UPDATED:      'guest_heat.forecast.updated',
  GUEST_HEAT_PERF_TIMER_STATE:      'guest_heat.perf_timer.state',
  GUEST_HEAT_TELEPROMPTER_ADVANCED: 'guest_heat.teleprompter.advanced',

  // ── Risk & fraud ───────────────────────────────────────────────────────
  RISK_FLAG_RAISED:         'risk.flag.raised',
  RISK_CONTAINMENT_APPLIED: 'risk.containment.applied',

  // ── GWP / VoucherVault ─────────────────────────────────────────────────
  GWP_OFFER_TRIGGERED:      'gwp.offer.triggered',
  GWP_OFFER_ACCEPTED:       'gwp.offer.accepted',

  // ── Step-up authentication ─────────────────────────────────────────────
  STEP_UP_CHALLENGE_ISSUED:   'auth.step_up.challenge.issued',
  STEP_UP_CHALLENGE_VERIFIED: 'auth.step_up.challenge.verified',
  STEP_UP_CHALLENGE_FAILED:   'auth.step_up.challenge.failed',

  // ── KYC / Publish gate ─────────────────────────────────────────────────
  PUBLISH_GATE_APPROVED:    'kyc.publish_gate.approved',
  PUBLISH_GATE_BLOCKED:     'kyc.publish_gate.blocked',

  // ── Moderation / Incident lifecycle ─────────────────────────────────────
  INCIDENT_TRANSITION:      'moderation.incident.transition',

  // ── Audit & compliance ─────────────────────────────────────────────────
  AUDIT_EVENT_WRITTEN:              'audit.event.written',
  AUDIT_CHAIN_INTEGRITY_FAILURE:    'audit.chain.integrity_failure',
  AUDIT_CHAIN_VERIFIED:             'audit.chain.verified',
  WORM_EXPORT_TRIGGERED:            'worm.export.triggered',
  WORM_EXPORT_COMPLETED:            'worm.export.completed',
  WORM_EXPORT_INTEGRITY_FAILURE:    'worm.export.integrity_failure',

  // ── PAYLOAD 6: Immutable audit emission ────────────────────────────────
  AUDIT_IMMUTABLE_PURCHASE:         'audit.immutable.purchase',
  AUDIT_IMMUTABLE_SPEND:            'audit.immutable.spend',
  AUDIT_IMMUTABLE_RECOVERY:         'audit.immutable.recovery',
  AUDIT_IMMUTABLE_GATEGUARD:        'audit.immutable.gateguard',
  AUDIT_IMMUTABLE_CYRANO:           'audit.immutable.cyrano',
  AUDIT_IMMUTABLE_STEP_UP:          'audit.immutable.step_up',
  AUDIT_IMMUTABLE_RBAC:             'audit.immutable.rbac',
  AUDIT_IMMUTABLE_DIAMOND:          'audit.immutable.diamond',

  // ── Legal hold ─────────────────────────────────────────────────────────
  LEGAL_HOLD_APPLIED:       'compliance.legal_hold.applied',
  LEGAL_HOLD_LIFTED:        'compliance.legal_hold.lifted',

  // ── Reconciliation (INFRA-004 — L0 ship-gate) ─────────────────────────
  RECONCILIATION_DRIFT_DETECTED: 'compliance.reconciliation.drift_detected',

  // ── PROC-001: Webhook hardening (FIZ) ─────────────────────────────────
  WEBHOOK_VALIDATION_FAILURE: 'fiz.webhook.validation.failure',
  WEBHOOK_DLQ:                'fiz.webhook.dlq',
  WEBHOOK_RECEIVED:           'payments.webhook.received',
  WEBHOOK_VERIFIED:           'payments.webhook.verified',
  WEBHOOK_REJECTED:           'payments.webhook.rejected',
  WEBHOOK_DUPLICATE:          'payments.webhook.duplicate',
  WEBHOOK_DEAD_LETTER:        'payments.webhook.dead_letter',

  // ── DFSP Module 3 — Platform OTP ──────────────────────────────────────
  DFSP_OTP_ISSUED:              'dfsp.otp.issued',
  DFSP_OTP_VERIFIED:            'dfsp.otp.verified',
  DFSP_OTP_FAILED:              'dfsp.otp.failed',
  DFSP_OTP_EXPIRED:             'dfsp.otp.expired',

  // ── DFSP Module 4 — Account Recovery Hold ─────────────────────────────
  DFSP_ACCOUNT_HOLD_APPLIED:    'dfsp.account.hold.applied',
  DFSP_ACCOUNT_HOLD_RELEASED:   'dfsp.account.hold.released',

  // ── DFSP — Diamond Financial Security Platform (PV-001) ───────────────
  PURCHASE_WINDOW_BLOCKED:             'dfsp.purchase_window.blocked',
  RISK_ASSESSMENT_COMPLETED:           'dfsp.risk.assessment_completed',
  RISK_AUTO_BAR_TRIGGERED:             'dfsp.risk.auto_bar_triggered',
  INTEGRITY_HOLD_AUTHORIZED:           'dfsp.integrity_hold.authorized',
  INTEGRITY_HOLD_RELEASED:             'dfsp.integrity_hold.released',
  INTEGRITY_HOLD_CAPTURED:             'dfsp.integrity_hold.captured',
  CHECKOUT_CONFIRMED:                  'dfsp.checkout.confirmed',
  CHECKOUT_EMAIL_RECEIPT_REQUESTED:    'dfsp.checkout.email_receipt_requested',
  CHECKOUT_SMS_NOTIFICATION_REQUESTED: 'dfsp.checkout.sms_notification_requested',

  // ── DFSP Module 5 — Voice Sample ──────────────────────────────────────────
  DFSP_VOICE_SAMPLE_CONSENT_RECORDED: 'dfsp.voice_sample.consent_recorded',
  DFSP_VOICE_SAMPLE_COLLECTED:        'dfsp.voice_sample.collected',
  DFSP_VOICE_SAMPLE_DISPOSED:         'dfsp.voice_sample.disposed',
  DFSP_VOICE_SAMPLE_LIMIT_REACHED:    'dfsp.voice_sample.limit_reached',

  // ── DFSP Concierge (CONCIERGE-CONFIG-001) ─────────────────────────────────
  DFSP_CONCIERGE_APPOINTMENT_BOOKED:  'dfsp.concierge.appointment.booked',

  // ── GZ Scheduling Module ──────────────────────────────────────────────────
  SCHEDULE_PERIOD_CREATED:         'gz.schedule.period.created',
  SCHEDULE_PERIOD_B_LOCKED:        'gz.schedule.period.b_locked',
  SCHEDULE_PERIOD_FINAL_LOCKED:    'gz.schedule.period.final_locked',
  SCHEDULE_SHIFT_ASSIGNED:         'gz.schedule.shift.assigned',
  SCHEDULE_SHIFT_SWAPPED:          'gz.schedule.shift.swapped',
  SCHEDULE_GAP_POSTED:             'gz.schedule.gap.posted',
  SCHEDULE_GAP_FILLED:             'gz.schedule.gap.filled',
  SCHEDULE_ZONEBOT_LOTTERY_RUN:    'gz.schedule.zonebot.lottery_run',
  SCHEDULE_ZONEBOT_BID_OFFERED:    'gz.schedule.zonebot.bid_offered',
  SCHEDULE_ZONEBOT_BID_AWARDED:    'gz.schedule.zonebot.bid_awarded',
  SCHEDULE_ZONEBOT_BID_EXPIRED:    'gz.schedule.zonebot.bid_expired',
  SCHEDULE_COMPLIANCE_VIOLATION:   'gz.schedule.compliance.violation',
  SCHEDULE_COVERAGE_GAP_DETECTED:  'gz.schedule.coverage.gap_detected',
  SCHEDULE_STAT_HOLIDAY_ALERT:     'gz.schedule.stat_holiday.alert',
  SCHEDULE_REMINDER_BLOCK_CUTOFF:  'gz.schedule.reminder.block_cutoff',

  // ── Zone Access (MEMB-001) ─────────────────────────────────────────────────
  ZONE_ACCESS_DENIED:              'zone.access.denied',

  // ── Membership Subscriptions (MEMB-002) ───────────────────────────────────
  MEMBERSHIP_SUBSCRIPTION_CREATED:   'membership.subscription.created',
  MEMBERSHIP_SUBSCRIPTION_CANCELLED: 'membership.subscription.cancelled',
  MEMBERSHIP_SUBSCRIPTION_EXPIRED:   'membership.subscription.expired',

  // ── Membership Stipend (MEMB-003) ─────────────────────────────────────────
  MEMBERSHIP_STIPEND_DISTRIBUTED:    'membership.stipend.distributed',

  // ── Bijou Scheduler (BJ-002) ──────────────────────────────────────────────
  BIJOU_SESSION_SCHEDULED:           'bijou.session.scheduled',
  BIJOU_SESSION_OPENED:              'bijou.session.opened',
  BIJOU_SESSION_CLOSED:              'bijou.session.closed',
  BIJOU_SESSION_CANCELLED:           'bijou.session.cancelled',

  // ── Bijou Admission (BJ-003) ──────────────────────────────────────────────
  BIJOU_ADMISSION_OFFERED:           'bijou.admission.offered',
  BIJOU_ADMISSION_ADMITTED:          'bijou.admission.admitted',
  BIJOU_ADMISSION_STANDBY:           'bijou.admission.standby',
  BIJOU_ADMISSION_EJECTED:           'bijou.admission.ejected',
  BIJOU_ADMISSION_ABANDONED:         'bijou.admission.abandoned',

  // ── Bijou Dwell Credit (BJ-004) ───────────────────────────────────────────
  BIJOU_DWELL_CREDITED:              'bijou.dwell.credited',

  // ── OBS Bridge + Chat Aggregator + Persona Engine (OBS-001) ──────────────
  OBS_STREAM_STARTED:                'obs.stream.started',
  OBS_STREAM_ENDED:                  'obs.stream.ended',
  OBS_STREAM_KEY_ROTATED:            'obs.stream.key.rotated',
  CHAT_MESSAGE_INGESTED:             'chat.message.ingested',
  PERSONA_RESPONSE_QUEUED:           'persona.response.queued',

  // ── GateGuard Sentinel Pre-Processor (Business Plan B.5) ─────────────────
  GATEGUARD_EVALUATION_COMPLETED:    'gateguard.evaluation.completed',
  GATEGUARD_DECISION_APPROVED:       'gateguard.decision.approved',
  GATEGUARD_DECISION_COOLDOWN:       'gateguard.decision.cooldown',
  GATEGUARD_DECISION_HARD_DECLINE:   'gateguard.decision.hard_decline',
  GATEGUARD_DECISION_HUMAN_ESCALATE: 'gateguard.decision.human_escalate',
  GATEGUARD_WELFARE_SIGNAL:          'gateguard.welfare.signal',
  GATEGUARD_AV_CHECK_REQUESTED:      'gateguard.av.check_requested',
  GATEGUARD_AV_CHECK_RETURNED:       'gateguard.av.check_returned',
  GATEGUARD_FEDERATED_LOOKUP:        'gateguard.federated.lookup',
  GATEGUARD_HUMAN_CONTACT_ZONE:      'gateguard.human_contact_zone.escalated',

  // ── Flicker n'Flame Scoring (FFS) — room-level telemetry ──────────
  FFS_SCORE_SAMPLE:                  'ffs.score.sample',
  FFS_SCORE_TIER_CHANGED:            'ffs.score.tier.changed',
  FFS_SCORE_PEAK:                    'ffs.score.peak',
  FFS_SCORE_LEADERBOARD_UPDATED:     'ffs.score.leaderboard.updated',
  FFS_SCORE_HOT_AND_READY:           'ffs.score.hot_and_ready',
  FFS_SCORE_DUAL_FLAME_PEAK:         'ffs.score.dual_flame.peak',
  FFS_SCORE_SESSION_STARTED:         'ffs.score.session.started',
  FFS_SCORE_SESSION_ENDED:           'ffs.score.session.ended',
  FFS_SCORE_ADAPTIVE_UPDATED:        'ffs.score.adaptive.updated',

  // ── CreatorControl.Zone (Business Plan B.3 — creator workstation) ────────
  CREATOR_CONTROL_BROADCAST_SUGGESTION: 'creator_control.broadcast.suggestion',
  CREATOR_CONTROL_SESSION_SUGGESTION:   'creator_control.session.suggestion',
  CREATOR_CONTROL_PRICE_NUDGE:          'creator_control.price.nudge',

  // ── Cyrano Layer 1 (Business Plan B.3.5 — whisper copilot) ───────────────
  CYRANO_SUGGESTION_EMITTED:         'cyrano.suggestion.emitted',
  CYRANO_SUGGESTION_DROPPED:         'cyrano.suggestion.dropped',
  CYRANO_MEMORY_UPDATED:             'cyrano.memory.updated',

  // ── Integration Hub (Business Plan B.3 + B.4 — cross-service wiring) ─────
  HUB_HIGH_HEAT_MONETIZATION:        'hub.high_heat.monetization',
  HUB_PAYOUT_SCALING_APPLIED:        'hub.payout.scaling_applied',
  HUB_DIAMOND_CONCIERGE_HANDOFF:     'hub.diamond_concierge.handoff',

  // ── Refund policy & CS extensions ─────────────────────────────────────────
  REFUND_POLICY_ACKNOWLEDGED:        'refund.policy.acknowledged',
  REFUND_EXTENSION_EXECUTED:         'refund.extension.executed',
  SERVICE_TO_SALE_TRIGGERED:         'refund.service_to_sale.triggered',
  FRIENDLY_FRAUD_SIGNAL_RAISED:      'risk.friendly_fraud.signal_raised',
} as const;

export type NatsTopic = typeof NATS_TOPICS[keyof typeof NATS_TOPICS];
