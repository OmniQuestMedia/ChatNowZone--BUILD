-- PAYLOAD 10 — Backend Closure (FIZ + GOV)
-- Authority: Kevin B. Hartley (CEO) — pending sign-off in PROGRAM_CONTROL/CLEARANCES/.
-- Scope:
--   1. transactions: heat_score_at_tip, payout_rate_applied, diamond_floor_active,
--      payout_rate_lock_id, risk_decision_id, correlation_id, reason_code (PAY-006/011)
--   2. risk_assessments: Diamond Concierge intake risk fields (DIA-003 / DIA-004)
--   3. NEW risk_engine_decisions table — Risk Engine (D002) append-only audit log
--   4. NEW payout_rate_locks table — FairPay rate lock (PAY-006) append-only
--   5. NEW ZoneAccessZone enum value: CYRANO_LAYER2 (CYR-003 alignment)
--   6. Append-only triggers on risk_engine_decisions + payout_rate_locks
--
-- Invariants honoured:
--   • All financial / audit writes carry correlation_id + reason_code + rule_applied_id.
--   • Append-only (no UPDATE / DELETE) on the new audit-class tables.
--   • CZT-only economy preserved.
--   • Idempotent — uses IF NOT EXISTS where applicable.

-- 1. transactions extension --------------------------------------------------
ALTER TABLE "transactions"
  ADD COLUMN IF NOT EXISTS "heat_score_at_tip"   INT,
  ADD COLUMN IF NOT EXISTS "payout_rate_applied" DECIMAL(8,6),
  ADD COLUMN IF NOT EXISTS "diamond_floor_active" BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS "payout_rate_lock_id" UUID,
  ADD COLUMN IF NOT EXISTS "risk_decision_id"    UUID,
  ADD COLUMN IF NOT EXISTS "correlation_id"      VARCHAR(128),
  ADD COLUMN IF NOT EXISTS "reason_code"         VARCHAR(64);

CREATE INDEX IF NOT EXISTS "transactions_heat_score_at_tip_idx"
  ON "transactions" ("heat_score_at_tip");
CREATE INDEX IF NOT EXISTS "transactions_payout_rate_lock_id_idx"
  ON "transactions" ("payout_rate_lock_id");
CREATE INDEX IF NOT EXISTS "transactions_risk_decision_id_idx"
  ON "transactions" ("risk_decision_id");

-- 2. risk_assessments extension (DIA-003 / DIA-004) -------------------------
ALTER TABLE "risk_assessments"
  ADD COLUMN IF NOT EXISTS "intoxication_flag"      BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS "belligerence_flag"      BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS "coercion_flag"          BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS "duress_flag"            BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS "account_signal_snapshot" JSONB,
  ADD COLUMN IF NOT EXISTS "go_no_go_decision"      VARCHAR(20),
  ADD COLUMN IF NOT EXISTS "modified_amount"        DECIMAL(12,2),
  ADD COLUMN IF NOT EXISTS "agent_id"               UUID,
  ADD COLUMN IF NOT EXISTS "assessment_timestamp"   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "correlation_id"         VARCHAR(128),
  ADD COLUMN IF NOT EXISTS "reason_code"            VARCHAR(100),
  ADD COLUMN IF NOT EXISTS "rule_applied_id"        VARCHAR(100);

ALTER TABLE "risk_assessments"
  DROP CONSTRAINT IF EXISTS "risk_assessments_go_no_go_decision_check";
ALTER TABLE "risk_assessments"
  ADD CONSTRAINT "risk_assessments_go_no_go_decision_check"
  CHECK ("go_no_go_decision" IS NULL OR "go_no_go_decision" IN
         ('APPROVE','MODIFY','DEFER','DECLINE'));

CREATE INDEX IF NOT EXISTS "risk_assessments_go_no_go_decision_idx"
  ON "risk_assessments" ("go_no_go_decision");
CREATE INDEX IF NOT EXISTS "risk_assessments_agent_id_idx"
  ON "risk_assessments" ("agent_id");

-- 3. risk_engine_decisions (Risk Engine D002 — append-only) ----------------
CREATE TABLE IF NOT EXISTS "risk_engine_decisions" (
  "id"                UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
  "correlation_id"    VARCHAR(128)    NOT NULL UNIQUE,
  "subject_user_id"   UUID            NOT NULL,
  "intent"            VARCHAR(40)     NOT NULL,
  "composite_score"   INT             NOT NULL,
  "tier"              VARCHAR(20)     NOT NULL,
  "signal_breakdown"  JSONB           NOT NULL,
  "decision"          VARCHAR(20)     NOT NULL,
  "reason_codes"      JSONB           NOT NULL DEFAULT '[]'::jsonb,
  "agent_id"          UUID,
  "reason_code"       VARCHAR(100)    NOT NULL,
  "rule_applied_id"   VARCHAR(100)    NOT NULL DEFAULT 'RISK_ENGINE_v1',
  "evaluated_at"      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  CONSTRAINT "risk_engine_decisions_tier_check"
    CHECK ("tier" IN ('GREEN','AMBER','RED','CRITICAL')),
  CONSTRAINT "risk_engine_decisions_decision_check"
    CHECK ("decision" IN ('PASS','REVIEW','BLOCK','ESCALATE')),
  CONSTRAINT "risk_engine_decisions_score_check"
    CHECK ("composite_score" BETWEEN 0 AND 100)
);

