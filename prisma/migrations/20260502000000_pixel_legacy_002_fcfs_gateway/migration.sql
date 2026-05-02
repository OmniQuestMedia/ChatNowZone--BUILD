-- FIZ: + GOV: PIXEL-LEGACY-002 — first-come-first-served gateway
-- (supersedes the -001 application model)
--
-- REASON: CEO directive 2026-05-02 — Pixel Legacy is no longer an application
--         process. The first 3,500 creators completing onboarding receive the
--         seat automatically. Marketing cap is 3,000 (UI-displayed); actual
--         gateway closes at 3,500. After 3,500 onboardings, all new creators
--         are STANDARD type. The application table, status enum, and the
--         apply/review service surface are obsolete and removed here.
-- IMPACT: Drops pixel_legacy_applications table and PixelLegacyApplicationStatus
--         enum. Drops the application_id column on pixel_legacy_seat_allocations
--         (applications no longer exist; seat allocations are now triggered by
--         creator-onboarding completion, not by an application_id). Bumps the
--         default rule_applied_id on new seat allocations to PIXEL_LEGACY_v2;
--         existing v1 rows retain their original audit annotation. Keeps the
--         pixel_legacy_seat_allocations table (still the audit trail of grants),
--         the append-only trigger, and the Creator extension fields
--         (creator_type, pixel_legacy_granted_at, lifetime_cyrano_membership).
-- CORRELATION_ID: PIXEL-LEGACY-002-FCFS-GATEWAY-20260502
-- RULE_APPLIED_ID: PIXEL_LEGACY_v2

-- ── Drop the applications table (idempotent) ────────────────────────────
DROP TABLE IF EXISTS "pixel_legacy_applications";

-- ── Drop the now-unused status enum ──────────────────────────────────────
DROP TYPE IF EXISTS "PixelLegacyApplicationStatus";

-- ── Drop application_id from seat allocations ───────────────────────────
-- Seat allocations are now triggered by onboarding completion. The link
-- back to a creator already exists via pixel_legacy_seat_allocations.creator_id.
ALTER TABLE "pixel_legacy_seat_allocations"
  DROP COLUMN IF EXISTS "application_id";

-- ── Bump default rule_applied_id for future allocations to v2 ───────────
-- Existing rows retain their PIXEL_LEGACY_v1 annotation as audit history.
ALTER TABLE "pixel_legacy_seat_allocations"
  ALTER COLUMN "rule_applied_id" SET DEFAULT 'PIXEL_LEGACY_v2';
