// apps/chatnow-zone/app/tokens/page.tsx
// Wires ui/app/tokens/page.ts (REDBOOK §3 token bundle rate card) into
// Next.js App Router. Pure server-side render — the page builder pulls
// pricing from the canonical REDBOOK_RATE_CARDS constants via
// PublicWalletPresenter, so no API fetch is required.
//
// The pricing presenter recognizes three tiers — GUEST (rack-rate guest
// purchase), MEMBER (any paid VIP tier — vip / silver / gold / platinum),
// and DIAMOND (VIP_DIAMOND volume + velocity quotes). The 6-value
// MembershipTier enum is collapsed onto these three when pricing.
//
// Query parameters:
//   ?tier=<guest|vip|silver|gold|platinum|diamond>   default 'guest'
//                                                     mapped per the table
//                                                     in lib/resolve-tier.ts
//   ?promoted=<token-bundle-size>                     highlight a specific bundle

import { renderTokensPage } from '@cnz/ui/app/tokens/page';
import { renderPlanToReact } from '../../lib/render-plan-to-react';
import { resolveTier } from '../../lib/resolve-tier';

export const dynamic = 'force-dynamic';

interface SearchParams {
  tier?: string;
  promoted?: string;
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
