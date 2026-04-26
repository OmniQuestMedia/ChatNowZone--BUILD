-- Migration: 20260426000000_czt_single_token_ffs_rename
-- CHORE: Add token_type to wallet_ledger_entries (CZT single-token economy enforcement)
-- FFS: Update room_heat_snapshots default rule_applied_id (Room-Heat → Flicker n'Flame Scoring)

-- Add token_type column to wallet_ledger_entries (single-token economy enforcement)
-- Default is 'CZT' — immutable by application convention (enforced at service layer)
ALTER TABLE "wallet_ledger_entries"
  ADD COLUMN IF NOT EXISTS "token_type" VARCHAR(10) NOT NULL DEFAULT 'CZT';

-- Add index on token_type for audit queries
CREATE INDEX IF NOT EXISTS "wallet_ledger_entries_token_type_idx"
  ON "wallet_ledger_entries" ("token_type");

-- Update default rule_applied_id on room_heat_snapshots to reflect FFS rename
ALTER TABLE "room_heat_snapshots"
  ALTER COLUMN "rule_applied_id" SET DEFAULT 'FFS_ENGINE_v2';

-- Update default rule_applied_id on room_heat_adaptive_weights to reflect FFS rename
ALTER TABLE "room_heat_adaptive_weights"
  ALTER COLUMN "rule_applied_id" SET DEFAULT 'FFS_ADAPTIVE_v1';
