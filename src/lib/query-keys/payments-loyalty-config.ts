// ============================================
// QUERY KEYS — Plačila, Darilne kartice, Zvestoba, Namigi, Konfiguracija
// ============================================

export const altPaymentsKeys = {
  all: ['alt-payments'] as const,
  types: ['alt-payment-types'] as const,
}

export const checksKeys = {
  all: ['checks'] as const,
}

export const giftCardsKeys = {
  all: ['gift-cards'] as const,
  // R144-c (epic #115 #31): agregat pasivne obveznosti darilnih kartic
  // (GET /api/gift-cards/liability) — loyaltyKeys.lifecycle precedens.
  // Podrejena tipka ['gift-cards', 'liability'] je HIERARHIČNO pokrita z
  // invalidateQueries({ queryKey: ['gift-cards'] }) (useGiftCardMutations)
  // → po create/load/edit/delete se sekcija sama osveži.
  liability: () => ['gift-cards', 'liability'] as const,
}

export const loyaltyKeys = {
  all: ['loyalty'] as const,
  search: (query: string) => ['loyalty', { query }] as const,
  // R143-c (epic #115 #30): agregat življenjskega cikla (GET /api/loyalty/lifecycle)
  lifecycle: () => ['loyalty', 'lifecycle'] as const,
}

export const tipPoolKeys = {
  // R145-c (epic #115 #32): ENOTEN koren. Prej sta obstajali DVE nesorjeni
  // korena — `all: ['tip-pools']` (listing) in `byDate: ['tip-pool', date]`
  // (aktualni pool) — zato invalidacija ['tip-pool'] NI pokrila listinga in
  // obratno (audit R145-a Q3-8). byDate je zdaj PODREJEN pluralnemu korenu →
  // invalidateQueries({ queryKey: tipPoolKeys.all }) hierarhično pokrije
  // VSE tip-pool poizvedbe (giftCardsKeys precedens).
  all: ['tip-pools'] as const,
  byDate: (date: string) => ['tip-pools', date] as const,
}

export const configurationKeys = {
  byTab: (tab: string) => ['configuration', tab] as const,
  settings: ['settings'] as const,
  priceGroups: ['price-groups'] as const,
  priceGroupsHH: ['price-groups-hh'] as const,
  happyHourConfig: ['happy-hour-config'] as const,
  openingHours: ['opening-hours'] as const,
  happyHourStatus: ['happy-hour-status'] as const,
}
