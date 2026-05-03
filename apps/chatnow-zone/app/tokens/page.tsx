// apps/chatnow-zone/app/tokens/page.tsx
// Wires ui/app/tokens/page.ts (REDBOOK §3 token bundle rate card) into
// Next.js App Router. Pure server-side render — the page builder pulls
// pricing from the canonical REDBOOK_RATE_CARDS constants via
// PublicWalletPresenter, so no API fetch is required.
//
// Query parameters:
//   ?tier=<guest|silver|gold|platinum|diamond>   default 'guest'
//   ?promoted=<token-bundle-size>                 highlight a specific bundle

import { renderTokensPage } from '@cnz/ui/app/tokens/page';
import { renderPlanToReact } from '../../lib/render-plan-to-react';

export const dynamic = 'force-dynamic';

type GuestTier = 'guest' | 'silver' | 'gold' | 'platinum' | 'diamond';
const ALLOWED_TIERS: readonly GuestTier[] = ['guest', 'silver', 'gold', 'platinum', 'diamond'];

interface SearchParams {
  tier?: string;
  promoted?: string;
}

function resolveTier(raw: string | undefined): GuestTier {
  if (raw && (ALLOWED_TIERS as readonly string[]).includes(raw)) {
    return raw as GuestTier;
  }
  return 'guest';
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
