-- FIZ: legal_holds append-only trigger — closes Wave H §7 remediation
-- REASON: OQMI Coding Doctrine v2.0 §5.2 / Canonical Corpus §7 — every
--         compliance write must be append-only at the Postgres tier, not
--         only at the service tier. legal_holds had correlation_id (added
--         2026-04-28) but the DB-level mutation guard was still missing.
-- IMPACT: Adds a BEFORE UPDATE OR DELETE trigger that blocks DELETE on
--         legal_holds and restricts UPDATE to the single permitted lift
--         transition: (lifted_by, lifted_at_utc) for un-lifted rows only,
--         mirroring services/core-api/src/compliance/legal-hold.service.ts.
--         An optional supporting subject index is added if missing. No
--         data is modified.
-- CORRELATION_ID: LEGAL-HOLDS-APPEND-ONLY-TRIGGER-20260503
-- RULE_APPLIED_ID: LEGAL_HOLD_v1

-- ── 1. Supporting index for subject lookups (no-op if already created) ──
CREATE INDEX IF NOT EXISTS "legal_holds_subject_idx"
  ON "legal_holds" ("subject_type", "subject_id");

-- ── 2. Append-only / lift-transition guard function ─────────────────────
CREATE OR REPLACE FUNCTION legal_holds_guard_mutation()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION
            'legal_holds is append-only: DELETE is not permitted (hold_id=%).',
            OLD.hold_id;
    END IF;

    IF TG_OP = 'UPDATE' THEN
        IF OLD.lifted_at_utc IS NOT NULL THEN
            RAISE EXCEPTION
                'legal_holds is append-only: UPDATE on already-lifted hold is not permitted (hold_id=%).',
                OLD.hold_id;
        END IF;

        IF NEW.id IS DISTINCT FROM OLD.id
            OR NEW.hold_id IS DISTINCT FROM OLD.hold_id
            OR NEW.subject_id IS DISTINCT FROM OLD.subject_id
            OR NEW.subject_type IS DISTINCT FROM OLD.subject_type
            OR NEW.applied_by IS DISTINCT FROM OLD.applied_by
            OR NEW.applied_at_utc IS DISTINCT FROM OLD.applied_at_utc
            OR NEW.reason_code IS DISTINCT FROM OLD.reason_code
            OR NEW.correlation_id IS DISTINCT FROM OLD.correlation_id
            OR NEW.rule_applied_id IS DISTINCT FROM OLD.rule_applied_id
            OR NEW.created_at IS DISTINCT FROM OLD.created_at
        THEN
            RAISE EXCEPTION
                'legal_holds is append-only: only (lifted_by, lifted_at_utc) may be updated (hold_id=%).',
                OLD.hold_id;
        END IF;

        IF NEW.lifted_by IS NULL OR NEW.lifted_at_utc IS NULL THEN
            RAISE EXCEPTION
                'legal_holds: lift transition requires both lifted_by and lifted_at_utc (hold_id=%).',
                OLD.hold_id;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ── 3. Install (idempotent) the BEFORE UPDATE OR DELETE trigger ─────────
DROP TRIGGER IF EXISTS trg_legal_holds_guard_mutation ON "legal_holds";
CREATE TRIGGER trg_legal_holds_guard_mutation
BEFORE UPDATE OR DELETE ON "legal_holds"
FOR EACH ROW EXECUTE FUNCTION legal_holds_guard_mutation();
