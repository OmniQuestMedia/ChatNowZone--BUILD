# `chatnow-zone` — Next.js storefront

Primary Next.js app for ChatNow.Zone. Hosts the page builders defined in
`ui/app/*` behind real routes, fetches data from the core API, and renders
the result via the framework-agnostic `RenderElement` adapter.

## Local

```bash
cd apps/chatnow-zone
yarn install              # workspace-local; root yarn.lock not used yet
yarn dev                  # http://localhost:3200
```

`CNZ_CORE_API_URL` (default `http://localhost:3000`) is the core API base
that `/api/*` requests proxy to.

## Adding a new route

The page builders in `ui/app/*` are framework-agnostic — each export takes
inputs and returns a `RenderElement` tree. To wire a new builder into
Next.js:

1. **Create the route file** at the matching path under `app/`:

   ```
   ui/app/wallet/page.ts                  →  app/wallet/page.tsx
   ui/app/admin/diamond/page.ts           →  app/admin/diamond/page.tsx
   ```

2. **Build the view** that the page builder consumes. If the API surface
   doesn't return the full view shape directly, write a presenter helper
   in `lib/<surface>-presenter.ts` that fetches from `/api/...` and
   composes the view (see `lib/pixel-legacy-presenter.ts`).

3. **Render with `renderPlanToReact`**:

   ```tsx
   import { renderWalletPage } from '@cnz/ui/app/wallet/page';
   import { renderPlanToReact } from '../../lib/render-plan-to-react';

   export default async function WalletPage() {
     const view = await buildWalletView(...);
     const render = renderWalletPage({ view });
     return <>{renderPlanToReact(render.tree)}</>;
   }
   ```

4. **Auth + identity** is interim. Until the platform auth middleware is
   wired (tracked under PIXEL-LEGACY-006 + companion directives across the
   creator-onboarding controllers), reads pull identity from the `creator`
   query param. Once the middleware lands, the route file is the seam where
   we replace `searchParams.creator` with `headers().get('x-user-id')` or a
   session cookie read.

## Wired routes (Alpha bootstrap)

| Route                   | Page builder                          | Notes                                                                                                                                                                                 |
| ----------------------- | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/`                     | (inline placeholder)                  | Replaced by the marketing landing once Creative ships visual direction.                                                                                                               |
| `/tokens`               | `ui/app/tokens/page.ts`               | REDBOOK §3 bundles. Public. Self-contained — no API fetch. Query: `?tier=`, `?promoted=`.                                                                                             |
| `/diamond/purchase`     | `ui/app/diamond/purchase/page.ts`     | Diamond volume + velocity quote. Public. Self-contained — no API fetch. Query: `?tokens=`, `?velocity_days=`.                                                                         |
| `/wallet`               | `ui/app/wallet/page.ts`               | Three-bucket wallet. **Stub** — synthetic balances + demo banner; wallet read endpoint not yet built (`WALLET-READ-API-001` follow-up). Query: `?user=`, `?tier=`, `?welfare_score=`. |
| `/creator/pixel-legacy` | `ui/app/creator/pixel-legacy/page.ts` | FCFS gateway status display. Real API fetch. Query: `?creator=`.                                                                                                                      |

Routes still to wire:

- `/creator/control` (CreatorControl.Zone)
- `/admin/diamond`, `/admin/recovery` (operator surfaces)
- `/vip/membership` (VIP membership lifecycle)

## Out of scope for the bootstrap

- Event-handler binding. Page builders emit handler names as strings
  (`on: { click: 'submitPixelLegacyApplication' }`); these are not wired
  to functions yet. Interactive surfaces (wallet spend, gift sending,
  Cyrano top-up) get this wiring when their routes land.
- CSS / theme tokens. The `RenderElement` `classes` prop is converted to
  `className`, but the actual stylesheet that styles those classes is not
  shipped with this bootstrap. Visual direction lives in the parallel
  Creative thread; tokens flow in via `ui/config/theme.ts` once that thread
  returns.
- Prisma client. The Next.js app talks to the core API; it never imports
  Prisma directly.
- Auth. See "Auth + identity" above.
