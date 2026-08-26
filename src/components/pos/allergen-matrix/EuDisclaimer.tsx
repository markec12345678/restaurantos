'use client'

import { memo } from 'react'
import { Info } from 'lucide-react'
import type { EuDisclaimerProps } from './constants'

// ============================================
// EU UREDBA 1169/2011 — OPOMBA
// ============================================

export const EuDisclaimer = memo(function EuDisclaimer(_props: EuDisclaimerProps) {
  return (
    <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
      <div className="flex items-start gap-2">
        <Info className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
        <div>
          <p className="text-xs font-semibold text-blue-700 dark:text-blue-400">EU Uredba 1169/2011</p>
          <p className="text-xs text-muted-foreground">
            Vse restavracije v EU morajo označevati 14 alergenov na jedilniku ali zagotoviti informacije osebju.
            Neupoštevanje je kaznivo z globo do 8.000{'\u20AC'}. Posodabljajte alergene ob vsaki spremembi recepta ali dobavitelja.
          </p>
        </div>
      </div>
    </div>
  )
})
