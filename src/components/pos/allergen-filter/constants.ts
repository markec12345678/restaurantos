// ═══════════════════════════════════════════════════════════════
// RestaurantOS — Allergen Filter skupne tipi, konstante in pomožne funkcije
// EU 1169/2011 alergeni v naročanju, filtri menija, opozorila
// ═══════════════════════════════════════════════════════════════

// ─── EU 14 Alergeni (1169/2011) ──────────────────────────────────
export const EU_ALLERGENS = [
  { code: '1', name: '\u017dita (p\u0161enica, r\u017e, je\u010dmen, oves, pirid, kamut)', icon: '\u{1F33E}', color: '#d97706' },
  { code: '2', name: 'Raki in izdelki iz rakov', icon: '\u{1F990}', color: '#dc2626' },
  { code: '3', name: 'Jajca in izdelki z jajci', icon: '\u{1F95A}', color: '#f59e0b' },
  { code: '4', name: 'Ribe in ribji izdelki', icon: '\u{1F41F}', color: '#3b82f6' },
  { code: '5', name: 'Ara\u0161idi in izdelki z ara\u0161idi', icon: '\u{1F95C}', color: '#92400e' },
  { code: '6', name: 'Soja in sojini izdelki', icon: '\u{1FAD8}', color: '#65a30d' },
  { code: '7', name: 'Mleko in mle\u010dni izdelki (laktoza)', icon: '\u{1F95B}', color: '#f8fafc' },
  { code: '8', name: 'Ore\u0161ki (mandlji, le\u0161niki, orehi, indijski, ...)', icon: '\u{1F330}', color: '#92400e' },
  { code: '9', name: 'Zeler in izdelki iz zelerja', icon: '\u{1F96C}', color: '#16a34a' },
  { code: '10', name: 'Gor\u010dica in izdelki iz gor\u010dice', icon: '\u{1F7E1}', color: '#eab308' },
  { code: '11', name: 'Sesam (sezam) in izdelki', icon: '\u26AA', color: '#a1a1aa' },
  { code: '12', name: '\u017dveplov dioksid / sulfiti (>10mg/l)', icon: '\u{1F9EA}', color: '#8b5cf6' },
  { code: '13', name: 'Vol\u010dji bob (lupin) in izdelki', icon: '\u{1F338}', color: '#a855f7' },
  { code: '14', name: 'Mehku\u017eci in izdelki iz mehku\u017ecev', icon: '\u{1F41A}', color: '#06b6d4' },
]

export const DIETARY_FILTERS = [
  { id: 'vegetarian', name: 'Vegetarijansko', icon: '\u{1F96C}', color: '#16a34a' },
  { id: 'vegan', name: 'Vegansko', icon: '\u{1F331}', color: '#22c55e' },
  { id: 'gluten-free', name: 'Brez glutena', icon: '\u{1F33E}\u274C', color: '#d97706' },
  { id: 'lactose-free', name: 'Brez laktoze', icon: '\u{1F95B}\u274C', color: '#3b82f6' },
  { id: 'halal', name: 'Halal', icon: '\u{1F356}', color: '#16a34a' },
  { id: 'kosher', name: 'Ko\u0161er', icon: '\u2721\uFE0F', color: '#3b82f6' },
]

// ─── Props interfaces ───────────────────────────────────────────
export interface AllergenFilterBarProps {
  excludedAllergens: string[]
  onExcludedChange: (_allergens: string[]) => void
  dietaryFilters: string[]
  onDietaryChange: (_filters: string[]) => void
  activeFiltersCount: number
  onClear: () => void
}

export interface AllergenWarningDialogProps {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  itemName: string
  allergens: string
  guestAllergens: string[]
}

// ─── ModifierGroup tip za alergene ──────────────────────────────
export interface ModifierGroupForAllergens {
  modifierGroup?: { modifiers?: Array<{ allergens?: string }> }
}
