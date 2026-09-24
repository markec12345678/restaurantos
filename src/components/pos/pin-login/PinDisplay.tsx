'use client'

import { memo } from 'react'
import { PIN_MAX_LENGTH, PIN_MIN_LENGTH } from './constants'
import type { PinDisplayProps } from './constants'

// ============================================
// PRIKAZ PIN PIK — Vizualizacija vnesenega PIN-a
// ============================================

export const PinDisplay = memo(function PinDisplay({ pinLength }: PinDisplayProps) {
  /* FIX (živi pregled — povratna informacija uporabnika): prej `pinLength + 1`
     je pri 4 vnesenih števkah prikazal peto PRAZNO režo ("duhovo polje") —
     zmedlo je uporabnike s 4-mestnim PIN-om, ker je izgledalo, kot da sistem
     zahteva več kot 4 števke. Zdaj: prikaže se TOČNO toliko rež, kolikor je
     vnesenih (4 števke = 4 polna polja, vizualno "zaključeno" stanje).
     5./6. reža se še vedno pojavi, ko uporabnik dejansko vpiše 5. števko
     (6-mestni PIN-i ostanejo podprti, avto-submit pri 6 se ne spreminja). */
  const slots = Math.max(PIN_MIN_LENGTH, Math.min(pinLength, PIN_MAX_LENGTH))
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
