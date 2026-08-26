'use client'

import { memo } from 'react'
import { AlertTriangle } from 'lucide-react'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type EodData = any

interface EodPendingWarningProps {
  eodData: EodData
}

export const EodPendingWarning = memo(function EodPendingWarning({ eodData }: EodPendingWarningProps) {
  if (eodData.summary.pendingOrders <= 0) return null
  return (
    <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
      <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0" />
      <p className="text-sm text-amber-800 dark:text-amber-300">
        Pozor: {eodData.summary.pendingOrders} odprtih naročil! Najprej zaključite vsa naročila.
      </p>
    </div>
  )
})
