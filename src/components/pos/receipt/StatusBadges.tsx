'use client'

import { memo } from 'react'
import { Eye } from 'lucide-react'
import type { StatusBadgesProps } from './constants'

// ============================================
// STATUSNE OZNAKE (predogled, storno, kopija)
// ============================================
export const StatusBadges = memo(function StatusBadges({
  isPreview,
  receipt,
}: StatusBadgesProps) {
  return (
    <>
      {/* PREDOGLED OPOZORILO */}
      {isPreview && (
        <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-3 flex items-center gap-2 text-sm">
          <Eye className="h-4 w-4 text-amber-600 shrink-0" />
          <span className="text-amber-800 dark:text-amber-200">
            To je <strong>predogled</strong> računa. Preverite podatke pred tiskanjem.
            Račun bo shranjen v bazo ob potrditvi.
          </span>
        </div>
      )}

      {/* STORNO OZNAKA */}
      {receipt.isStorno && (
        <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg p-3 text-center font-bold text-red-700 dark:text-red-300">
          STORNO RAČUN
          {receipt.stornoOf && <div className="text-xs font-normal mt-1">Storno računa: {receipt.stornoOf}</div>}
        </div>
      )}

      {/* KOPIJA OZNAKA */}
      {receipt.isCopy && (
        <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-2 text-center text-xs font-medium text-blue-700 dark:text-blue-300">
          PRIREJENA KOPIJA / Kopie certifiée
        </div>
      )}
    </>
  )
})
