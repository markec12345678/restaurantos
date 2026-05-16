'use client'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  console.error('Global error:', error)

  return (
    <html lang="sl">
      <body style={{ margin: 0, padding: '20px', fontFamily: 'system-ui, sans-serif', background: '#1a1a2e', color: '#eee' }}>
        <div style={{ maxWidth: 600, margin: '80px auto' }}>
          <h2 style={{ color: '#ef4444' }}>Napaka v aplikaciji</h2>
          <p style={{ color: '#aaa' }}>Prišlo je do nepričakovane napake:</p>
          <pre style={{ background: '#2a2a4a', padding: 16, borderRadius: 8, overflow: 'auto', fontSize: 12, color: '#f87171' }}>
            {error?.message || 'Neznana napaka'}
          </pre>
          {error?.stack && (
            <details style={{ marginTop: 16 }}>
              <summary style={{ cursor: 'pointer', color: '#888' }}>Stack trace</summary>
              <pre style={{ background: '#2a2a4a', padding: 16, borderRadius: 8, overflow: 'auto', fontSize: 10, color: '#aaa' }}>
                {error.stack}
              </pre>
            </details>
          )}
          <button
            onClick={reset}
            style={{ marginTop: 20, padding: '10px 24px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 14 }}
          >
            Poskusi znova
          </button>
        </div>
      </body>
    </html>
  )
}
