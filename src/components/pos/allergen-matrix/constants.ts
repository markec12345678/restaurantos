// ============================================
// TIPI IN KONSTANTE ZA ALERGENI MATRIKO
// ============================================

// ─── EU 14 alergenov (EU Reg. 1169/2011) ───────────────────────
export const EU_ALLERGENS = [
  { id: 'gluten', code: '1', label: 'Gluten', labelEn: 'Cereals containing gluten', icon: '\u{1F33E}', description: 'P\u0161enica, r\u017E, je\u010Dmen, oves, pira, kamut' },
  { id: 'crustaceans', code: '2', label: 'Rakovice', labelEn: 'Crustaceans', icon: '\u{1F990}', description: 'Raki, kozice, jastogi' },
  { id: 'eggs', code: '3', label: 'Jajca', labelEn: 'Eggs', icon: '\u{1F95A}', description: 'Jajca in izdelki iz jajc' },
  { id: 'fish', code: '4', label: 'Ribe', labelEn: 'Fish', icon: '\u{1F41F}', description: 'Vse vrste rib' },
  { id: 'peanuts', code: '5', label: 'Kikiriki', labelEn: 'Peanuts', icon: '\u{1F95C}', description: 'Kikiriki in izdelki' },
  { id: 'soybeans', code: '6', label: 'Soja', labelEn: 'Soybeans', icon: '\u{1FAD8}', description: 'Soja in izdelki' },
  { id: 'milk', code: '7', label: 'Mleko', labelEn: 'Milk', icon: '\u{1F95B}', description: 'Mleko in mle\u010Dni izdelki (vklju\u010Dno z laktozo)' },
  { id: 'nuts', code: '8', label: 'Ore\u0161ki', labelEn: 'Tree nuts', icon: '\u{1F330}', description: 'Mandeljni, le\u0161niki, orehi, indijski ore\u0161ki...' },
  { id: 'celery', code: '9', label: 'Zelena', labelEn: 'Celery', icon: '\u{1F96C}', description: 'Zelena in izdelki' },
  { id: 'mustard', code: '10', label: 'Gor\u010Dica', labelEn: 'Mustard', icon: '\u{1F7E1}', description: 'Gor\u010Dica in semena' },
  { id: 'sesame', code: '11', label: 'Sezam', labelEn: 'Sesame', icon: '\u26AA', description: 'Sezamova semena in izdelki' },
  { id: 'sulphites', code: '12', label: 'Sulfiti', labelEn: 'Sulphites', icon: '\u{1F9EA}', description: '\u017Dveplov dioksid (>10mg/kg)' },
  { id: 'lupin', code: '13', label: 'Vol\u010Dji bob', labelEn: 'Lupin', icon: '\u{1FAD8}', description: 'Lupina in izdelki' },
  { id: 'molluscs', code: '14', label: 'Mehku\u017Eci', labelEn: 'Molluscs', icon: '\u{1F41A}', description: '\u0160koljke, hobotnice, lignji' },
]

// ============================================
// TIPI
// ============================================

export interface MenuItem {
  id: string
  name: string
  price: number
  category?: { name: string }
  allergens?: string // JSON string array
  isAvailable: boolean
}

export interface AllergenCount {
  id: string
  code: string
  label: string
  labelEn: string
  icon: string
  count: number
}

// ============================================
// POMOZNE FUNKCIJE
// ============================================

// Parse allergens — FIX: Podpira tako comma-separated codes ("1,3,7") kot JSON array IDs (["gluten","eggs"])
// AllergenFilter shrani comma-separated, AllergenMatrix je prej shranjeval JSON — zdaj consistent
export function parseAllergens(allergensStr?: string): string[] {
  if (!allergensStr) return []
  // Najprej poskusi kot comma-separated codes (pravilen format)
  const trimmed = allergensStr.trim()
  if (/^[\d,]+$/.test(trimmed) || /^[\d,\s]+$/.test(trimmed)) {
    // Comma-separated codes: "1,3,7" → preslikaj v IDs
    return trimmed.split(',').map(s => s.trim()).filter(Boolean).map(code => {
      const found = EU_ALLERGENS.find(a => a.code === code)
      return found ? found.id : ''
    }).filter(Boolean)
  }
  // Fallback: poskusi kot JSON array
  try {
    const parsed = JSON.parse(allergensStr)
    if (Array.isArray(parsed)) {
      // Če so kode (numbers), preslikaj v IDs
      return parsed.map((item: string | number) => {
        const str = String(item)
        const found = EU_ALLERGENS.find(a => a.code === str || a.id === str)
        return found ? found.id : ''
      }).filter(Boolean)
    }
  } catch {
    // Fallback: poskusi kot comma-separated z imeni
    return trimmed.split(',').map(s => s.trim()).map(name => {
      const found = EU_ALLERGENS.find(a => a.id === name || a.label === name)
      return found ? found.id : ''
    }).filter(Boolean)
  }
  return []
}

// ============================================
// PROPS INTERFACES ZA POD-KOMPONENTE
// ============================================

export interface StatsCardsProps {
  totalItems: number
  itemsWithAllergens: number
  itemsWithoutAllergens: number
  topAllergen: AllergenCount | undefined
}

export interface AllergenFrequencyProps {
  allergenCounts: AllergenCount[]
  totalItems: number
}

export interface AllergenFiltersProps {
  searchQuery: string
  onSearchQueryChange: (_value: string) => void
  categoryFilter: string
  onCategoryFilterChange: (_value: string) => void
  categories: string[]
  showOnlyWithAllergens: boolean
  onShowOnlyWithAllergensChange: (_value: boolean) => void
}

export interface AllergenTableProps {
  filteredItems: MenuItem[]
  sortField: 'name' | 'allergens'
  sortDir: 'asc' | 'desc'
  onSortFieldChange: (_field: 'name' | 'allergens') => void
  onSortDirToggle: () => void
  onEditItem: (_item: MenuItem) => void
}

export interface EuDisclaimerProps {
  // Brez dodatnih propsov — čisto prezentacijska
}

export interface EditAllergenDialogProps {
  open: boolean
  editItem: MenuItem | null
  editAllergens: string[]
  onOpenChange: (_open: boolean) => void
  onEditAllergensChange: (_allergens: string[]) => void
  onSave: () => void
  isPending: boolean
}
