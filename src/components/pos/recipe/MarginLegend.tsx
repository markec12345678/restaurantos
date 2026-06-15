'use client'

import { memo } from 'react'

export const MarginLegend = memo(function MarginLegend() {
  return (
    <div className="flex items-center gap-4 text-xs text-muted-foreground">
      <span className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-emerald-500"><span className="sr-only">Visoka marža</span></span> Odlična marža (≥60%)</span>
      <span className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-amber-500"><span className="sr-only">Srednja marža</span></span> Zadostna marža (40-60%)</span>
      <span className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-red-500"><span className="sr-only">Nizka marža</span></span> Nizka marža (&lt;40%)</span>
      <span className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-gray-300"><span className="sr-only">Brez podatka</span></span> Brez podatka</span>
    </div>
  )
})
