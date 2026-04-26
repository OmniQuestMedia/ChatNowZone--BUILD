// FIZ: PAYLOAD-001 — Canonical Financial Ledger types
// All identifiers, reason codes, bucket names, and rate-card tier names consumed
// across services/ledger/*. Mirrors the Prisma models added in 20260424000000.

/**
 * LedgerBucket — the canonical three-bucket wallet partitioning.
 * Spend order is enforced by governance.config.LEDGER_SPEND_ORDER.
 */
export const BUCKETS = ['purchased', 'membership', 'bonus'] as const;
export type LedgerBucket = (typeof BUCKETS)[number];

/**
 * UserType for wallet owners. Drives rate-card selection (member vs guest).
 */
export type UserType = 'guest' | 'creator' | 'diamond';

/**
 * Reason codes — mandatory on every ledger entry. Narrowing this union prevents
 * free-form strings from landing in the append-only log.
 */
export type ReasonCode =
  | 'PURCHASE'
  | 'SPEND'
  | 'PAYOUT'
  | 'EXPIRY_RECOVERY'
  | 'EXPIRY_REDISTRIBUTION'
  | 'TOKEN_BRIDGE'
  | 'THREE_FIFTHS_EXIT'
  | 'EXTENSION_FEE'
  | 'MEMBERSHIP_STIPEND'
  | 'BONUS_GRANT'
  | 'REFUND';

/**
 * Rate card tiers (REDBOOK §3). Tease Regular / Diamond Floor / VIP.
 * Note: tease_showzone is deprecated — ShowZone service removed post-April 2026.
 */
export type RateCardTier =
  | 'tease_regular'
  | 'tease_showzone'  // @deprecated — ShowZone service deprecated; use tease_regular
 * Note: tease_showzone is @deprecated — ShowZone service removed (CNZ-WORK-001 Section 1).
 * Retained in type union for backward compat with deprecated quoteTeaseShowzone().
 */
export type RateCardTier =
  | 'tease_regular'
  | 'tease_showzone'    // @deprecated — ShowZone service removed
  | 'diamond_floor'
  | 'vip_baseline';

/**
 * Heat levels — Flicker n'Flame Scoring (FFS) output (PAY-001…005). Drives creator payout per
 * token via governance.config.GovernanceConfig.RATE_* bands.
 */
export type HeatLevel = 'cold' | 'warm' | 'hot' | 'inferno';

/**
 * TokenExpirationStatus — lifecycle of a token-lot inside a Diamond wallet.
 */
export type TokenExpirationStatus = 'active' | 'expired' | 'recovered' | 'extended';

/**
 * RecoveryAction — enumerates every Unified CS workflow exposed by the Recovery
 * Engine (REDBOOK §5).
 */
export type RecoveryAction =
  | 'WARN_48H'                  // pre-expiry warning notification
  | 'EXTEND'                    // $49 extension, +14 days
  | 'RECOVER'                   // $79 recovery of expired balance
  | 'TOKEN_BRIDGE'              // 20% bonus credit + waiver
  | 'THREE_FIFTHS_EXIT'         // 60% refund + 24h lock
  | 'REDISTRIBUTE';             // 70/30 creator-pool / platform split on pure expiry

// ── Value types carried across service boundaries ───────────────────────────

export interface LedgerEntryInput {
  walletId: string;
  correlationId: string;            // idempotency key
  reasonCode: ReasonCode;
  amount: number;                   // signed: +credit, -debit
  bucket: LedgerBucket;
  metadata?: Record<string, unknown>;
}

export interface LedgerEntry extends LedgerEntryInput {
  id: string;
  hashPrev: string | null;
  hashCurrent: string;
  createdAt: Date;
}

export interface WalletSnapshot {
  id: string;
  userId: string;
  userType: UserType;
  purchasedTokens: number;
  membershipTokens: number;
  bonusTokens: number;
  totalTokens: number;              // virtual: sum of three buckets
  lastUpdated: Date;
}

export interface SpendResult {
  entries: LedgerEntry[];           // one entry per bucket touched
  totalDebited: number;
  breakdown: Record<LedgerBucket, number>;
}

export interface TokenExpirationRecord {
  id: string;
  walletId: string;
  tokens: number;
  expiresAt: Date;
  status: TokenExpirationStatus;
  recoveryFee?: number;
  createdAt: Date;
}

// Error classes — stable names for service consumers to assert against.
export class LedgerError extends Error {
  constructor(public readonly code: string, message: string) {
    super(`${code}: ${message}`);
    this.name = 'LedgerError';
  }
}

export class InsufficientBalanceError extends LedgerError {
  constructor(shortfall: number, walletId: string) {
    super(
      'INSUFFICIENT_BALANCE',
      `Wallet ${walletId} cannot cover spend — shortfall ${shortfall} tokens across all three buckets.`,
    );
  }
}

export class IdempotencyReplayError extends LedgerError {
  constructor(correlationId: string) {
    super('IDEMPOTENCY_REPLAY', `correlation_id ${correlationId} already applied.`);
  }
}

export class HashChainBrokenError extends LedgerError {
  constructor(walletId: string, atEntryId: string) {
    super(
      'HASH_CHAIN_BROKEN',
      `Wallet ${walletId} ledger integrity failed at entry ${atEntryId}.`,
    );
  }
}
