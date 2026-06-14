'use client'

import { memo } from 'react'
import { statusDot, statusLabels } from './constants'

// --- Komponenta: Legenda statusov miz ---

export const TableLegend = memo(function TableLegend() {
  return (
    <div className="flex flex-wrap gap-4 text-sm">
      {Object.entries(statusDot).map(([status, color]) => (
        <div key={status} className="flex items-center gap-2">
          <div className={`h-3 w-3 rounded-full ${color}`} />
          <span>{statusLabels[status] || status}</span>
        </div>
      ))}
    </div>
  )
})
