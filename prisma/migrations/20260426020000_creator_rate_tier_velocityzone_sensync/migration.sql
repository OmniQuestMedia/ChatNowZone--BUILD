-- Migration: 20260426020000_creator_rate_tier_velocityzone_sensync
-- FIZ: Creator Payout Rate Tier + VelocityZone Events + SenSync™ Consent Records
-- REASON: Mic Drop Strategy payout model + VelocityZone admin events + Law 25 consent
-- IMPACT: Three new append-only tables. No existing tables mutated.
-- CORRELATION_ID: CNZ-WORK-001-CREATOR-RATE-TIER

-- ── creator_rate_tiers ────────────────────────────────────────────────────────
CREATE TABLE "creator_rate_tiers" (
  "id"               UUID        NOT NULL DEFAULT gen_random_uuid(),
  "creator_id"       UUID        NOT NULL,
  "cohort"           VARCHAR(30) NOT NULL,
  "rate_floor_usd"   DECIMAL(6,4) NOT NULL,
  "rate_ceiling_usd" DECIMAL(6,4) NOT NULL,
  "effective_from"   TIMESTAMPTZ NOT NULL,
  "effective_until"  TIMESTAMPTZ,
  "correlation_id"   VARCHAR(128) NOT NULL,
  "reason_code"      VARCHAR(100) NOT NULL,
  "rule_applied_id"  VARCHAR(100) NOT NULL DEFAULT 'CREATOR_RATE_TIER_v1',
  "created_at"       TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT "creator_rate_tiers_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "creator_rate_tiers_creator_id_effective_from_idx"
  ON "creator_rate_tiers" ("creator_id", "effective_from");

CREATE INDEX "creator_rate_tiers_cohort_effective_from_idx"
  ON "creator_rate_tiers" ("cohort", "effective_from");

-- ── velocityzone_events ───────────────────────────────────────────────────────
CREATE TABLE "velocityzone_events" (
  "id"              UUID         NOT NULL DEFAULT gen_random_uuid(),
  "label"           VARCHAR(200) NOT NULL,
  "starts_at"       TIMESTAMPTZ  NOT NULL,
  "ends_at"         TIMESTAMPTZ  NOT NULL,
  "rate_floor_usd"  DECIMAL(6,4) NOT NULL,
  "rate_ceil_usd"   DECIMAL(6,4) NOT NULL,
  "is_active"       BOOLEAN      NOT NULL DEFAULT TRUE,
  "correlation_id"  VARCHAR(128) NOT NULL,
  "reason_code"     VARCHAR(100) NOT NULL,
  "rule_applied_id" VARCHAR(100) NOT NULL DEFAULT 'VELOCITYZONE_v1',
  "created_by"      UUID         NOT NULL,
  "created_at"      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  "updated_at"      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

  CONSTRAINT "velocityzone_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "velocityzone_events_starts_at_ends_at_idx"
  ON "velocityzone_events" ("starts_at", "ends_at");

CREATE INDEX "velocityzone_events_is_active_starts_at_idx"
  ON "velocityzone_events" ("is_active", "starts_at");

-- ── sensync_consents ──────────────────────────────────────────────────────────
CREATE TABLE "sensync_consents" (
  "id"               UUID         NOT NULL DEFAULT gen_random_uuid(),
  "creator_id"       UUID         NOT NULL,
  "session_id"       VARCHAR(200) NOT NULL,
  "consent_version"  VARCHAR(20)  NOT NULL,
  "granted_at"       TIMESTAMPTZ  NOT NULL,
  "revoked_at"       TIMESTAMPTZ,
  "device_ids"       JSONB        NOT NULL DEFAULT '[]',
  "correlation_id"   VARCHAR(128) NOT NULL,
  "reason_code"      VARCHAR(100) NOT NULL,
  "created_at"       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

  CONSTRAINT "sensync_consents_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "sensync_consents_creator_id_session_id_idx"
  ON "sensync_consents" ("creator_id", "session_id");

CREATE INDEX "sensync_consents_creator_id_granted_at_idx"
  ON "sensync_consents" ("creator_id", "granted_at");
