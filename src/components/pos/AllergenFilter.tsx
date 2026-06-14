'use client'

// ═══════════════════════════════════════════════════════════════
// RestaurantOS — Allergen Filter & Display
// EU 1169/2011 alergeni v naročanju, filtri menija, opozorila
// Toast POS standard za alergene in prehranske preference
// ═══════════════════════════════════════════════════════════════

import { useState, useCallback, memo } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { ShieldAlert, X, AlertTriangle, Check, ChevronDown, ChevronUp } from 'lucide-react'
import type { MenuItemRow } from '@/lib/types'

// ─── EU 14 Alergeni (1169/2011) ──────────────────────────────────
export const EU_ALLERGENS = [
  { code: '1', name: 'Žita (pšenica, rž, ječmen, oves, pirid, kamut)', icon: '🌾', color: '#d97706' },
  { code: '2', name: 'Raki in izdelki iz rakov', icon: '🦐', color: '#dc2626' },
  { code: '3', name: 'Jajca in izdelki z jajci', icon: '🥚', color: '#f59e0b' },
  { code: '4', name: 'Ribe in ribji izdelki', icon: '🐟', color: '#3b82f6' },
  { code: '5', name: 'Arašidi in izdelki z arašidi', icon: '🥜', color: '#92400e' },
  { code: '6', name: 'Soja in sojini izdelki', icon: '🫘', color: '#65a30d' },
  { code: '7', name: 'Mleko in mlečni izdelki (laktoza)', icon: '🥛', color: '#f8fafc' },
  { code: '8', name: 'Oreški (mandlji, lešniki, orehi, indijski, ...)', icon: '🌰', color: '#92400e' },
  { code: '9', name: 'Zeler in izdelki iz zelerja', icon: '🥬', color: '#16a34a' },
  { code: '10', name: 'Gorčica in izdelki iz gorčice', icon: '🟡', color: '#eab308' },
  { code: '11', name: 'Sesam (sezam) in izdelki', icon: '⚪', color: '#a1a1aa' },
  { code: '12', name: 'Žveplov dioksid / sulfiti (>10mg/l)', icon: '🧪', color: '#8b5cf6' },
  { code: '13', name: 'Volčji bob (lupin) in izdelki', icon: '🌸', color: '#a855f7' },
  { code: '14', name: 'Mehkužci in izdelki iz mehkužcev', icon: '🐚', color: '#06b6d4' },
]

export const DIETARY_FILTERS = [
  { id: 'vegetarian', name: 'Vegetarijansko', icon: '🥬', color: '#16a34a' },
  { id: 'vegan', name: 'Vegansko', icon: '🌱', color: '#22c55e' },
  { id: 'gluten-free', name: 'Brez glutena', icon: '🌾❌', color: '#d97706' },
  { id: 'lactose-free', name: 'Brez laktoze', icon: '🥛❌', color: '#3b82f6' },
  { id: 'halal', name: 'Halal', icon: '🍖', color: '#16a34a' },
  { id: 'kosher', name: 'Košer', icon: '✡️', color: '#3b82f6' },
]

// ─── Prikaz alergenov za artikel ────────────────────────────────
export const AllergenBadge = memo(function AllergenBadge({ allergens, compact = false }: { allergens: string; compact?: boolean }) {
  if (!allergens) return null

  const codes = allergens.split(',').map(s => s.trim()).filter(Boolean)
  if (codes.length === 0) return null

  if (compact) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant="outline" className="text-[9px] h-4 px-1 border-red-200 text-red-600 bg-red-50 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400 gap-0.5">
              <ShieldAlert className="h-2.5 w-2.5" />
              {codes.length}
            </Badge>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs">
            <div className="space-y-0.5">
              <p className="font-semibold text-xs mb-1">Alergeni:</p>
              {codes.map(code => {
                const info = EU_ALLERGENS.find(a => a.code === code)
                return info ? (
                  <p key={code} className="text-xs">{info.icon} {info.name}</p>
                ) : (
                  <p key={code} className="text-xs">Alergen {code}</p>
                )
              })}
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  return (
    <div className="flex flex-wrap gap-0.5">
      {codes.map(code => {
        const info = EU_ALLERGENS.find(a => a.code === code)
        return (
          <TooltipProvider key={code}>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="inline-flex items-center justify-center h-5 w-5 rounded text-[10px] font-bold bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border border-red-200 dark:border-red-800">
                  {code}
                </span>
              </TooltipTrigger>
              <TooltipContent>
                <p className="text-xs">{info?.icon} {info?.name || `Alergen ${code}`}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )
      })}
    </div>
  )
})

// ─── Alergen filter za meni ──────────────────────────────────────
interface AllergenFilterBarProps {
  excludedAllergens: string[]
  onExcludedChange: (_allergens: string[]) => void
  dietaryFilters: string[]
  onDietaryChange: (_filters: string[]) => void
  activeFiltersCount: number
  onClear: () => void
}

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

