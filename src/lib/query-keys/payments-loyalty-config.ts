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
}

export const loyaltyKeys = {
  all: ['loyalty'] as const,
  search: (query: string) => ['loyalty', { query }] as const,
}

export const tipPoolKeys = {
  all: ['tip-pools'] as const,
  byDate: (date: string) => ['tip-pool', date] as const,
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
