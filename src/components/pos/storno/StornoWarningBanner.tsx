'use client'

import { memo } from 'react'
import { AlertTriangle } from 'lucide-react'
import type { StornoWarningBannerProps } from './constants'

// ============================================
// OPOZORILO ZA STORNO/PREKIC
// ============================================
export const StornoWarningBanner = memo(function StornoWarningBanner({
  isPaid,
}: StornoWarningBannerProps) {
  if (isPaid) {
    return (
      <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg p-3 flex items-start gap-2 text-sm">
        <AlertTriangle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
        <div className="text-red-800 dark:text-red-200">
          <strong>Storno računa je nepovratna operacija!</strong>
          <span className="block mt-1 text-xs">
            Ustvari se storno račun z negativnimi zneski, ki se pošlje FURS.
            Originalni račun se označi kot storniran. Znesek bo vrnjen stranki.
            Operacija se zabeleži v dnevnik in je vidna v poročilih.
          </span>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-3 flex items-start gap-2 text-sm">
      <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
      <div className="text-amber-800 dark:text-amber-200">
        <strong>Naročilo še ni plačano</strong>
        <span className="block mt-1 text-xs">
          Naročilo se bo preklicalo in sprostila bo miza (če je dodeljena).
          Ker ni bilo plačano, FURS storno račun ni potreben.
          Vsi artikli bodo označeni kot preklicani.
        </span>
      </div>
    </div>
  )
})
