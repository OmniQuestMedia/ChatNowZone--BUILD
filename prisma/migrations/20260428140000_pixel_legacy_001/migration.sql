-- FIZ: + GOV: PIXEL-LEGACY-001 — Creator type, 3,500 lifetime seat cap, payout floor
-- REASON: Backend gap — the Pixel Legacy onboarding UI shipped in PR #391
--         binds against PixelLegacyApplicationView with no backing schema.
--         Spec: first 3,500 creator profiles are PIXEL_LEGACY type and earn
--         a guaranteed $0.07 per-token payout floor (vs RATE_COLD $0.075
--         floor for STANDARD creators); they also carry a lifetime Cyrano
--         membership flag honoured by the Cyrano access-policy resolver.
-- IMPACT: Adds CreatorType + PixelLegacyApplicationStatus enums; extends
--         creators with creator_type, pixel_legacy_granted_at,
--         lifetime_cyrano_membership; adds pixel_legacy_applications and
--         pixel_legacy_seat_allocations tables. Seat allocations are
--         append-only (UPDATE/DELETE blocked by trigger) — they are the
--         lifetime audit trail of which creator received which numbered
--         seat. No data destroyed; existing creators default to STANDARD.
--         Every DDL statement is guarded so a partial-failure rerun is safe.
-- CORRELATION_ID: PIXEL-LEGACY-001-INITIAL-MIGRATION-20260428
-- RULE_APPLIED_ID: PIXEL_LEGACY_v1

-- ── Enums (idempotent) ───────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE "CreatorType" AS ENUM ('STANDARD', 'PIXEL_LEGACY');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "PixelLegacyApplicationStatus" AS ENUM (
    'DRAFT', 'APPLIED', 'REVIEWED', 'GRANTED', 'DENIED'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── creators: add creator_type, pixel_legacy_granted_at, lifetime_cyrano ─
ALTER TABLE "creators"
  ADD COLUMN IF NOT EXISTS "creator_type" "CreatorType" NOT NULL DEFAULT 'STANDARD',
  ADD COLUMN IF NOT EXISTS "pixel_legacy_granted_at" TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "lifetime_cyrano_membership" BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS "creators_creator_type_idx"
  ON "creators" ("creator_type");

-- ── pixel_legacy_applications ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "pixel_legacy_applications" (
  "id"                 TEXT                            NOT NULL PRIMARY KEY,
  "application_id"     TEXT                            NOT NULL UNIQUE,
  "creator_id"         TEXT                            NOT NULL UNIQUE,
  "display_name"       VARCHAR(100)                    NOT NULL DEFAULT '',
  "status"             "PixelLegacyApplicationStatus"  NOT NULL DEFAULT 'DRAFT',
  "proof_statement"    TEXT                            NOT NULL DEFAULT '',
  "portfolio_entries"  JSONB                           NOT NULL DEFAULT '[]'::jsonb,
  "submitted_at_utc"   TIMESTAMPTZ,
  "reviewed_at_utc"    TIMESTAMPTZ,
  "reviewed_by"        VARCHAR(100),
  "denial_reason_code" VARCHAR(64),
  "organization_id"    VARCHAR(100)                    NOT NULL,
  "tenant_id"          VARCHAR(100)                    NOT NULL,
  "correlation_id"     VARCHAR(64)                     NOT NULL,
  "reason_code"        VARCHAR(64)                     NOT NULL,
  "rule_applied_id"    VARCHAR(100)                    NOT NULL DEFAULT 'PIXEL_LEGACY_v1',
  "created_at"         TIMESTAMPTZ                     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"         TIMESTAMPTZ                     NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "pixel_legacy_applications_creator_fk"
    FOREIGN KEY ("creator_id") REFERENCES "creators" ("id") ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS "pixel_legacy_applications_status_idx"
  ON "pixel_legacy_applications" ("status");

CREATE INDEX IF NOT EXISTS "pixel_legacy_applications_correlation_id_idx"
  ON "pixel_legacy_applications" ("correlation_id");

-- ── pixel_legacy_seat_allocations (append-only audit trail) ──────────────
CREATE TABLE IF NOT EXISTS "pixel_legacy_seat_allocations" (
  "id"               TEXT         NOT NULL PRIMARY KEY,
  -- 1..3500. Application-enforced range; unique for atomic allocation.
  "seat_number"      INTEGER      NOT NULL UNIQUE
                                  CHECK ("seat_number" BETWEEN 1 AND 3500),
  "creator_id"       TEXT         NOT NULL UNIQUE,
  "application_id"   TEXT         NOT NULL,
  "granted_by"       VARCHAR(100) NOT NULL,
  "granted_at_utc"   TIMESTAMPTZ  NOT NULL,
  "organization_id"  VARCHAR(100) NOT NULL,
  "tenant_id"        VARCHAR(100) NOT NULL,
  "correlation_id"   VARCHAR(64)  NOT NULL,
  "reason_code"      VARCHAR(64)  NOT NULL DEFAULT 'PIXEL_LEGACY_SEAT_GRANTED',
  "rule_applied_id"  VARCHAR(100) NOT NULL DEFAULT 'PIXEL_LEGACY_v1',
  "created_at"       TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "pixel_legacy_seat_allocations_creator_fk"
    FOREIGN KEY ("creator_id") REFERENCES "creators" ("id") ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS "pixel_legacy_seat_allocations_correlation_id_idx"
  ON "pixel_legacy_seat_allocations" ("correlation_id");

CREATE INDEX IF NOT EXISTS "pixel_legacy_seat_allocations_granted_at_utc_idx"
  ON "pixel_legacy_seat_allocations" ("granted_at_utc");

-- ── Append-only enforcement on pixel_legacy_seat_allocations ─────────────
-- Seat allocations represent a permanent assignment of one of 3,500 lifetime
-- Pixel Legacy creator seats. Once a row is written, it cannot be modified
-- or deleted — that's the audit invariant for the cap.

CREATE OR REPLACE FUNCTION "fn_pixel_legacy_seat_allocations_block_update_delete"()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    RAISE EXCEPTION 'pixel_legacy_seat_allocations is append-only — UPDATE blocked (PIXEL_LEGACY_v1 invariant)';
  ELSIF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'pixel_legacy_seat_allocations is append-only — DELETE blocked (PIXEL_LEGACY_v1 invariant)';
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "trg_pixel_legacy_seat_allocations_no_update"
  ON "pixel_legacy_seat_allocations";
CREATE TRIGGER "trg_pixel_legacy_seat_allocations_no_update"
BEFORE UPDATE ON "pixel_legacy_seat_allocations"
FOR EACH ROW EXECUTE FUNCTION "fn_pixel_legacy_seat_allocations_block_update_delete"();

DROP TRIGGER IF EXISTS "trg_pixel_legacy_seat_allocations_no_delete"
  ON "pixel_legacy_seat_allocations";
CREATE TRIGGER "trg_pixel_legacy_seat_allocations_no_delete"
BEFORE DELETE ON "pixel_legacy_seat_allocations"
FOR EACH ROW EXECUTE FUNCTION "fn_pixel_legacy_seat_allocations_block_update_delete"();
