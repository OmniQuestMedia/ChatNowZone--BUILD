// apps/chatnow-zone/app/diamond/purchase/page.tsx
// Wires ui/app/diamond/purchase/page.ts (Diamond Tier purchase quote) into
// Next.js App Router. The page builder computes the volume + velocity
// quote from DIAMOND_TIER constants, so no API fetch is required.
//
// Query parameters:
//   ?tokens=<count>            CZT volume to quote (default 10_000)
//   ?velocity_days=<days>      lifespan in days (default 30; range 14..366)

import { renderDiamondPurchasePage } from '@cnz/ui/app/diamond/purchase/page';
import { renderPlanToReact } from '../../../lib/render-plan-to-react';

export const dynamic = 'force-dynamic';

interface SearchParams {
  tokens?: string;
  velocity_days?: string;
}

function resolveTokens(raw: string | undefined): number {
  if (!raw) return 10_000;
  const n = Number(raw);
  return Number.isInteger(n) && n >= 10_000 ? n : 10_000;
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
