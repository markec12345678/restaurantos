// ============================================
// R142-c (epic #115 #29) — Center naprav (Device center)
// TIPI (zrcalijo GET /api/devices kontrakt R142-b), badge mape
// (BUG-04 kanon: literal razredi + ?? UNKNOWN fallback) in čisti
// pomožniki. Samo izvozi — cilj enotnega testa.
// ============================================

import type { BriefingBadgeConfig } from '@/components/pos/briefing/constants'

// --- Tipi (kontrakt R142-a/R142-b; JSON odgovor GET /api/devices) ---

/** Vrstica naprave — whitelist DEVICE_SELECT + computed isOnline (R142-b). */
export interface DeviceRow {
  id: string
  /** Hardware ID / browser fingerprint (@unique) */
  deviceId: string
  name: string
  /** pos | kds | kiosk | tablet | mobile (Prisma komentar) — UI prikaz prek badge mape */
  type: string
  /** DB status (online|offline) — UI NE zaupava temu; status badge iz isOnline */
  status: string
  /** ISO timestamp zadnje prijave (JSON serializacija DateTime) — null = nikoli */
  lastSeenAt: string | null
  appVersion: string
  locationId: string | null
  /** Server computed (R142-b): lastSeenAt ≥ now − 5 min. EDEN vir resnice za UI status. */
  isOnline: boolean
  location: { name: string; code: string } | null
}

export interface DevicesResponse {
  devices: DeviceRow[]
  count: number
}

/** Vrstica KPI kartice (StatsCard) */
export interface KpiRow {
  title: string
  value: number
  subtitle?: string
}

/** Skupina naprav po lokaciji (groupDevicesByLocation izhod) */
export interface DeviceLocationGroup {
  /** locationId ali '__none__' za naprave brez lokacije */
  key: string
  label: string
  devices: DeviceRow[]
}

// --- Badge mape (BUG-04 kanon: celoten Tailwind razred je LITERAL v mapi —
//     NIKOLI dinamičnih konkatenacij; brez modrih/indigo tonov — hišno
//     pravilo, paleta red/amber/emerald/zinc; ?? UNKNOWN fallback) ---

/** Tip naprave (Prisma DeviceRegistry.type komentar: pos|kds|tablet|mobile|kiosk) */
export const DEVICE_TYPES = ['pos', 'kds', 'kiosk', 'tablet', 'mobile'] as const

export const DEVICE_TYPE_BADGES: Record<string, BriefingBadgeConfig> = {
  pos:    { label: 'Prodajno mesto', className: 'border-emerald-300 bg-emerald-100 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' },
  kds:    { label: 'Kuhinja (KDS)',  className: 'border-amber-300 bg-amber-100 text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300' },
  kiosk:  { label: 'Kiosk',          className: 'border-zinc-300 bg-zinc-100 text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300' },
  tablet: { label: 'Tablica',        className: 'border-amber-300 bg-amber-100 text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300' },
  mobile: { label: 'Mobilno',        className: 'border-zinc-300 bg-zinc-100 text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300' },
}

export const DEVICE_TYPE_UNKNOWN: BriefingBadgeConfig = {
  label: 'Neznano',
  className: 'border-zinc-300 bg-zinc-100 text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300',
}

/**
 * Status naprave — deriviran IZKLJUČNO iz isOnline (R142-a/B kontrakt:
 * DB `status` stolpec ostane klient domena, 'sleeping' nikoli ne nastane v
 * kodi → UI NE izmišljuje stanj; neznana vrednost (undefined/null) → 'Neznano').
 */
export type DeviceStatusKey = 'online' | 'offline' | 'unknown'

export function deviceStatusKey(isOnline: boolean | null | undefined): DeviceStatusKey {
  if (isOnline === true) return 'online'
  if (isOnline === false) return 'offline'
  return 'unknown'
}

export const DEVICE_STATUS_BADGES: Record<Exclude<DeviceStatusKey, 'unknown'>, BriefingBadgeConfig> = {
  online:  { label: 'Online',  className: 'border-emerald-300 bg-emerald-100 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' },
  offline: { label: 'Offline', className: 'border-zinc-300 bg-zinc-100 text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300' },
}

export const DEVICE_STATUS_UNKNOWN: BriefingBadgeConfig = {
  label: 'Neznano',
  className: 'border-zinc-300 bg-zinc-100 text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300',
}

/** Varen badge lookup (BUG-04: klicatelj dobi UNKNOWN fallback, nikoli undefined) */
export function deviceTypeBadge(type: string | null | undefined): BriefingBadgeConfig {
  return (type && DEVICE_TYPE_BADGES[type]) || DEVICE_TYPE_UNKNOWN
}

