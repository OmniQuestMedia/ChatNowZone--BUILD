// services/creator-onboarding/src/dto/pixel-legacy.dto.ts
// PIXEL-LEGACY-001 — request/response shapes for the Pixel Legacy
// onboarding API. Maps onto ui/types/creator-panel-contracts.ts
// (PixelLegacyApplicationView and friends) so the existing UI page
// builder at ui/app/creator/pixel-legacy/page.ts binds 1:1 with no
// presenter translation in the controller.

import type {
  PixelLegacyApplication,
  PixelLegacySeatAllocation,
  PixelLegacyApplicationStatus,
} from '@prisma/client';

/** One portfolio / proof-of-work entry in an application. */
export interface PixelLegacyPortfolioEntryDto {
  entry_id: string;
  label: string;
  url: string;
}

export interface ApplyPixelLegacyDto {
  creator_id: string;
  display_name: string;
  proof_statement: string;
  portfolio_entries: PixelLegacyPortfolioEntryDto[];
  organization_id: string;
  tenant_id: string;
  correlation_id: string;
}

export interface ReviewPixelLegacyDto {
  application_id: string;
  decision: 'GRANT' | 'DENY';
  reviewer_id: string;
  /** Required when decision === 'DENY'; ignored on GRANT. */
  denial_reason_code?: string;
  /** Caller's RBAC role — service enforces COMPLIANCE | ADMIN. */
  caller_role: string;
  organization_id: string;
  tenant_id: string;
  correlation_id: string;
}

export interface PixelLegacyApplicationPublic {
  id: string;
  application_id: string;
  creator_id: string;
  status: PixelLegacyApplicationStatus;
  proof_statement: string;
  portfolio_entries: PixelLegacyPortfolioEntryDto[];
  submitted_at_utc: string | null;
  reviewed_at_utc: string | null;
  reviewed_by: string | null;
  denial_reason_code: string | null;
  correlation_id: string;
  reason_code: string;
  rule_applied_id: string;
  created_at: string;
  updated_at: string;
}

export interface PixelLegacySeatAllocationPublic {
  seat_number: number;
  creator_id: string;
  application_id: string;
  granted_by: string;
  granted_at_utc: string;
  correlation_id: string;
  rule_applied_id: string;
}

export function toApplicationPublic(row: PixelLegacyApplication): PixelLegacyApplicationPublic {
  return {
    id: row.id,
    application_id: row.application_id,
    creator_id: row.creator_id,
    status: row.status,
    proof_statement: row.proof_statement,
    portfolio_entries: (row.portfolio_entries as unknown as PixelLegacyPortfolioEntryDto[]) ?? [],
    submitted_at_utc: row.submitted_at_utc?.toISOString() ?? null,
    reviewed_at_utc: row.reviewed_at_utc?.toISOString() ?? null,
    reviewed_by: row.reviewed_by,
    denial_reason_code: row.denial_reason_code,
    correlation_id: row.correlation_id,
    reason_code: row.reason_code,
    rule_applied_id: row.rule_applied_id,
    created_at: row.created_at.toISOString(),
    updated_at: row.updated_at.toISOString(),
  };
}

export function toSeatAllocationPublic(row: PixelLegacySeatAllocation): PixelLegacySeatAllocationPublic {
  return {
    seat_number: row.seat_number,
    creator_id: row.creator_id,
    application_id: row.application_id,
    granted_by: row.granted_by,
    granted_at_utc: row.granted_at_utc.toISOString(),
    correlation_id: row.correlation_id,
    rule_applied_id: row.rule_applied_id,
  };
}
