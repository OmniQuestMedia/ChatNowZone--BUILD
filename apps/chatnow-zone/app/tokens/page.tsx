// apps/chatnow-zone/app/tokens/page.tsx
// Wires ui/app/tokens/page.ts (REDBOOK §3 token bundle rate card) into
// Next.js App Router. Pure server-side render — the page builder pulls
// pricing from the canonical REDBOOK_RATE_CARDS constants via
// PublicWalletPresenter, so no API fetch is required.
//
// The pricing presenter recognizes three tiers — GUEST (rack-rate guest
// purchase), MEMBER (any paid VIP tier — silver / gold / platinum), and
// DIAMOND (VIP_DIAMOND volume + velocity quotes). The 6-value
// MembershipTier enum is collapsed onto these three when pricing.
//
// Query parameters:
//   ?tier=<guest|silver|gold|platinum|diamond>   default 'guest'
//                                                 mapped per the table
//                                                 in resolveTier() below
//   ?promoted=<token-bundle-size>                 highlight a specific bundle

import { renderTokensPage } from '@cnz/ui/app/tokens/page';
import type { GuestTier } from '@cnz/ui/types/public-wallet-contracts';
import { renderPlanToReact } from '../../lib/render-plan-to-react';

export const dynamic = 'force-dynamic';

interface SearchParams {
  tier?: string;
  promoted?: string;
}

/**
 * Maps the user-facing 6-value MembershipTier query token to the 3-band
 * pricing GuestTier the presenter consumes:
 *   guest                                 → GUEST
 *   vip / silver / gold / platinum        → MEMBER
 *   diamond                               → DIAMOND
 * Anything unrecognised falls back to GUEST (rack-rate, the safest default).
 */
function resolveTier(raw: string | undefined): GuestTier {
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

function resolvePromoted(raw: string | undefined): number | undefined {
  if (!raw) return undefined;
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : undefined;
}

export default async function TokensPage({
  searchParams,
}: {
  searchParams?: SearchParams | Promise<SearchParams>;
}) {
  const resolved = (await Promise.resolve(searchParams)) ?? {};
  const tier = resolveTier(resolved.tier);
  const promoted = resolvePromoted(resolved.promoted);

  const render = renderTokensPage({
    tier,
    promoted_bundle_tokens: promoted,
  });

  return <>{renderPlanToReact(render.tree)}</>;
}
