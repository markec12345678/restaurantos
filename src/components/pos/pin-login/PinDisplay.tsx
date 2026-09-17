'use client'

import { memo } from 'react'
import { PIN_MAX_LENGTH, PIN_MIN_LENGTH } from './constants'
import type { PinDisplayProps } from './constants'

// ============================================
// PRIKAZ PIN PIK — Vizualizacija vnesenega PIN-a
// ============================================

export const PinDisplay = memo(function PinDisplay({ pinLength }: PinDisplayProps) {
  /* NOVO (runda 25 — Toast vzorec za spremenljivo dolžino PIN-a): običajno
     vidnih 4 rež; 5. in 6. se pojavita ŠELE, ko uporabnik vpiše 5. števko
     (dinamične reže) — manj vizualnega šuma na prijavnem ekranu. */
  const slots = Math.max(PIN_MIN_LENGTH, Math.min(pinLength + 1, PIN_MAX_LENGTH))
  return (
    /* FIX runda 25: aria-label je trdil "od 4 števk" — PIN je lahko 4–6. */
    <div
      className="flex justify-center gap-2"
      role="status"
      aria-label={`Vnesenih ${pinLength} števk (od ${PIN_MIN_LENGTH} do ${PIN_MAX_LENGTH})`}
    >
      {Array.from({ length: slots }, (_, i) => (
        <div
          key={i}
          className={`h-10 w-10 rounded-lg border-2 flex items-center justify-center transition-colors ${
            i < pinLength
              ? 'border-primary bg-primary/10'
              : 'border-border'
          }`}
          aria-hidden="true"
        >
          {i < pinLength && (
            /* NOVO (runda 25 — Square vzorec): pop animacija zadnje vnesene
               števke — takojšnja vizualna povratna informacija ob tapu */
            <div className="h-3 w-3 rounded-full bg-primary animate-in zoom-in-50 fade-in duration-150" />
          )}
        </div>
      ))}
    </div>
  )
})