export function deviceStatusBadge(isOnline: boolean | null | undefined): BriefingBadgeConfig {
  const key = deviceStatusKey(isOnline)
  return key === 'unknown' ? DEVICE_STATUS_UNKNOWN : DEVICE_STATUS_BADGES[key]
}

// --- Čisti pomožniki (cilj enotnega testa) ---

/** Ime naprave — zrcali PATCH Zod (trim, min 1, max 100) */
export const DEVICE_NAME_MAX = 100

export function isValidDeviceName(name: string): boolean {
  const trimmed = name.trim()
  return trimmed.length >= 1 && trimmed.length <= DEVICE_NAME_MAX
}

/**
 * Relativni prikaz lastSeenAt v slovenščini: 'pred 2 min', 'pred 3 h',
 * 'pred 5 dni', za starejše od 30 dni ročen datum 'DD. MM. YYYY'
 * (brez ICU odvisnosti — deterministično med dev/CI/Docker, vzorec
 * briefing formatSlDateShort). null/neveljaven → 'Ni podatka' (honesto);
 * prihodnost (drift uri) → 'zdaj'.
 *
 * Determinizem: `nowMs` je opcijski parameter (testi ga pinajo). V UI je
 * modul dinamično nalagan z ssr:false (module-registry kanon) → izračun
 * poteka izključno na klientu, hydration mismatch ni možen.
 */
export function formatRelativeLastSeen(
  iso: string | null | undefined,
  nowMs: number = Date.now(),
): string {
  if (!iso) return 'Ni podatka'
  const ts = new Date(iso).getTime()
  if (Number.isNaN(ts)) return 'Ni podatka'
  const diffMs = nowMs - ts
  if (diffMs < 0) return 'zdaj'
  const s = Math.floor(diffMs / 1000)
  if (s < 60) return `pred ${s} s`
  const min = Math.floor(s / 60)
  if (min < 60) return `pred ${min} min`
  const h = Math.floor(min / 60)
  if (h < 24) return `pred ${h} h`
  const dni = Math.floor(h / 24)
  if (dni < 30) {
    if (dni === 1) return 'pred 1 dnem'
    if (dni === 2) return 'pred 2 dnevoma'
    return `pred ${dni} dni`
  }
  // Starejše od 30 dni → ročen sl datum iz ISO dela (brez ICU)
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso.trim())
  if (!m) return 'Ni podatka'
  const y = Number(m[1])
  const mo = Number(m[2])
  const d = Number(m[3])
  return `${d}. ${mo}. ${y}`
}

/** Oznaka skupine za naprave brez dodeljene lokacije */
export const NO_LOCATION_GROUP_KEY = '__none__'
export const NO_LOCATION_LABEL = 'Brez lokacije'

/**
 * Grupiranje po lokaciji (super-admin pogled; lokacijski admin dobi z eno
 * lokacijo naturalno eno skupino). Vrstni red: prva pojavitev lokacije v
 * vhodnem vrstnem redu (server: lastSeenAt desc); skupina 'Brez lokacije'
 * je deterministično ZADNJA. Znotraj skupine vhodni vrstni red.
 */
export function groupDevicesByLocation(devices: DeviceRow[]): DeviceLocationGroup[] {
  const groups: DeviceLocationGroup[] = []
  const byKey = new Map<string, DeviceLocationGroup>()
  for (const device of devices) {
    const key = device.locationId ?? NO_LOCATION_GROUP_KEY
    let group = byKey.get(key)
    if (!group) {
      group = {
        key,
        label: device.location?.name ?? NO_LOCATION_LABEL,
        devices: [],
      }
      byKey.set(key, group)
      groups.push(group)
    }
    group.devices.push(device)
  }
  // 'Brez lokacije' deterministično na konec
  const noneIdx = groups.findIndex((g) => g.key === NO_LOCATION_GROUP_KEY)
  if (noneIdx >= 0) {
    const [none] = groups.splice(noneIdx, 1)
    groups.push(none)
  }
  return groups
}

/** KPI števci (defenzivno: manjkajoče vrstice → 0, nikoli ne crasha) */
export interface DeviceKpis {
  total: number
  online: number
  offline: number
  unassigned: number
}

export function summarizeDevices(devices: DeviceRow[] | null | undefined): DeviceKpis {
  const list = Array.isArray(devices) ? devices : []
  let online = 0
  let offline = 0
  let unassigned = 0
  for (const d of list) {
    if (d.isOnline === true) online += 1
    else offline += 1
    if (d.locationId == null) unassigned += 1
  }
  return { total: list.length, online, offline, unassigned }
}
