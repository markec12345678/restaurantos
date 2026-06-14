'use client'

// ─── Alergen filter za meni ──────────────────────────────────────
import { useState, useCallback, memo } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ShieldAlert, X, Check, ChevronDown, ChevronUp } from 'lucide-react'
import { EU_ALLERGENS, DIETARY_FILTERS } from './constants'
import type { AllergenFilterBarProps } from './constants'

export const AllergenFilterBar = memo(function AllergenFilterBar({
  excludedAllergens,
  onExcludedChange,
  dietaryFilters,
  onDietaryChange,
  activeFiltersCount,
  onClear,
}: AllergenFilterBarProps) {
  const [expanded, setExpanded] = useState(false)

  const toggleAllergen = useCallback((code: string) => {
    onExcludedChange(
      excludedAllergens.includes(code)
        ? excludedAllergens.filter(a => a !== code)
        : [...excludedAllergens, code]
    )
  }, [excludedAllergens, onExcludedChange])

  const toggleDietary = useCallback((id: string) => {
    onDietaryChange(
      dietaryFilters.includes(id)
        ? dietaryFilters.filter(f => f !== id)
        : [...dietaryFilters, id]
    )
  }, [dietaryFilters, onDietaryChange])

  return (
    <div className="border-b border-border bg-amber-50/50 dark:bg-amber-900/10 flex-shrink-0">
      <div className="flex items-center gap-2 px-4 py-2">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs gap-1"
          onClick={() => setExpanded(!expanded)}
        >
          <ShieldAlert className="h-3.5 w-3.5 text-amber-600" />
          Alergeni & preference
          {activeFiltersCount > 0 && (
            <Badge className="bg-amber-500 text-white text-[9px] h-4 px-1 ml-1" aria-label={`${activeFiltersCount} aktivnih filtrov`}>
              {activeFiltersCount}
            </Badge>
          )}
          {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </Button>

        {activeFiltersCount > 0 && (
          <Button variant="ghost" size="sm" className="h-7 text-xs text-destructive" onClick={onClear}>
            <X className="h-3 w-3 mr-1" />
            Počisti filtre
          </Button>
        )}

        {activeFiltersCount > 0 && !expanded && (
          <div className="flex gap-1 overflow-x-auto custom-scrollbar">
            {excludedAllergens.map(code => {
              const info = EU_ALLERGENS.find(a => a.code === code)
              return (
                <Badge key={code} variant="outline" className="text-[9px] h-5 px-1.5 border-red-200 text-red-600 bg-red-50 dark:bg-red-900/20 gap-0.5 flex-shrink-0">
                  {info?.icon} {code}
                  <button type="button" aria-label="Odstrani filter" onClick={() => toggleAllergen(code)}><X className="h-2.5 w-2.5" /></button>
                </Badge>
              )
            })}
            {dietaryFilters.map(id => {
              const info = DIETARY_FILTERS.find(f => f.id === id)
              return (
                <Badge key={id} variant="outline" className="text-[9px] h-5 px-1.5 border-green-200 text-green-600 bg-green-50 dark:bg-green-900/20 gap-0.5 flex-shrink-0">
                  {info?.icon} {info?.name}
                  <button type="button" aria-label="Odstrani filter" onClick={() => toggleDietary(id)}><X className="h-2.5 w-2.5" /></button>
                </Badge>
              )
            })}
          </div>
        )}
      </div>

      {expanded && (
        <div className="px-4 pb-3 space-y-3">
          {/* Allergen exclusion */}
          <div>
            <p className="text-[10px] font-semibold text-muted-foreground mb-1.5 uppercase tracking-wider">
              Izključi alergene (skrij artikle, ki vsebujejo):
            </p>
            <div className="flex flex-wrap gap-1">
              {EU_ALLERGENS.map(allergen => {
                const isExcluded = excludedAllergens.includes(allergen.code)
                return (
                  <button
                    key={allergen.code}
                    onClick={() => toggleAllergen(allergen.code)}
                    className={`flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium transition-all border ${
                      isExcluded
                        ? 'bg-red-100 text-red-700 border-red-300 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800'
                        : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700'
                    }`}
                  >
                    <span className="text-xs">{allergen.icon}</span>
                    <span>{allergen.code}</span>
                    {isExcluded && <X className="h-2.5 w-2.5" />}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Dietary filters */}
          <div>
            <p className="text-[10px] font-semibold text-muted-foreground mb-1.5 uppercase tracking-wider">
              Prehranske preference:
            </p>
            <div className="flex flex-wrap gap-1">
              {DIETARY_FILTERS.map(filter => {
                const isActive = dietaryFilters.includes(filter.id)
                return (
                  <button
                    key={filter.id}
                    onClick={() => toggleDietary(filter.id)}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-medium transition-all border ${
                      isActive
                        ? 'bg-green-100 text-green-700 border-green-300 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800'
                        : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700'
                    }`}
                  >
                    <span>{filter.icon}</span>
                    <span>{filter.name}</span>
                    {isActive && <Check className="h-2.5 w-2.5" />}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
})