CREATE INDEX IF NOT EXISTS "risk_engine_decisions_subject_user_id_idx"
  ON "risk_engine_decisions" ("subject_user_id", "evaluated_at");
CREATE INDEX IF NOT EXISTS "risk_engine_decisions_tier_idx"
  ON "risk_engine_decisions" ("tier");
CREATE INDEX IF NOT EXISTS "risk_engine_decisions_decision_idx"
  ON "risk_engine_decisions" ("decision");

-- Append-only enforcement: refuse UPDATE / DELETE on risk_engine_decisions.
CREATE OR REPLACE FUNCTION "risk_engine_decisions_no_mutation"()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'risk_engine_decisions is append-only — UPDATE/DELETE refused (op=%, id=%)',
    TG_OP, COALESCE(OLD."id"::text, '');
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "risk_engine_decisions_no_update" ON "risk_engine_decisions";
CREATE TRIGGER "risk_engine_decisions_no_update"
  BEFORE UPDATE ON "risk_engine_decisions"
  FOR EACH ROW EXECUTE FUNCTION "risk_engine_decisions_no_mutation"();

DROP TRIGGER IF EXISTS "risk_engine_decisions_no_delete" ON "risk_engine_decisions";
CREATE TRIGGER "risk_engine_decisions_no_delete"
  BEFORE DELETE ON "risk_engine_decisions"
  FOR EACH ROW EXECUTE FUNCTION "risk_engine_decisions_no_mutation"();

-- 4. payout_rate_locks (FairPay PAY-006 — append-only) ---------------------
CREATE TABLE IF NOT EXISTS "payout_rate_locks" (
  "id"                        UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
  "correlation_id"            VARCHAR(128)    NOT NULL UNIQUE,
  "transaction_id"            UUID,
  "wallet_id"                 VARCHAR(128)    NOT NULL,
  "creator_id"                UUID            NOT NULL,
  "heat_score"                INT             NOT NULL,
  "heat_tier"                 VARCHAR(20)     NOT NULL,
  "rate_per_token_usd"        DECIMAL(8,6)    NOT NULL,
  "diamond_floor_active"      BOOLEAN         NOT NULL DEFAULT FALSE,
  "pixel_legacy_floor_active" BOOLEAN         NOT NULL DEFAULT FALSE,
  "floor_applied"             BOOLEAN         NOT NULL DEFAULT FALSE,
  "amount_czt"                INT             NOT NULL,
  "reason_code"               VARCHAR(64)     NOT NULL DEFAULT 'PAYOUT_RATE_LOCKED',
  "rule_applied_id"           VARCHAR(100)    NOT NULL DEFAULT 'FAIRPAY_RATE_LOCK_v1',
  "organization_id"           VARCHAR(100)    NOT NULL,
  "tenant_id"                 VARCHAR(100)    NOT NULL,
  "locked_at"                 TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  CONSTRAINT "payout_rate_locks_heat_tier_check"
    CHECK ("heat_tier" IN ('COLD','WARM','HOT','INFERNO')),
  CONSTRAINT "payout_rate_locks_heat_score_check"
    CHECK ("heat_score" BETWEEN 0 AND 100),
  CONSTRAINT "payout_rate_locks_rate_check"
    CHECK ("rate_per_token_usd" > 0)
);

CREATE INDEX IF NOT EXISTS "payout_rate_locks_creator_id_idx"
  ON "payout_rate_locks" ("creator_id", "locked_at");
CREATE INDEX IF NOT EXISTS "payout_rate_locks_transaction_id_idx"
  ON "payout_rate_locks" ("transaction_id");

CREATE OR REPLACE FUNCTION "payout_rate_locks_no_mutation"()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'payout_rate_locks is append-only — UPDATE/DELETE refused (op=%, id=%)',
    TG_OP, COALESCE(OLD."id"::text, '');
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "payout_rate_locks_no_update" ON "payout_rate_locks";
CREATE TRIGGER "payout_rate_locks_no_update"
  BEFORE UPDATE ON "payout_rate_locks"
  FOR EACH ROW EXECUTE FUNCTION "payout_rate_locks_no_mutation"();

DROP TRIGGER IF EXISTS "payout_rate_locks_no_delete" ON "payout_rate_locks";
CREATE TRIGGER "payout_rate_locks_no_delete"
  BEFORE DELETE ON "payout_rate_locks"
  FOR EACH ROW EXECUTE FUNCTION "payout_rate_locks_no_mutation"();

-- 5. ZoneAccessZone enum extension (CYR-003 alignment) ---------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum
    WHERE enumlabel = 'CYRANO_LAYER2'
      AND enumtypid = (
        SELECT oid FROM pg_type WHERE typname = 'ZoneAccessZone'
      )
  ) THEN
    ALTER TYPE "ZoneAccessZone" ADD VALUE 'CYRANO_LAYER2';
  END IF;
END $$;
