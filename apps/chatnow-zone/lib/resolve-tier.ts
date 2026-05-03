// apps/chatnow-zone/lib/resolve-tier.ts
// Shared mapping from the user-facing 6-value MembershipTier query token
// to the 3-band pricing GuestTier ('GUEST' | 'MEMBER' | 'DIAMOND') the
// PublicWalletPresenter consumes. Centralised here so the table doesn't
// drift across routes.
//
// Mapping table:
//   guest                                 → GUEST   (rack-rate)
//   vip / silver / gold / platinum        → MEMBER  (paid-tier pricing)
//   diamond                               → DIAMOND (volume/velocity)
//   anything else (unknown / undefined)   → GUEST   (safest default)

import type { GuestTier } from '@cnz/ui/types/public-wallet-contracts';

export function resolveTier(raw: string | undefined): GuestTier {
  switch (raw?.trim().toLowerCase()) {
    case 'diamond':
      return 'DIAMOND';
    case 'vip':
    case 'silver':
    case 'gold':
    case 'platinum':
      return 'MEMBER';
    case 'guest':
    case undefined:
    case '':
      return 'GUEST';
    default:
      return 'GUEST';
  }
}
