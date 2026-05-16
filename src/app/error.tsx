'use client'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  console.error('Page error:', error)

  return (
    <div style={{ padding: 40, maxWidth: 600, margin: '0 auto', fontFamily: 'system-ui, sans-serif' }}>
      <h2 style={{ color: '#ef4444' }}>Napaka</h2>
      <p>Prišlo je do napake pri nalaganju strani:</p>
      <pre style={{ background: '#f5f5f5', padding: 16, borderRadius: 8, overflow: 'auto', fontSize: 12 }}>
        {error?.message || 'Neznana napaka'}
      </pre>
      {error?.digest && (
        <p style={{ color: '#888', fontSize: 12 }}>Digest: {error.digest}</p>
      )}
      <button
        onClick={reset}
        style={{ marginTop: 20, padding: '10px 24px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer' }}
      >
        Poskusi znova
      </button>
    </div>
  )
}
