'use client'

import { useState } from 'react'
import { EU_ALLERGENS } from '@/components/pos/allergen-filter/constants'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { ShieldAlert, X } from 'lucide-react'

// ============================================
// ALLERGEN FILTER POPOVER (UI-REFACTOR, runda 112)
// Prej: stalna vrstica med kategorijami in iskanjem (~24px kroma vedno).
// Zdaj: kompakten trigger v iskalni vrstici + Popover z čipi.
// Funkcionalnost (izključevanje alergenov, počisti, ARIA) je NESPREMENJENA —
// samo predstavitev je poenostavljena (referenca #111: manj vrstic nad artikli).
// ============================================
export function AllergenFilterPopover() {
  const [excludedAllergens, setExcludedAllergens] = useState<string[]>([])
  const [open, setOpen] = useState(false)
  const toggleAllergen = (code: string) => {
    setExcludedAllergens(prev =>
      prev.includes(code) ? prev.filter(a => a !== code) : [...prev, code]
    )
  }
  const activeCount = excludedAllergens.length

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          aria-label={`Filtriraj alergene${activeCount > 0 ? ` (${activeCount} izključenih)` : ''}`}
          aria-pressed={activeCount > 0}
          title="Filtriraj alergene"
          className={`relative flex items-center justify-center gap-1.5 h-9 pointer-coarse:h-11 w-9 pointer-coarse:w-11 rounded-lg border transition-colors flex-shrink-0 ${
            activeCount > 0
              ? 'border-amber-300 bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:border-amber-700 dark:text-amber-300'
              : 'border-border bg-card text-muted-foreground hover:text-foreground hover:border-amber-300'
          }`}
        >
          <ShieldAlert className="h-4 w-4" aria-hidden="true" />
          {activeCount > 0 && (
            <span
              className="absolute -top-1.5 -right-1.5 flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full bg-amber-500 text-[9px] font-bold text-amber-950 tabular-nums"
              aria-hidden="true"
            >
              {activeCount}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 p-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-amber-700 dark:text-amber-400">
            <ShieldAlert className="h-3.5 w-3.5 inline mr-1" />
            Izključi alergene
          </span>
          {activeCount > 0 && (
            <button
              onClick={() => setExcludedAllergens([])}
              className="text-[11px] text-destructive hover:underline"
            >
              Počisti vse ({activeCount})
            </button>
          )}
        </div>
        <p className="text-[11px] text-muted-foreground mb-2">
          Skrij artikle, ki vsebujejo izbrane alergene:
        </p>
        <div className="flex flex-wrap gap-1">
          {EU_ALLERGENS.map(a => {
            const isExcluded = excludedAllergens.includes(a.code)
            return (
              <button
                key={a.code}
                onClick={() => toggleAllergen(a.code)}
                aria-pressed={isExcluded}
                className={`flex items-center gap-0.5 px-2 py-1 rounded-md text-[10px] font-medium transition border pointer-coarse:py-1.5 ${
                  isExcluded
                    ? 'bg-red-100 text-red-700 border-red-300 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800'
                    : 'bg-secondary text-secondary-foreground border-border hover:bg-accent hover:text-accent-foreground'
                }`}
                title={a.name}
              >
                {a.icon} {a.code}
                {isExcluded && <X className="h-2.5 w-2.5 ml-0.5" aria-hidden="true" />}
              </button>
            )
          })}
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="w-full mt-2 h-7 text-[11px] text-muted-foreground"
          onClick={() => setOpen(false)}
        >
          Zapri
        </Button>
      </PopoverContent>
    </Popover>
  )
}
