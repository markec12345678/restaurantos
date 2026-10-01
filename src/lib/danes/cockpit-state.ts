// ============================================
// DANES COCKPIT STATE — #148 korak 1 (R203, issue #148)
// ============================================
// State stroj za 7 endpoint virov kokpita: LOADING / READY / EMPTY / ERROR /
// UNAUTHORIZED. Osnova: issue #148 P0-B — ERROR ≠ EMPTY ≠ UNAUTHORIZED ≠ READY.
//
// NAMEN: kokpit nikoli ne sme prikazati napake/unavtorizacije kot veljavno
// poslovno stanje (defekt R175: zeleno "vse v redu" ob ERROR/401 — popravljeno
// R203). Strežnik ostaja avtoritativen (requireAuth v route fajlih); odjemalska
// capability matrica je izpeljana z ENAKO semantiko kot
// src/lib/auth-middleware/permissions.ts hasPermission (pariteta pina v testih).
//
// Čisto (brez React importov) — deterministično unit-testabilno.
// ============================================

/** 7 virov kokpita (kompozicija R175, permission pin proti route fajlom v testih) */
export type DanesSourceId =
  | 'alerts'
  | 'kitchen'
  | 'dashboard'
  | 'cash'
  | 'reservations'
  | 'menuStock'
  | 'outbox'

export const DANES_SOURCE_IDS: DanesSourceId[] = [
  'alerts',
  'kitchen',
  'dashboard',
  'cash',
  'reservations',
  'menuStock',
  'outbox',
]

/** #148 P0-B kanon: 5 stanj per vir — UI ne sme konfluirati ERROR/EMPTY/UNAUTHORIZED */
export type DanesSourceState = 'LOADING' | 'READY' | 'EMPTY' | 'ERROR' | 'UNAUTHORIZED'

/** Stran kot celota: UNAUTHORIZED = seja potekla/ni dostopa; ERROR = vsi aktivni viri padli */
export type DanesPageState = 'READY' | 'PARTIAL' | 'ERROR' | 'UNAUTHORIZED'

// — HTTP napaka s statusom (fetchJson v DanesCockpit meče to) —

export class DanesHttpError extends Error {
  readonly status: number
  constructor(status: number, message?: string) {
    super(message ?? `HTTP ${status}`)
    this.name = 'DanesHttpError'
    this.status = status
  }
}

/**
 * Izvleči HTTP status iz napake. Podpira obe obliki:
 *  - DanesHttpError (.status property)
 *  - legacy Error('HTTP <status>') (stari fetchJson format, R175)
 * Vrne null za neto napake / malformed JSON (SyntaxError) — te so ERROR, ne UNAUTHORIZED.
 */
export function errorStatus(err: unknown): number | null {
  if (!err || typeof err !== 'object') return null
  const asObj = err as { status?: unknown; message?: unknown }
  if (typeof asObj.status === 'number' && Number.isInteger(asObj.status) && asObj.status >= 100) {
    return asObj.status
  }
  if (typeof asObj.message === 'string') {
    const m = /^HTTP (\d{3})$/.exec(asObj.message)
    if (m) return Number(m[1])
  }
  return null
}

/** 401/403 = UNAUTHORIZED (seja/vloga); 429/5xx/neto/malformed = ERROR */
export function isAuthError(err: unknown): boolean {
  const s = errorStatus(err)
  return s === 401 || s === 403
}

// — Deriver stanja per vir —

/** Minimalna oblika React Query rezultata, ki jo deriver bere */
export interface DanesQueryShape {
  isLoading: boolean
  isError: boolean
  data: unknown
  error: unknown
}

/**
 * Pravila (fail-closed, deterministično):
 *  1. isError + 401/403          → UNAUTHORIZED
 *  2. isError (429/5xx/neto)     → ERROR
 *  3. isLoading                  → LOADING
 *  4. uspešen odgovor brez data  → ERROR (malformed — nikoli "prazno OK")
 *  5. data + isEmpty(data)       → EMPTY
 *  6. sicer                      → READY
 */
export function deriveDanesSourceState(
  shape: DanesQueryShape,
  isEmpty?: (data: unknown) => boolean,
): DanesSourceState {
  if (shape.isError) return isAuthError(shape.error) ? 'UNAUTHORIZED' : 'ERROR'
  if (shape.isLoading) return 'LOADING'
  if (shape.data == null) return 'ERROR'
  if (isEmpty && isEmpty(shape.data)) return 'EMPTY'
  return 'READY'
}

