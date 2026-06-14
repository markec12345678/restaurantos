'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { logger } from '@/lib/logger'

export default function QRMenuError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    logger.error('QRMenu', 'Napaka pri nalaganju QR jedilnika', {
      message: error.message,
      digest: error.digest,
    })
  }, [error])

  const isDev = process.env.NODE_ENV === 'development'

  return (
    <div style={{ padding: 40, maxWidth: 600, margin: '0 auto', fontFamily: 'system-ui, sans-serif' }}>
      <h2 style={{ color: '#ef4444' }}>Napaka — QR Jedilnik</h2>
      <p>Prišlo je do napake pri nalaganju jedilnika. Prosimo, poskusite znova ali povprašajte natakarja.</p>
      {error?.digest && (
        <p style={{ color: '#888', fontSize: 12 }}>Koda napake: {error.digest}</p>
      )}
      {/* Podrobnosti napake samo v development načinu — varnost v produkciji */}
      {isDev && (
        <pre style={{ background: '#f5f5f5', padding: 16, borderRadius: 8, overflow: 'auto', fontSize: 12 }}>
          {error?.message || 'Neznana napaka'}
        </pre>
      )}
      <div style={{ marginTop: 20, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <button
          onClick={reset}
          style={{ padding: '10px 24px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer' }}
        >
          Poskusi znova
        </button>
        <Link
          href="/"
          style={{
            padding: '10px 24px',
            background: '#6b7280',
            color: 'white',
            borderRadius: 8,
            textDecoration: 'none',
            display: 'inline-flex',
            alignItems: 'center',
          }}
        >
          Nazaj na začetno stran
        </Link>
      </div>
    </div>
  )
}
