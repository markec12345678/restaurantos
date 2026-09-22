// ============================================
// PAGINATION / QUERY PARAM VALIDACIJA (P1-16)
// ============================================
// Centralni vir za varno razčlenjevanje pagination query parametrov.
//
// Specifikacija (uporabnik, P1-16):
//   limit max = 100        → PAGINATION_MAX_LIMIT
//   search max length = 100 → MAX_SEARCH_LENGTH
//   offset >= 0 (negativen/NaN → 0)
//
// UTEMELJENE izjeme (report/bulk workload) smejo podati višji `maxLimit`
// samo z izrecnim argumentom in komentarjem v rutah:
//   - /api/orders      → 500 (poslovna poročila pridobijo plačana naročila)
//   - /api/menu-items  → 500 (POS meni browser naloži celoten jedilnik)
//   - /api/inventory   → 500 (skladiščni dashboard; prej 2000 — zmanjšano)
//
// `search` se REŽE na MAX_SEARCH_LENGTH znakov (ne zavrne — legitimni
// dolgi iskalni nizi uporabnikov ne smejo zlomiti UI-ja; prekomerno
// dolg niz ne nosi dodatne varnostne teže, ker se uporabi kot Prisma
// `contains` filter in je dolžinsko omejen v query načrtu).

/** Privzeti maksimum `limit` (specifikacija P1-16). */
export const PAGINATION_MAX_LIMIT = 100
/** Privzeti maksimum dolžine `search` niza (specifikacija P1-16). */
export const MAX_SEARCH_LENGTH = 100
/** Najvišji dovoljen `limit` za utemeljene bulk/report scenarije. */
export const BULK_MAX_LIMIT = 500

export interface PaginationParams {
  /** Veljavna vrednost `limit` (1..maxLimit) */
  limit: number
  /** Veljavna vrednost `offset` (>= 0) */
  offset: number
  /** `search` niz, režen na MAX_SEARCH_LENGTH */
  search: string
}

/**
 * Razčleni in sanitiziraj pagination + search query parametre.
 *
 * Pravila:
 *   - limit: NaN/negativen/0 → defaultLimit; > maxLimit → maxLimit (clamp, ne napaka)
 *   - offset: NaN/negativen → 0
 *   - search: null → ''; dolžina > 100 → režemo na 100
 *
 * @param searchParams URLSearchParams iz zahtevka
 * @param options defaultLimit (privzeto 100), maxLimit (privzeto PAGINATION_MAX_LIMIT)
 */
export function parsePaginationParams(
  searchParams: URLSearchParams,
  options?: { defaultLimit?: number; maxLimit?: number },
): PaginationParams {
  const defaultLimit = options?.defaultLimit ?? PAGINATION_MAX_LIMIT
  const maxLimit = Math.min(
    options?.maxLimit ?? PAGINATION_MAX_LIMIT,
    BULK_MAX_LIMIT,
  )

  const rawLimit = parseInt(searchParams.get('limit') || '', 10)
  const rawOffset = parseInt(searchParams.get('offset') || '', 10)
  const rawSearch = searchParams.get('search') || ''

  // limit: 0/negativen/NaN nima smisla → default; prevelik → clamp
  let limit = Number.isNaN(rawLimit) || rawLimit < 1 ? defaultLimit : rawLimit
  if (limit > maxLimit) limit = maxLimit

  const offset = Number.isNaN(rawOffset) || rawOffset < 0 ? 0 : rawOffset

  const search = rawSearch.length > MAX_SEARCH_LENGTH
    ? rawSearch.slice(0, MAX_SEARCH_LENGTH)
    : rawSearch

  return { limit, offset, search }
}
