-- GOV: + FIZ: legal_holds.correlation_id — closes the §7 remediation item
-- REASON: OQMI Coding Doctrine v2.0 §5.2 invariant — every financial /
--         audit write must carry correlation_id. legal_holds was the
--         single outstanding gap (OQMI_SYSTEM_STATE.md §5.2 + §7).
-- IMPACT: Adds correlation_id VARCHAR(64) NOT NULL to legal_holds with
--         a backfill sentinel for any pre-existing rows. Adds an index
--         for correlation_id lookups. No data is destroyed; no other
--         columns or constraints change. Append-only invariant on
--         legal_holds is preserved (no UPDATE/DELETE on existing rows
--         except the legitimate lift-event partial update, which the
--         existing service already enforces).
-- CORRELATION_ID: LEGAL-HOLD-CORRELATION-ID-MIGRATION-20260428
-- RULE_APPLIED_ID: LEGAL_HOLD_v1

-- ── 1. Add the column nullable so existing rows are not blocked ─────────
ALTER TABLE "legal_holds"
  ADD COLUMN IF NOT EXISTS "correlation_id" VARCHAR(64);

-- ── 2. Backfill any pre-existing rows with a documented sentinel ────────
-- This sentinel is recognised in audits as "row predates the correlation_id
-- enforcement migration" and is never used by the service for new writes.
UPDATE "legal_holds"
   SET "correlation_id" = 'LEGAL_HOLD_PRE_CORRELATION_ID_MIGRATION'
 WHERE "correlation_id" IS NULL;

-- ── 3. Enforce NOT NULL going forward ───────────────────────────────────
ALTER TABLE "legal_holds"
  ALTER COLUMN "correlation_id" SET NOT NULL;

-- ── 4. Index for correlation_id lookups (audit chain replays) ───────────
CREATE INDEX IF NOT EXISTS "legal_holds_correlation_id_idx"
  ON "legal_holds" ("correlation_id");
