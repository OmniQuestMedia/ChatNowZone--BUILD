// apps/chatnow-zone/app/creator/pixel-legacy/page.tsx
// Wires ui/app/creator/pixel-legacy/page.ts (the framework-agnostic page
// builder) into Next.js App Router. Server component — fetches the creator's
// Pixel Legacy status + seat meter from the core API, builds the
// PixelLegacyStatusView, hands it to the page builder, and converts the
// returned RenderElement tree to React.
//
// Auth posture (interim): creator_id comes from the `creator` query param.
// Once the platform auth middleware lands and attaches a verified user to
// the request, the creator_id will be sourced from req.user — same gap
// tracked under PIXEL-LEGACY-006 alongside the step-up auth wiring.

import { renderPixelLegacyPage } from '@cnz/ui/app/creator/pixel-legacy/page';
import { renderPlanToReact } from '../../../lib/render-plan-to-react';
import {
  buildPixelLegacyStatusView,
  fetchPixelLegacyStatus,
} from '../../../lib/pixel-legacy-presenter';

export const dynamic = 'force-dynamic';

interface SearchParams {
  creator?: string;
}

export default async function PixelLegacyPage({
  searchParams,
}: {
  searchParams?: SearchParams | Promise<SearchParams>;
}) {
  const apiBase = process.env.CNZ_CORE_API_URL ?? 'http://localhost:3000';
  const resolvedParams = (await Promise.resolve(searchParams)) ?? {};
  const creatorId = resolvedParams.creator?.trim();

  if (!creatorId) {
    return (
      <main style={{ padding: 32, maxWidth: 640, margin: '0 auto' }}>
        <h1>Pixel Legacy</h1>
        <p style={{ color: '#a8a8b0' }}>
          Provide a creator id via <code>?creator=&lt;id&gt;</code> to view status. Once the
          platform auth middleware is wired the creator id will come from the authenticated
          session.
        </p>
      </main>
    );
  }

  let view;
  try {
    const { status, seat_meter } = await fetchPixelLegacyStatus({ creatorId, apiBase });
    view = buildPixelLegacyStatusView({ creator_id: creatorId, status, seat_meter });
  } catch (err) {
    return (
      <main style={{ padding: 32, maxWidth: 640, margin: '0 auto' }}>
        <h1>Pixel Legacy</h1>
        <p style={{ color: '#ff6b6b' }}>
          Could not load Pixel Legacy status for <code>{creatorId}</code>.
        </p>
        <pre style={{ color: '#a8a8b0', fontSize: 12, whiteSpace: 'pre-wrap' }}>
          {err instanceof Error ? err.message : String(err)}
        </pre>
      </main>
    );
  }

  const render = renderPixelLegacyPage({ view });
  return <>{renderPlanToReact(render.tree)}</>;
}
