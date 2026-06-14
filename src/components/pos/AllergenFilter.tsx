'use client'

// ═══════════════════════════════════════════════════════════════
// RestaurantOS — Allergen Filter & Display
// EU 1169/2011 alergeni v naročanju, filtri menija, opozorila
// Toast POS standard za alergene in prehranske preference
// ═══════════════════════════════════════════════════════════════

import dynamic from 'next/dynamic'

// ─── Konstante in tipi (vedno sinhrono) ────────────────────────
export { EU_ALLERGENS, DIETARY_FILTERS } from './allergen-filter/constants'
export type { AllergenFilterBarProps, AllergenWarningDialogProps, ModifierGroupForAllergens } from './allergen-filter/constants'

// ─── Utility funkcije (vedno sinhrono) ─────────────────────────
export { checkAllergenConflict, checkAllergenConflictWithModifiers, filterItemsByAllergens } from './allergen-filter/utils'

// ─── Lazy-loaded podkomponente ──────────────────────────────────
export const AllergenBadge = dynamic(() => import('./allergen-filter/AllergenBadge').then(m => ({ default: m.AllergenBadge })), { ssr: false })
export const AllergenFilterBar = dynamic(() => import('./allergen-filter/AllergenFilterBar').then(m => ({ default: m.AllergenFilterBar })), { ssr: false })
export const AllergenWarningDialog = dynamic(() => import('./allergen-filter/AllergenWarningDialog').then(m => ({ default: m.AllergenWarningDialog })), { ssr: false })
