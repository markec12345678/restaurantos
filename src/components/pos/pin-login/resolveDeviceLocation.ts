// ============================================
// DEVICE LOKACIJA — resolvanje dvostopenjskega prijavnega toka (R95-b)
// ============================================
//
// NAMEN (R95-0 frozen plan): dvostopenjska prijava (izbira zaposlenega → PIN)
// je AKTIVNA samo, ko naprava VE svojo lokacijo. Viri po prioriteti:
//   1. URL param `?locationId=` na trenutni strani (kiosk deep-link),
//   2. localStorage 'restaurantos-pos-device-location' (persistirana lokacija
//      iz prejšnje uspešne prijave),
//   3. null → single-step PIN-only zaslon (STOTAKO kot danes — E2E
//      kompatibilnost: /?PIN prijava ostane single-step, brez employeeId).
//
// Izvlečeno iz usePinLogin v čisti helper (runda 25 vzorec: testabilnost
// brez react-query / komponent — hitri jsdom testi).

/** localStorage ključ za lokacijo naprave (R95-0 frozen plan — house konvencija plain string). */
export const DEVICE_LOCATION_STORAGE_KEY = 'restaurantos-pos-device-location'

/**
 * Parsa surovo localStorage vrednost → locationId ALI null.
 * House konvencija: pišemo PLAIN string, branje pa preživi tudi JSON-string
 * zapis ('"loc-1"'). Vrednosti, ki se začnejo z navedkom, se tretirajo kot
 * JSON string literali (pokvarjen JSON → null = varnostneje kot smeti v API
 * klicu); vse ostalo gre skozi kot plain string (tudi numerično vidni '42').
 */
export function parseDeviceLocationValue(raw: string | null | undefined): string | null {
  if (typeof raw !== 'string') return null
  const trimmed = raw.trim()
  if (!trimmed) return null
  if (trimmed.startsWith('"')) {
    try {
      const parsed: unknown = JSON.parse(trimmed)
      if (typeof parsed === 'string' && parsed.trim()) return parsed.trim()
    } catch {
      // pokvarjen JSON-string zapis → ignoriraj (ni oraklja, samo fallback)
    }
    return null
  }
  return trimmed
}

export interface ResolveDeviceLocationInput {
  /** Search del URL-ja ALI že parsan URLSearchParams (testabilnost). */
  urlSearch?: string | URLSearchParams | null
  /** Surova localStorage vrednost ALI null (ključ manjka). */
  storedRaw?: string | null
}

/**
 * Čista resolucija device lokacije: URL param > localStorage > null.
 * Brez window dostopa — klical jo lahko tudi test/SSR kontekst.
 */
export function resolveDeviceLocation(input: ResolveDeviceLocationInput = {}): string | null {
  const params = input.urlSearch instanceof URLSearchParams
    ? input.urlSearch
    : new URLSearchParams(input.urlSearch ?? '')
  const fromUrl = (params.get('locationId') ?? '').trim()
  if (fromUrl) return fromUrl
  return parseDeviceLocationValue(input.storedRaw)
}

/**
 * Client-only branje obeh virov (kliči IZ useEffect — NIKOLI med renderjem,
 * drugače SSR hydration mismatch + window ni definiran na strežniku).
 */
export function readDeviceLocation(): string | null {
  try {
    if (typeof window === 'undefined') return null
    const storedRaw = window.localStorage
      ? window.localStorage.getItem(DEVICE_LOCATION_STORAGE_KEY)
      : null
    return resolveDeviceLocation({ urlSearch: window.location.search, storedRaw })
  } catch {
    // localStorage lahko vrže (private mode / blokiran) → single-step fallback
    return null
  }
}

/**
 * Persistiraj/potrdi lokacijo naprave — SAMO po USPEŠNI prijavi in SAMO, če
 * je bil dvostopenjski tok aktiven (vir URL/localStorage že imamo). Ob
 * neuspešni prijavi NE shranjujemo NIČesar (R95-b pravilo). Neuspel zapis
 * (private mode, quota) ne sme porušiti uspešne prijave.
 */
export function persistDeviceLocation(locationId: string): void {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return
    if (window.localStorage.getItem(DEVICE_LOCATION_STORAGE_KEY) === locationId) return
    window.localStorage.setItem(DEVICE_LOCATION_STORAGE_KEY, locationId)
  } catch {
    // tiho — persist je čisto opcijska potrditev obstoječe lokacije
  }
}
