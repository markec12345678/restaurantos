'use client'

import { useEffect } from 'react'
import { logger } from '@/lib/logger'

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    logger.error('FeedbackPage', 'Napaka pri nalaganju povratnih informacij', {
      message: error.message,
      digest: error.digest,
    })
  }, [error])

  const isDev = process.env.NODE_ENV === 'development'
  return (
    <div style={{ padding: 40, maxWidth: 600, margin: '0 auto', fontFamily: 'system-ui, sans-serif' }}>
      <h2 style={{ color: '#ef4444' }}>Napaka</h2>
      <p>Prišlo je do napake pri nalaganju strani.</p>
      {error?.digest && <p style={{ color: '#888', fontSize: 12 }}>Koda napake: {error.digest}</p>}
      {isDev && <pre style={{ background: '#f5f5f5', padding: 16, borderRadius: 8, overflow: 'auto', fontSize: 12 }}>{error?.message || 'Neznana napaka'}</pre>}
      <button onClick={reset} style={{ marginTop: 20, padding: '10px 24px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer' }}>Poskusi znova</button>
    </div>
  )
}
