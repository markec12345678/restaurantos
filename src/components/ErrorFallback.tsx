// ============================================
// Error fallback sub-component
// ============================================

interface ErrorFallbackProps {
  error: Error | null
  retryCount: number
  maxRetries: number
  exhausted: boolean
  contextLabel: string
  onRetry: () => void
  onReset: () => void
}

export function ErrorFallback({
  error,
  retryCount,
  maxRetries,
  exhausted,
  contextLabel,
  onRetry,
  onReset,
}: ErrorFallbackProps) {
  const isDev = process.env.NODE_ENV === 'development'

  return (
    <div
      role="alert"
      aria-live="assertive"
      style={{
        padding: 24,
        maxWidth: 560,
        margin: '40px auto',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        background: '#fef2f2',
        borderRadius: 12,
        border: '1px solid #fecaca',
        textAlign: 'center',
      }}
    >
      <div style={{ fontSize: 36, marginBottom: 8, lineHeight: 1 }} aria-hidden="true">
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline-block', verticalAlign: 'middle' }}>
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      </div>

      <h3 style={{ color: '#dc2626', margin: '0 0 8px 0', fontSize: 18 }}>
        Napaka v {contextLabel}
      </h3>

      <p style={{ color: '#7f1d1d', margin: '0 0 6px 0', fontSize: 14 }}>
        Prišlo je do nepričakovane napake. Poskusite znova ali ponastavite modul.
      </p>

      {retryCount > 1 && (
        <p style={{ color: '#991b1b', margin: '0 0 16px 0', fontSize: 13, opacity: 0.8 }}>
          Ponovni poskus {retryCount}/{maxRetries}
          {exhausted && ' — doseženih maksimalnih poskusov'}
        </p>
      )}

      {isDev && error && (
        <pre
          style={{
            background: '#fff',
            padding: 12,
            borderRadius: 8,
            overflow: 'auto',
            fontSize: 11,
            textAlign: 'left',
            margin: '0 0 16px 0',
            maxHeight: 120,
            border: '1px solid #e5e7eb',
            color: '#374151',
          }}
        >
          {error.message}
        </pre>
      )}

      <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
        {!exhausted && (
          <button
            onClick={onRetry}
            style={{
              padding: '8px 20px',
              background: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: 8,
              cursor: 'pointer',
              fontSize: 14,
              fontWeight: 500,
            }}
          >
            Poskusi znova
          </button>
        )}
        <button
          onClick={onReset}
          style={{
            padding: '8px 20px',
            background: exhausted ? '#dc2626' : '#6b7280',
            color: 'white',
            border: 'none',
            borderRadius: 8,
            cursor: 'pointer',
            fontSize: 14,
            fontWeight: 500,
          }}
        >
          Ponastavi modul
        </button>
      </div>
    </div>
  )
}
