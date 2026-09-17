'use client'

// ============================================
// DecimalInput — vejica-prijazen decimalni vnos (STYLING runda 9)
// ============================================
// Zamenjava za <Input type="number"> v back-office dialogih.
//
// PROBLEM (worklog runda 8, ostanek ~62 instanc): type="number" na
// slovenski tipkovnici ZAVRAČA decimalno vejico ("12,50" → prazen vnos),
// na tablicah pa sicer prikaže numerično tipkovnico, ampak z piko.
//
// REŠITEV: type="text" + inputMode="decimal" (numerična tipkovnica na
// tablicah) + notranji RAW text state (tipkana vejica ostane vidna med
// tipkanjem!) + parseDecimalInput za varno razčlenjevanje ("12,50" → 12.5,
// "1.234,56" → 1234.56). Ob blur se prikaz normalizira na kanonično
// številko. Programatski reset (value sprememba od zunaj) se sinhronizira,
// dokler polje ni fokusirano.

import * as React from 'react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { parseDecimalInput } from '@/lib/safe-format'

export type DecimalInputProps = Omit<
  React.ComponentProps<typeof Input>,
  'type' | 'value' | 'onChange' | 'defaultValue'
> & {
  /** Programatska vrednost (številka ali '' za prazno). Med tipkanjem se ne vsiljuje. */
  value: number | string
  /** Pokliče se ob vsaki spremembi z razčlenjeno številko (0 = prazno/neveljavno).
   *  Opcijsko — readOnly prikazna polja ga ne potrebujejo. */
  onValueChange?: (_n: number) => void
}

export const DecimalInput = React.forwardRef<HTMLInputElement, DecimalInputProps>(
  function DecimalInput({ value, onValueChange, onFocus, onBlur, className, ...props }, ref) {
    const [raw, setRaw] = React.useState(() =>
      value === '' || value == null ? '' : String(value),
    )
    const focusedRef = React.useRef(false)

    // Sinhronizacija od zunaj (npr. reset obrazca) — le kadar polje NI fokusirano,
    // da ne povzročamo utikanja med tipkanjem.
    React.useEffect(() => {
      if (!focusedRef.current) {
        setRaw(value === '' || value == null ? '' : String(value))
      }
    }, [value])

    return (
      <Input
        ref={ref}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        spellCheck={false}
        // STYLING runda 14 (tablet 3. del): centralni dotične tarče — vsi ~44
        // datotek z DecimalInput dobijo na grobi kazalki (tablice/telefoni)
        // 44px tarčo + touch-manipulation BREZ posameznih popravkov;
        // namizje ostane kompaktno (h-* override-i v uporabi ostanejo varen).
        className={cn('pointer-coarse:h-11 touch-manipulation', className)}
        {...props}
        value={raw}
        onFocus={(e) => {
          focusedRef.current = true
          onFocus?.(e)
        }}
        onBlur={(e) => {
          focusedRef.current = false
          // Ob izhodu normaliziraj prikaz ("12,50" → "12.5", prazno ostane prazno)
          const trimmed = raw.trim()
          if (trimmed === '') {
            setRaw('')
          } else {
            const n = parseDecimalInput(trimmed)
            setRaw(String(n))
            onValueChange?.(n)
          }
          onBlur?.(e)
        }}
        onChange={(e) => {
          const v = e.target.value
          // Prezri ne-številske znake (le številke, vejica, pika, minus, presledki)
          if (v !== '' && !/^-?[\d\s.,]*$/.test(v)) return
          setRaw(v)
          onValueChange?.(parseDecimalInput(v))
        }}
      />
    )
  },
)
