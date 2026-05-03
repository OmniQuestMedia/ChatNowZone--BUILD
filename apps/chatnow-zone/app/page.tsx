// apps/chatnow-zone/app/page.tsx
// Alpha-bootstrap landing — confirms the Next.js app is reachable and lists
// the page-builder routes wired so far. Replaced by the marketing landing
// once Creative ships visual direction.

export const dynamic = 'force-dynamic';

export default function Page() {
  const apiBase = process.env.CNZ_CORE_API_URL ?? 'http://localhost:3000';
  return (
    <main style={{ padding: 32, maxWidth: 720, margin: '0 auto' }}>
      <h1 style={{ marginBottom: 8 }}>ChatNow.Zone</h1>
      <p style={{ color: '#a8a8b0', marginTop: 0 }}>
        Alpha test mode — no real payment will be charged.
      </p>

      <section style={{ marginTop: 32 }}>
        <h2 style={{ fontSize: 16, color: '#a8a8b0' }}>Wired routes (bootstrap)</h2>
        <ul style={{ lineHeight: 1.8 }}>
          <li>
            <a href="/tokens" style={{ color: '#7ec1ff' }}>
              /tokens
            </a>{' '}
            — REDBOOK §3 token bundle rate card (public)
          </li>
          <li>
            <a href="/diamond/purchase" style={{ color: '#7ec1ff' }}>
              /diamond/purchase
            </a>{' '}
            — Diamond Tier volume + velocity quote (public)
          </li>
          <li>
            <a href="/wallet" style={{ color: '#7ec1ff' }}>
              /wallet
            </a>{' '}
            — Three-bucket wallet (DEMO data — wallet read endpoint not wired yet)
          </li>
          <li>
            <a href="/creator/pixel-legacy" style={{ color: '#7ec1ff' }}>
              /creator/pixel-legacy
            </a>{' '}
            — Pixel Legacy status (FCFS gateway)
          </li>
        </ul>
      </section>

      <p style={{ marginTop: 48, fontSize: 12, color: '#666' }}>
        Core API base: <code>{apiBase}</code>
      </p>
    </main>
  );
}
