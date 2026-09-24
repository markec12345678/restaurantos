// ============================================
// STARTER CATALOG TEMPLATES (issue #114) — tipi
// ============================================
// Prvi-zagon onboarding: uporabnik izbere tip lokala, RestaurantOS pripravi
// profesionalen začetni katalog (kategorije, artikle, modifierje), ki je
// TAKOJ uporaben v POS in ga nato normalno ureja v MenuManagerju.
//
// Arhitektura:
//  • vsak template je čista deklarativna podatkovna struktura (deterministična)
//  • novi template-i se dodajo v templates/ + registry — BREZ kopiranja seed
//    sistema (/api/seed je destruktiven demo, TA sistem je produkcijski)
//  • aplikacija poteka izključno prek apply-starter-catalog.ts (idempotentno,
//    per-lokacijsko, brez nove sheme)
//
// ZALOGA (kritično, issue #114 §3):
//  • STARTER ARTIKLI NISO quantity = 0. Privzeto so BREZ InventoryItem vrstice
//    = "Brez omejitve / In Stock" (obstoječa semantika stock-deduction:
//    artikel brez InventoryItem/servingsPerUnit se ne razknjiži → vedno naprodaj).
//  • Omejeno zalogo uporabnik izbere izrecno (stockOverrides v wizardu /
//    kasneje v InventoryManagerju) — semantično ločeno od obstoja artikla.

/** Tip lokala za first-run onboarding (issue #114 §1). */
export const VENUE_TYPE_IDS = [
  'gostilna',
  'restavracija',
  'pizzerija',
  'bar',
  'kavarna',
  'fast_food',
] as const

export type VenueType = (typeof VENUE_TYPE_IDS)[number]

/** Posamezen modifier znotraj starter skupine. */
export interface StarterModifier {
  name: string
  /** Cena dodatka v EUR (0 = brez doplačila). */
  price: number
  sortOrder?: number
}

/** Skupina modifierjev, ki se pripne na izbrana starter artikla. */
export interface StarterModifierGroup {
  name: string
  required?: boolean
  minSelect?: number
  /** null = neomejeno (obstoječa semantika ModifierGroup.maxSelect). */
  maxSelect?: number | null
  sortOrder?: number
  modifiers: StarterModifier[]
  /** Imena starter artiklov (znotraj ISTEGA template-a), na katere se pripne. */
  attachToItems: string[]
}

/** Posamezen starter artikel. */
export interface StarterMenuItem {
  name: string
  description?: string
  /** Cena v EUR — PRIMERNA začetna vrednost, ne priporočeni cenik. */
  price: number
  /** DDV stopnja v % — privzete vrednosti sistema (22 / 9.5). */
  vatRate: number
  /** EU alergenske kode, ločene z vejico ("1,3,7") — obstoječi model. */
  allergens?: string
  sortOrder?: number
}

/** Kategorija znotraj starter kataloga. */
export interface StarterCategory {
  name: string
  icon: string
  color: string
  sortOrder?: number
  items: StarterMenuItem[]
}

/** Celoten starter template za en tip lokala. */
export interface StarterCatalogTemplate {
  id: VenueType
  label: string
  icon: string
  description: string
  /** Vrednost za obstoječe Location.type polje (brez spremembe sheme). */
  locationType: string
  /** Ime menija, ki se ustvari na lokaciji. */
  menuName: string
  categories: StarterCategory[]
  modifierGroups: StarterModifierGroup[]
}

/** Tip za UI preview (setup wizard + starter dialog): lahka metapodatkovna vrstica. */
export interface VenueTypeSummary {
  id: VenueType
  label: string
  icon: string
  description: string
  categoryCount: number
  itemCount: number
}
