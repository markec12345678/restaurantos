'use client'

import { useEffect } from 'react'
import { logger } from '@/lib/logger'

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    logger.error('OrderDetail', 'Napaka pri nalaganju podrobnosti naročila', {
      message: error.message,
      digest: error.digest,
    })
  }, [error])

  const isDev = process.env.NODE_ENV === 'development'
  return (
    <div className="p-8 sm:p-10 max-w-xl mx-auto">
      <h2 className="text-destructive text-xl font-semibold">Napaka</h2>
      <p className="text-foreground/90 mt-2">Prišlo je do napake pri nalaganju strani.</p>
      {error?.digest && <p className="text-muted-foreground text-xs mt-2">Koda napake: {error.digest}</p>}
      {isDev && <pre className="bg-muted text-foreground/80 rounded-lg p-4 overflow-auto text-xs mt-4 font-mono">{error?.message || 'Neznana napaka'}</pre>}
      <button onClick={reset} className="bg-primary text-primary-foreground rounded-lg px-6 py-2.5 font-medium min-h-[44px] cursor-pointer hover:opacity-90 transition-opacity mt-5">Poskusi znova</button>
    </div>
  )
}
