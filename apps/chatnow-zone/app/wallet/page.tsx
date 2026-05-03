// apps/chatnow-zone/app/wallet/page.tsx
// Wires ui/app/wallet/page.ts (three-bucket wallet view) into Next.js App
// Router.
//
// STUB POSTURE — Alpha bootstrap:
//   No wallet read endpoint exists in the core API yet (search of
//   services/core-api/src for @Get/@Controller against wallet/balance turned
//   up zero). The LedgerService is present but not exposed via HTTP. To
//   give testers a clickable layout, this route synthesises plausible
//   balances and renders the page with a clear "demo data" banner.
//
// Wiring to real data is a follow-up directive (WALLET-READ-API-001):
//   1. Add GET /api/wallet/:user_id to core-api
//   2. Replace the synthetic block here with a fetch + parse
//   3. Remove the demo-data banner
//
// The wallet presenter recognizes three tiers — GUEST, MEMBER (any paid
// VIP), DIAMOND. The 6-value MembershipTier enum is collapsed onto these
// three when rendering. The is_vip_diamond flag is derived from
// tier === 'DIAMOND' against the contract enum value.
//
// Query parameters (interim, will move to req.user once auth lands):
//   ?user=<user_id>            user id (placeholder routing only)
//   ?tier=<guest|silver|gold|platinum|diamond>  default 'guest';
//                                                mapped per resolveTier()
//   ?welfare_score=<0..100>    drives Welfare Guardian band colour

import { renderWalletPage } from '@cnz/ui/app/wallet/page';
import type { GuestTier } from '@cnz/ui/types/public-wallet-contracts';
import { renderPlanToReact } from '../../lib/render-plan-to-react';

export const dynamic = 'force-dynamic';

interface SearchParams {
  user?: string;
  tier?: string;
  welfare_score?: string;
}

/**
 * Maps the user-facing 6-value MembershipTier query token to the 3-band
 * GuestTier the presenter consumes. See tokens/page.tsx for the full table.
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

function resolveScore(raw: string | undefined): number | undefined {
  if (raw == null) return undefined;
  const n = Number(raw);
  if (!Number.isFinite(n)) return undefined;
  if (n < 0) return 0;
  if (n > 100) return 100;
  return n;
}

/** Synthetic balances for the bootstrap stub — clearly demo data. */
const SYNTHETIC_BALANCES = {
  purchased: 1_500n,
  membership: 250n,
  bonus: 75n,
};

export default async function WalletPage({
  searchParams,
}: {
  searchParams?: SearchParams | Promise<SearchParams>;
}) {
  const resolved = (await Promise.resolve(searchParams)) ?? {};
  const userId = resolved.user?.trim() || 'demo-user';
  const tier = resolveTier(resolved.tier);
  const welfareScore = resolveScore(resolved.welfare_score);

  const render = renderWalletPage({
    wallet_id: `wallet:${userId}`,
    user_id: userId,
    tier,
    balances: SYNTHETIC_BALANCES,
    welfare_score: welfareScore,
    is_vip_diamond: tier === 'DIAMOND',
  });

  return (
    <>
      <div
        data-testid="wallet-demo-data-banner"
        style={{
          background: '#3a2a00',
          color: '#ffd66b',
          padding: '8px 16px',
          textAlign: 'center',
          fontSize: 12,
          borderBottom: '1px solid #5a4200',
        }}
      >
        Demo data — wallet read endpoint not yet wired (WALLET-READ-API-001 follow-up).
        Balances shown are synthetic.
      </div>
      {renderPlanToReact(render.tree)}
    </>
  );
}
