// Cyrano Layer 2 — landing page
// Phase 3.10 scaffolding: confirms the standalone runtime is reachable and
// surfaces the canonical platform-API base URL the app will speak to.

export default function Page() {
  const apiBase = process.env.CYRANO_CORE_API_URL ?? 'http://localhost:3000';
  return (
    <main style={{ padding: 32, fontFamily: 'system-ui, sans-serif' }}>
      <h1>Cyrano™ Layer 2</h1>
      <p>VIP/Diamond persistent-worlds whisper console — scaffolding only.</p>
      <p>
        Core API base: <code>{apiBase}</code>
      </p>
      <p>
        Next steps: render live whisper feed (<code>cyrano.suggestion.emitted</code>),
        bind the FFS heat meter (<code>ffs.score.update</code>), and surface
        SenSync consent state (<code>sensync.consent.granted</code>).
      </p>
    </main>
  );
}
