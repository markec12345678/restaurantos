// ============================================
// REGISTRY — izbor starter template-ov (issue #114 §1)
// Novi template-i se dodajo TUKAJ (import + vnos v TEMPLATES) — brez
// kopiranja seed sistema. Dodajanje = en import + ena vrstica.
// ============================================
import type { StarterCatalogTemplate, VenueType, VenueTypeSummary } from './types'
import { gostilnaTemplate } from './templates/gostilna'
import { restavracijaTemplate } from './templates/restavracija'
import { pizzerijaTemplate } from './templates/pizzerija'
import { barTemplate } from './templates/bar'
import { kavarnaTemplate } from './templates/kavarna'
import { fastFoodTemplate } from './templates/fast-food'

export type { StarterCatalogTemplate, VenueType, VenueTypeSummary } from './types'
export { VENUE_TYPE_IDS } from './types'

const TEMPLATES: Record<VenueType, StarterCatalogTemplate> = {
  gostilna: gostilnaTemplate,
  restavracija: restavracijaTemplate,
  pizzerija: pizzerijaTemplate,
  bar: barTemplate,
  kavarna: kavarnaTemplate,
  fast_food: fastFoodTemplate,
}

/** Vrne starter template za podani tip lokala ali null (neznani tip). */
export function getStarterTemplate(venueType: string): StarterCatalogTemplate | null {
  return (venueType in TEMPLATES ? TEMPLATES[venueType as VenueType] : null) ?? null
}

/** Vsi veljavni tipi lokala (kanonični vrstni red). */
export function listVenueTypes(): VenueType[] {
  return Object.keys(TEMPLATES) as VenueType[]
}

/** Lahka metapodatkovna vrstica za UI (setup wizard, starter dialog). */
export function listVenueTypeSummaries(): VenueTypeSummary[] {
  return Object.values(TEMPLATES).map((t) => ({
    id: t.id,
    label: t.label,
    icon: t.icon,
    description: t.description,
    categoryCount: t.categories.length,
    itemCount: t.categories.reduce((sum, c) => sum + c.items.length, 0),
  }))
}

/** Izvoz za klienta (UI mora znati izrisati izbiro brez strežniškega klica). */
export const VENUE_TYPES: VenueTypeSummary[] = listVenueTypeSummaries()