// — Capability matrica (odjemalska zrcalna slika strežniške avtorizacije) —

/**
 * Strežniško verificirane permission zahteve per vir — preverjeno proti
 * requireAuth v route fajlih (fs-pini v tests/unit/lib/danes-cockpit-state.test.ts):
 *   /api/operational-alerts → view_reports
 *   /api/kitchen            → take_orders
 *   /api/dashboard          → view_reports
 *   /api/cash-register      → manage_cash
 *   /api/reservations       → take_orders
 *   /api/inventory/menu-stock → take_orders | manage_inventory (any-of)
 *   /api/outbox (GET)       → view_reports
 * any-of semantika (=== strežniški requiredPerms.some()).
 */
export const DANES_SOURCE_PERMISSIONS: Record<DanesSourceId, string[]> = {
  alerts: ['view_reports'],
  kitchen: ['take_orders'],
  dashboard: ['view_reports'],
  cash: ['manage_cash'],
  reservations: ['take_orders'],
  menuStock: ['take_orders', 'manage_inventory'],
  outbox: ['view_reports'],
}

/** Minimalna oblika odjemalskega AuthUser (pin-login/constants.ts AuthUser podmnožica) */
export interface DanesAuthUser {
  role: string
  permissions: string[]
}

/**
 * Pariteta s src/lib/auth-middleware/permissions.ts hasPermission:
 *   admin → vedno true; manager → vse razen 'admin' zahtev; sicer any-of intersect.
 * Strežnik je avtoritativen — klient samo izpelje pričakovanje (UI skrivanje ≠ avtorizacija).
 */
export function danesHasPermission(user: DanesAuthUser | null | undefined, required: string[]): boolean {
  if (!user) return false
  if (user.role === 'admin') return true
  if (user.role === 'manager' && !required.includes('admin')) return true
  if (required.length === 0) return true
  return required.some((p) => user.permissions.includes(p))
}

/** Per-vir enabled matrika za trenutnega uporabnika (disabled vir = UNAUTHORIZED stanje) */
export function resolveDanesCapabilities(
  user: DanesAuthUser | null | undefined,
): Record<DanesSourceId, boolean> {
  const out = {} as Record<DanesSourceId, boolean>
  for (const id of DANES_SOURCE_IDS) out[id] = danesHasPermission(user, DANES_SOURCE_PERMISSIONS[id])
  return out
}

// — Tipizirano usmerjanje alertov (deep-link prek setActiveModule) —

/**
 * Ekspliciten seznam nad 8 znanimi tipi iz /api/operational-alerts (fs-pin v testih).
 * Defekt R175 (startsWith/includes hevristika) je odstranjen — neznan tip gre na
 * nevtralni 'dashboard' fallback, nikoli na hevristično ugibanje.
 */
export const ALERT_TARGET_MODULE: Record<string, string> = {
  delayed_order: 'kitchen',
  kot_not_started: 'kitchen',
  unclosed_bill: 'tables',
  table_long_occupied: 'tables',
  low_stock: 'inventory',
  unfiscalized_receipts: 'cash-register',
  shift_too_long: 'shifts',
  excessive_cancellations: 'reports',
}

export const ALERT_FALLBACK_MODULE = 'dashboard'

export function alertTargetModule(type: string): string {
  return ALERT_TARGET_MODULE[type] ?? ALERT_FALLBACK_MODULE
}

// — Stran kot celota —

/**
 * Pravila strani (samo ENABLED viri se štejejo):
 *  - 0 aktivnih                     → UNAUTHORIZED (uporabnik brez dostopa do česa koli)
 *  - kateri koli aktivni UNAUTHORIZED → UNAUTHORIZED (401 = seja potekla globalno)
 *  - vsi aktivni ERROR              → ERROR (celostranska napaka)
 *  - vsi aktivni READY/EMPTY        → READY
 *  - mešanica                       → PARTIAL (per-kartica stanja vidna)
 */
export function deriveDanesPageState(
  enabled: Record<DanesSourceId, boolean>,
  states: Record<DanesSourceId, DanesSourceState>,
): DanesPageState {
  const active = DANES_SOURCE_IDS.filter((id) => enabled[id])
  if (active.length === 0) return 'UNAUTHORIZED'
  const s = active.map((id) => states[id])
  if (s.includes('UNAUTHORIZED')) return 'UNAUTHORIZED'
  if (s.every((x) => x === 'ERROR')) return 'ERROR'
  if (s.every((x) => x === 'READY' || x === 'EMPTY')) return 'READY'
  return 'PARTIAL'
}
