// =====================================================================
// Display kontekst (R136-c) — deep link /display?loc=<locationId>[&name=<ime>]
//  - URL je vir resnice ob PRVEM nalaganju (loc OBVEZEN; regex fail-closed)
//  - kontekst se persistira v sessionStorage ('display-context'), da refresh
//    ohrani nastavitev (TV/brskalnik se lahko ponovno zažene brez URL-ja)
//  - loc, ki JE podan a NE ustreza regexu → null (ConfigError zaslon) in NE
//    tihi fallback na staro lokacijo (brief: "manjkajoč/napačen loc → error")
//  - name je OPCIJSKI prikazni label glave ("Naročila — <name>"): strežniški
//    kontrakt (R136-b) ne vrača imena lokacije, zato ga nastavi skrbnik v URL
// Čisti helperji brez Reacta — ist vzorec kot kiosk/kiosk-context.ts (R135-c).
// =====================================================================

const DISPLAY_CONTEXT_KEY = 'display-context'

/** isti regex kot strežniška fail-closed validacija (kiosk/availability kanon) */
const LOCATION_ID_REGEX = /^[a-z0-9]{5,50}$/i

export interface DisplayContext {
  locationId: string
  /** opcijski prikazni label (URL ?name=) — samo dolžina se omeji (max 40) */
  name?: string
}

function sanitizeName(raw: string | null): string | undefined {
  const name = (raw?.trim() ?? '').slice(0, 40)
  return name || undefined
}

/** Preberi kontekst iz URL-ja (prvo nalaganje) ali sessionStorage (refresh). */
export function resolveDisplayContext(): DisplayContext | null {
  if (typeof window === 'undefined') return null
  // 1) Če je loc v URL-ju, je URL VIR RESNICE — napačen format → fail-closed
  try {
    const params = new URLSearchParams(window.location.search)
    const locRaw = params.get('loc')
    if (locRaw !== null) {
      const loc = locRaw.trim()
      if (!LOCATION_ID_REGEX.test(loc)) return null
      const ctx: DisplayContext = { locationId: loc, name: sanitizeName(params.get('name')) }
      persistDisplayContext(ctx)
      return ctx
    }
  } catch {
    // URLSearchParams nedostopen (ekstremni primer) — poskusi sessionStorage
  }
  // 2) loc NI v URL-ju (refresh scenarij) → sessionStorage ohrani kontekst
  try {
    const raw = window.sessionStorage.getItem(DISPLAY_CONTEXT_KEY)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    if (parsed && typeof parsed === 'object') {
      const rec = parsed as { locationId?: unknown; name?: unknown }
      if (
        typeof rec.locationId === 'string' &&
        LOCATION_ID_REGEX.test(rec.locationId)
      ) {
        return {
          locationId: rec.locationId,
          name: typeof rec.name === 'string' && rec.name ? rec.name : undefined,
        }
      }
    }
  } catch {
    // pokvarjen zapis → konteksta ni (fail-closed → config error zaslon)
  }
  return null
}

function persistDisplayContext(ctx: DisplayContext): void {
  try {
    window.sessionStorage.setItem(DISPLAY_CONTEXT_KEY, JSON.stringify(ctx))
  } catch {
    // Quota/private-mode — persistanca ni kritična (URL ostane vir resnice)
  }
}
