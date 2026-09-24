// ============================================
// ONBOARDING CATALOG TEMPLATES — javni izvoz (issue #114)
// Klientsko varno (čista podatkovna struktura, brez strežniških odvisnosti).
// ============================================
export {
  VENUE_TYPES,
  VENUE_TYPE_IDS,
  getStarterTemplate,
  listVenueTypes,
  listVenueTypeSummaries,
} from './registry'
export type {
  VenueType,
  StarterCatalogTemplate,
  StarterCategory,
  StarterMenuItem,
  StarterModifier,
  StarterModifierGroup,
  VenueTypeSummary,
} from './types'
