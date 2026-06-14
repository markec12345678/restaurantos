'use client'

import { useEffect } from 'react'
import { logger } from '@/lib/logger'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    logger.error('GlobalError', 'Kritična napaka v aplikaciji', {
      message: error.message,
      digest: error.digest,
      stack: error.stack,
    })
  }, [error])

  const isDev = process.env.NODE_ENV === 'development'

  return (
    <html lang="sl">
      <body style={{ margin: 0, padding: '20px', fontFamily: 'system-ui, sans-serif', background: '#1a1a2e', color: '#eee' }}>
        <div style={{ maxWidth: 600, margin: '80px auto' }}>
          <h2 style={{ color: '#ef4444' }}>Napaka v aplikaciji</h2>
          <p style={{ color: '#aaa' }}>Prišlo je do nepričakovane napake.</p>
          {error?.digest && (
            <p style={{ color: '#888', fontSize: 12, margin: '8px 0' }}>
              Koda napake: {error.digest}
            </p>
          )}
          {/* Stack trace samo v development načinu — v produkciji ne sme razkriti notranje strukture */}
          {isDev && error?.message && (
            <p style={{ color: '#f87171', fontSize: 13, margin: '12px 0' }}>
              {error.message}
            </p>
          )}
          {isDev && error?.stack && (
            <details style={{ marginTop: 16 }}>
              <summary style={{ cursor: 'pointer', color: '#888' }}>Stack trace (samo dev)</summary>
              <pre style={{ background: '#2a2a4a', padding: 16, borderRadius: 8, overflow: 'auto', fontSize: 10, color: '#aaa' }}>
                {error.stack}
              </pre>
            </details>
          )}
          {!isDev && (
            <p style={{ color: '#888', fontSize: 13, margin: '12px 0' }}>
              Prišlo je do nepričakovane napake. Poskusite znova.
            </p>
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