// ─── Alergen opozorilo ob dodajanju ──────────────────────────────
export const AllergenWarningDialog = memo(function AllergenWarningDialog({
  open,
  onClose,
  onConfirm,
  itemName,
  allergens,
  guestAllergens,
}: {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  itemName: string
  allergens: string
  guestAllergens: string[]
}) {
  if (!allergens || guestAllergens.length === 0) return null

  const itemCodes = allergens.split(',').map(s => s.trim()).filter(Boolean)
  const conflicting = itemCodes.filter(code => guestAllergens.includes(code))

  if (conflicting.length === 0) return null

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-600">
            <AlertTriangle className="h-5 w-5" />
            Opozorilo: Alergeni!
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-sm">
            Artikel <strong>"{itemName}"</strong> vsebuje alergene, ki so označeni pri gostu:
          </p>
          <div className="flex flex-wrap gap-1.5">
            {conflicting.map(code => {
              const info = EU_ALLERGENS.find(a => a.code === code)
              return (
                <Badge key={code} className="bg-red-100 text-red-700 border-red-300 text-xs gap-1">
                  <span>{info?.icon}</span>
                  {info?.name?.split(' ').slice(0, 3).join(' ')}
                </Badge>
              )
            })}
          </div>
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
            <p className="text-xs text-red-700 dark:text-red-400">
              Gost ima zabeležene alergene. Ali želite vseeno dodati ta artikel?
              Priporočamo, da gosta opozorite na vsebnost alergenov.
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} autoFocus>Prekliči</Button>
          <Button variant="destructive" onClick={() => { onConfirm(); onClose() }}>
            Dodaj vseeno
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
})

// ─── Utility: preveri alergene ──────────────────────────────────
export function checkAllergenConflict(itemAllergens: string, guestAllergens: string[]): string[] {
  if (!itemAllergens || guestAllergens.length === 0) return []
  const itemCodes = itemAllergens.split(',').map(s => s.trim()).filter(Boolean)
  return itemCodes.filter(code => guestAllergens.includes(code))
}

// FIX A3 MEDIUM: Preveri tudi alergene modifierjev — AllergenWarningDialog jih prej ni upošteval
export function checkAllergenConflictWithModifiers(
  itemAllergens: string,
  guestAllergens: string[],
  modifierGroups?: Array<{
    modifierGroup?: { modifiers?: Array<{ allergens?: string }> }
  }>
): string[] {
  if (guestAllergens.length === 0) return []
  const conflicting: string[] = []

  // Check item's own allergens
  if (itemAllergens) {
    const itemCodes = itemAllergens.split(',').map(s => s.trim()).filter(Boolean)
    for (const code of itemCodes) {
      if (guestAllergens.includes(code) && !conflicting.includes(code)) {
        conflicting.push(code)
      }
    }
  }

  // Check modifier allergens
  if (modifierGroups && Array.isArray(modifierGroups)) {
    for (const mg of modifierGroups) {
      const modifiers = mg.modifierGroup?.modifiers
      if (modifiers && Array.isArray(modifiers)) {
        for (const mod of modifiers) {
          if (mod.allergens) {
            const modCodes = mod.allergens.split(',').map(s => s.trim()).filter(Boolean)
            for (const code of modCodes) {
              if (guestAllergens.includes(code) && !conflicting.includes(code)) {
                conflicting.push(code)
              }
            }
          }
        }
      }
    }
  }

  return conflicting
}

export function filterItemsByAllergens(
  items: MenuItemRow[],
  excludedAllergens: string[],
  allergensField: string = 'allergens'
): MenuItemRow[] {
  if (excludedAllergens.length === 0) return items
  return items.filter(item => {
    if (!item[allergensField]) return true
    const codes = (item[allergensField] as string).split(',').map((s: string) => s.trim()).filter(Boolean)
    // Check item's own allergens
    if (codes.some(code => excludedAllergens.includes(code))) return false

    // FIX A2 HIGH: Preveri tudi alergene modifierjev — "sir" (mleko/alergen 7) kot dodatek
    // EU 1169/2011 zahteva, da so alergeni modifierjev upoštevani pri filtriranju
    // Brez tega gost z alergijo na mleko ne bi videl opozorila za sir kot dodatek
    const modifierGroups = (item as Record<string, unknown>).modifierGroups as Array<{
      modifierGroup?: { modifiers?: Array<{ allergens?: string }> }
    }> | undefined
    if (modifierGroups && Array.isArray(modifierGroups)) {
      for (const mg of modifierGroups) {
        const modifiers = mg.modifierGroup?.modifiers
        if (modifiers && Array.isArray(modifiers)) {
          for (const mod of modifiers) {
            if (mod.allergens) {
              const modCodes = mod.allergens.split(',').map((s: string) => s.trim()).filter(Boolean)
              if (modCodes.some(code => excludedAllergens.includes(code))) return false
            }
          }
        }
      }
    }

    return true
  })
}
