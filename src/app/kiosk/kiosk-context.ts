// =====================================================================
// Kiosk kontekst (R135-c) — deep link /kiosk?loc=<locationId>&t=<orderingToken>
//  - URL je vir resnice ob PRVEM nalaganju (oba parametra OBVEZNA)
//  - loc+t se persistirata v sessionStorage ('kiosk-context'), da refresh
//    ohrani kontekst (kiosk brskalnik se lahko ponovno zažene brez URL-ja)
//  - deviceId se generira ENKRAT na brskalnik (localStorage 'kiosk-device-id',
//    format 'kiosk-<random>' — ustreza POST regexu /^[a-zA-Z0-9_-]+$/ ≤64)
//  - idempotencyKey za POST (crypto.randomUUID + fallback)
// Čisti helperji brez Reacta — ist vzorec kot use-order-state readOrderingUrlContext.
// =====================================================================

const KIOSK_CONTEXT_KEY = 'kiosk-context'
const KIOSK_DEVICE_KEY = 'kiosk-device-id'

export interface KioskContext {
  locationId: string
  token: string
}

/** Naključni niz iz [a-z0-9] (crypto, z Math.random fallbackom) */
function randomToken(len: number): string {
  try {
    const bytes = new Uint8Array(len)
    crypto.getRandomValues(bytes)
    let out = ''
    for (let i = 0; i < len; i++) out += (bytes[i] % 36).toString(36)
    return out
  } catch {
    let out = ''
    for (let i = 0; i < len; i++) out += Math.floor(Math.random() * 36).toString(36)
    return out
  }
}

/** Preberi loc+t iz URL-ja (prvo nalaganje) ali sessionStorage (refresh). */
export function resolveKioskContext(): KioskContext | null {
  if (typeof window === 'undefined') return null
  // 1) URL parametra sta OBVEZNA ob prvem nalaganju (vir resnice)
  try {
    const params = new URLSearchParams(window.location.search)
    const loc = params.get('loc')?.trim() || ''
    const token = params.get('t')?.trim() || ''
    if (loc && token) {
      persistKioskContext({ locationId: loc, token })
      return { locationId: loc, token }
    }
  } catch {
    // URLSearchParams nedostopen (ekstremni primer) — poskusi sessionStorage
  }
  // 2) Refresh brez URL-ja → sessionStorage ohrani kontekst
  try {
    const raw = window.sessionStorage.getItem(KIOSK_CONTEXT_KEY)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    if (parsed && typeof parsed === 'object') {
      const rec = parsed as { locationId?: unknown; token?: unknown }
      if (
        typeof rec.locationId === 'string' && rec.locationId &&
        typeof rec.token === 'string' && rec.token
      ) {
        return { locationId: rec.locationId, token: rec.token }
      }
    }
  } catch {
    // pokvarjen zapis → konteksta ni (fail-closed → config error zaslon)
  }
  return null
}

function persistKioskContext(ctx: KioskContext): void {
  try {
    window.sessionStorage.setItem(KIOSK_CONTEXT_KEY, JSON.stringify(ctx))
  } catch {
    // Quota/private-mode — persistanca ni kritična (URL ostane vir resnice)
  }
}

/**
 * deviceId naprave — generiran ENKRAT, shranjen v localStorage.
 * Prazni string pomeni "nedostopno skladišče" → POST pošlje brez deviceId
 * (schema je optional; prazen niz bi padel skozi regex → zato NE pošiljaj).
 */
export function getKioskDeviceId(): string {
  if (typeof window === 'undefined') return ''
  try {
    const existing = window.localStorage.getItem(KIOSK_DEVICE_KEY)
    if (existing && /^[a-zA-Z0-9_-]{1,64}$/.test(existing)) return existing
    const id = `kiosk-${randomToken(20)}`
    window.localStorage.setItem(KIOSK_DEVICE_KEY, id)
    return id
  } catch {
    return ''
  }
}

/** idempotencyKey za checkout (≤100 znakov; POST schema optional) */
export function createIdempotencyKey(): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID()
    }
  } catch {
    // crypto nedostopen — fallback spodaj
  }
  return `kiosk-${Date.now().toString(36)}-${randomToken(12)}`
}
