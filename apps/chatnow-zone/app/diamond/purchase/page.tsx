// apps/chatnow-zone/app/diamond/purchase/page.tsx
// Wires ui/app/diamond/purchase/page.ts (Diamond Tier purchase quote) into
// Next.js App Router. The page builder computes the volume + velocity
// quote from DIAMOND_TIER constants via PublicWalletPresenter, so no API
// fetch is required.
//
// The Diamond entry threshold (minimum tokens to qualify) is derived from
// DEFAULT_GOVERNANCE_SNAPSHOT.diamond_volume_tiers[0].min_tokens — the same
// value the presenter enforces. Hard-coding the floor here would drift
// silently if REDBOOK is re-tuned.
//
// Query parameters:
//   ?tokens=<count>            CZT volume to quote (default = entry threshold)
//   ?velocity_days=<days>      lifespan in days (default 30; range 14..366)

import { renderDiamondPurchasePage } from '@cnz/ui/app/diamond/purchase/page';
import { DEFAULT_GOVERNANCE_SNAPSHOT } from '@cnz/ui/view-models/public-wallet.presenter';
import { renderPlanToReact } from '../../../lib/render-plan-to-react';

export const dynamic = 'force-dynamic';

const DIAMOND_MIN_TOKENS = DEFAULT_GOVERNANCE_SNAPSHOT.diamond_volume_tiers[0].min_tokens;

interface SearchParams {
  tokens?: string;
  velocity_days?: string;
}

function resolveTokens(raw: string | undefined): number {
  if (!raw) return DIAMOND_MIN_TOKENS;
  const n = Number(raw);
  return Number.isInteger(n) && n >= DIAMOND_MIN_TOKENS ? n : DIAMOND_MIN_TOKENS;
}

function resolveVelocity(raw: string | undefined): number {
  if (!raw) return 30;
  const n = Number(raw);
  if (!Number.isInteger(n)) return 30;
  if (n < 14) return 14;
  if (n > 366) return 366;
  return n;
}

export default async function DiamondPurchasePage({
  searchParams,
}: {
  searchParams?: SearchParams | Promise<SearchParams>;
}) {
  const resolved = (await Promise.resolve(searchParams)) ?? {};
  const tokens = resolveTokens(resolved.tokens);
  const velocity_days = resolveVelocity(resolved.velocity_days);

  let render;
  try {
    render = renderDiamondPurchasePage({ tokens, velocity_days });
  } catch (err) {
    return (
      <main style={{ padding: 32, maxWidth: 640, margin: '0 auto' }}>
        <h1>Diamond Tier Purchase</h1>
        <p style={{ color: '#ff6b6b' }}>
          Could not generate Diamond quote for tokens=<code>{tokens}</code>{' '}
          velocity_days=<code>{velocity_days}</code>.
        </p>
        <pre style={{ color: '#a8a8b0', fontSize: 12, whiteSpace: 'pre-wrap' }}>
          {err instanceof Error ? err.message : String(err)}
        </pre>
      </main>
    );
  }

  return <>{renderPlanToReact(render.tree)}</>;
}
