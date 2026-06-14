'use client'

import { useState } from 'react'
import { EU_ALLERGENS } from '@/components/pos/allergen-filter/constants'
import { ShieldAlert } from 'lucide-react'

// ============================================
// ALLERGEN FILTER BAR (compact za OrderPanel)
// ============================================
export function AllergenFilterBar() {
  const [excludedAllergens, setExcludedAllergens] = useState<string[]>([])
  const [expanded, setExpanded] = useState(false)
  const toggleAllergen = (code: string) => {
    setExcludedAllergens(prev =>
      prev.includes(code) ? prev.filter(a => a !== code) : [...prev, code]
    )
  }
  if (!expanded) {
    return (
      <div className="flex items-center gap-2 px-4 py-1.5 border-b border-border bg-amber-50/30 dark:bg-amber-900/5 flex-shrink-0">
        <button
          onClick={() => setExpanded(true)}
          className="flex items-center gap-1.5 text-[11px] font-medium text-amber-700 dark:text-amber-400 hover:text-amber-900 transition-colors"
        >
          <ShieldAlert className="h-3.5 w-3.5" />
          Filtriraj alergene
        </button>
        {excludedAllergens.length > 0 && (
          <>
            <span className="text-[10px] text-muted-foreground">({excludedAllergens.length} izključenih)</span>
            <button
              onClick={() => setExcludedAllergens([])}
              className="text-[10px] text-destructive hover:underline"
            >
              Počisti
            </button>
          </>
        )}
      </div>
    )
  }
  return (
    <div className="px-4 py-2 border-b border-border bg-amber-50/30 dark:bg-amber-900/5 flex-shrink-0">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[11px] font-semibold text-amber-700 dark:text-amber-400">
          <ShieldAlert className="h-3.5 w-3.5 inline mr-1" />
          Izključi alergene (skrij artikle, ki vsebujejo):
        </span>
        <button onClick={() => setExpanded(false)} className="text-[10px] text-muted-foreground hover:underline">Zapri</button>
      </div>
      <div className="flex flex-wrap gap-1">
        {EU_ALLERGENS.map(a => {
          const isExcluded = excludedAllergens.includes(a.code)
          return (
            <button
              key={a.code}
              onClick={() => toggleAllergen(a.code)}
              className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-medium transition border ${
                isExcluded
                  ? 'bg-red-100 text-red-700 border-red-300 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800'
                  : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700'
              }`}
              title={a.name}
            >
              {a.icon} {a.code}
            </button>
          )
        })}
      </div>
      {excludedAllergens.length > 0 && (
        <button
          onClick={() => setExcludedAllergens([])}
          className="mt-1.5 text-[10px] text-destructive hover:underline"
        >
          Počisti vse filtre ({excludedAllergens.length})
        </button>
      )}
    </div>
  )
}
