// ============================================
// R129 (epic #115 P1-07) — CENTER NAROČIL: čisti helperji
// --------------------------------------------
// Defenzivna normalizacija odgovora GET /api/inventory/reorder:
// kodiramo proti NOVemu kontraktu (R129-server: itemId, status, factors,
// reorderPoint, openPos, ...) z odstotnimi fallbacki na STARo obliko
// (inventoryItemId, itemName, currentStock, costPerUnit, urgency, reason),
// da UI dela tudi med prehodom (premik strežniške polovice vzporedno).
// Vse funkcije so ČISTE (brez I/O in Reacta) — enotsko testirane v
// tests/unit/reorder-center/r129-reorder-center.test.ts
// ============================================

export type ReorderStatus = 'critical' | 'low' | 'ok' | 'covered-by-po'
export type DataStatus = 'sufficient' | 'insufficient'

/** Surov predlog iz API-ja — unija stare in nove oblike (vse polja opcijska, obramba proti prehodu) */
export interface RawReorderSuggestion {
  // --- NOVA oblika (R129-server kontrakt) ---
  itemId?: string
  name?: string
  quantity?: number
  minQuantity?: number
  avgDailyUsage?: number
  recentUsage?: number
  trend?: string
  isLowStock?: boolean
  daysUntilEmpty?: number | null
  status?: string
  dataStatus?: string
  factors?: string[]
  reorderPoint?: number | null
  reorderPointSource?: string
  safetyStock?: number | null
  safetyStockSource?: string
  leadTimeDays?: number | null
  leadTimeSource?: string
  openPoQty?: number
  openPos?: Array<{ poNumber?: string; expectedDate?: string | null }>
  expectedDelivery?: string | null
  unitPrice?: number
  // --- R130 (epic #115 P1-08): vir enotne cene (kontrakt reorder enrichment) ---
  unitPriceSource?: 'supplier-history' | 'item-cost'
  unitPriceAsOf?: string | null
  // --- R131 (epic #115 P1-13): pack-size enrichment (samo z aktivno katalog linijo;
  //     brez linije polja NE obstajajo — back-compat čisto aditivno) ---
  packQty?: number | string | null
  packUnit?: string | null
  baseUnit?: string | null
  packsNeeded?: number | string | null
  pricePerPack?: number | string | null
  packSource?: string
  // --- STARA oblika (obstoječi GET, razastranjen med prehodom) ---
  inventoryItemId?: string
  itemName?: string
  currentStock?: number
  costPerUnit?: number
  urgency?: string
  reason?: string
  lastOrderDate?: string | null
  avgDeliveryDays?: number
  category?: string
  // deljena polja
  unit?: string
  supplier?: string
  suggestedQty?: number
  [key: string]: unknown
}

/** Normaliziran predlog — oblika, ki jo Center naročil uporablja v UI */
export interface ReorderCenterSuggestion {
  itemId: string
  name: string
  unit: string
  supplier: string | null
  quantity: number
  minQuantity: number | null
  reorderPoint: number | null
  safetyStock: number | null
  suggestedQty: number
  unitPrice: number
  avgDailyUsage: number | null
  daysUntilEmpty: number | null
  urgency: 'critical' | 'high' | 'medium' | 'low'
  status: ReorderStatus
  dataStatus: DataStatus
  /** Razlagalni faktorji; fallback na [reason] pri starem odgovoru */
  factors: string[]
  reason: string | null
  openPoQty: number
  openPos: Array<{ poNumber: string; expectedDate: string | null }>
  expectedDelivery: string | null
  leadTimeDays: number | null
  /** R130: vir enotne cene — zgodovina dobavitelja OVERIDE-a costPerUnit; 'item-cost' = back-compat */
  unitPriceSource: 'supplier-history' | 'item-cost'
  /** ISO čas zadnjega opažanja cene (samo pri 'supplier-history'; sicer null) */
  unitPriceAsOf: string | null
  /** R131: pack kontekst iz kataloga dobavitelja — null, ko katalog linija ne obstaja */
  packQty: number | null
  packUnit: string | null
  baseUnit: string | null
  /** advisory št. paketov (ceil) — suggestedQty ostane kanonska številka */
  packsNeeded: number | null
  pricePerPack: number | null
  /** samo 'catalog' je veljaven vir pack konteksta (neznana vrednost → null), pariteta unitPriceSource */
  packSource: 'catalog' | null
}

/** Varno številsko koerciranje (null/NaN/undefined → 0 oz. default) */
function toNum(value: unknown, fallback = 0): number {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

function toNullableNum(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

const VALID_STATUSES: ReorderStatus[] = ['critical', 'low', 'ok', 'covered-by-po']

/**
 * Status fallback (defenzivno):
 * 1. nov `status` (če veljaven),
 * 2. `isLowStock === true` → 'low',
 * 3. stara `urgency` (critical → critical, high → low),
 * 4. sicer 'ok'.
 */
function normalizeStatus(raw: RawReorderSuggestion): ReorderStatus {
  const status = raw.status
  if (status && VALID_STATUSES.includes(status as ReorderStatus)) return status as ReorderStatus
  if (raw.isLowStock === true) return 'low'
  if (raw.urgency === 'critical') return 'critical'
  if (raw.urgency === 'high') return 'low'
  return 'ok'
}

/** Normalizacija surovega predloga v UI obliko (stare + nove polje, varne defaulte) */
export function normalizeSuggestion(raw: RawReorderSuggestion): ReorderCenterSuggestion {
  // faktorji: novi `factors` (že berljivi stavki), sicer star `reason` kot en sam faktor
  const factors = Array.isArray(raw.factors)
    ? raw.factors.filter((f): f is string => typeof f === 'string' && f.trim().length > 0)
    : (raw.reason ? [raw.reason] : [])
  const openPos = Array.isArray(raw.openPos)
    ? raw.openPos
        .filter(p => p && typeof p.poNumber === 'string' && p.poNumber.length > 0)
        .map(p => ({ poNumber: String(p.poNumber), expectedDate: p.expectedDate ?? null }))
    : []
  return {
    itemId: raw.itemId ?? raw.inventoryItemId ?? '',
    name: raw.name ?? raw.itemName ?? 'Neznan artikel',
    unit: raw.unit ?? 'kos',
    supplier: raw.supplier ?? null,
    quantity: toNum(raw.quantity ?? raw.currentStock),
    minQuantity: toNullableNum(raw.minQuantity),
    reorderPoint: toNullableNum(raw.reorderPoint),
    safetyStock: toNullableNum(raw.safetyStock),
    suggestedQty: toNum(raw.suggestedQty),
    unitPrice: toNum(raw.unitPrice ?? raw.costPerUnit),
    avgDailyUsage: toNullableNum(raw.avgDailyUsage),
    daysUntilEmpty: toNullableNum(raw.daysUntilEmpty),
    urgency: (raw.urgency === 'critical' || raw.urgency === 'high' || raw.urgency === 'medium' || raw.urgency === 'low')
      ? raw.urgency
      : 'low',
    status: normalizeStatus(raw),
    dataStatus: raw.dataStatus === 'insufficient' ? 'insufficient' : 'sufficient',
    factors,
    reason: raw.reason ?? null,
    openPoQty: toNum(raw.openPoQty),
    openPos,
    expectedDelivery: raw.expectedDelivery ?? null,
    leadTimeDays: toNullableNum(raw.leadTimeDays),
    // R130: vir cene — koda defenzivno (neznana vrednost → 'item-cost' = staro vedenje)
    unitPriceSource: raw.unitPriceSource === 'supplier-history' ? 'supplier-history' : 'item-cost',
    unitPriceAsOf: typeof raw.unitPriceAsOf === 'string' && raw.unitPriceAsOf.length > 0 ? raw.unitPriceAsOf : null,
    // R131: pack kontekst — defenzivno (številke samo kadar končne; packUnit/baseUnit
    // samo kadar neprazni nizi; packSource samo dobesedno 'catalog')
    packQty: toNullableNum(raw.packQty),
    packUnit: typeof raw.packUnit === 'string' && raw.packUnit.trim().length > 0 ? raw.packUnit.trim() : null,
    baseUnit: typeof raw.baseUnit === 'string' && raw.baseUnit.trim().length > 0 ? raw.baseUnit.trim() : null,
    packsNeeded: toNullableNum(raw.packsNeeded),
    pricePerPack: toNullableNum(raw.pricePerPack),
    packSource: raw.packSource === 'catalog' ? 'catalog' : null,
  }
}

/** Ali je predlog AKCIJSKI (izberljiv za osnutek naročilnice)? */
export function isActionable(s: ReorderCenterSuggestion): boolean {
  return (s.status === 'low' || s.status === 'critical') && s.suggestedQty > 0
}

/** Filtriraj akcijske: status low|critical + suggestedQty > 0 + NI pokrit z naročilnico */
export function filterActionable(list: ReorderCenterSuggestion[]): ReorderCenterSuggestion[] {
  return list.filter(s => isActionable(s) && s.status !== 'covered-by-po')
}

/** Zaokroži na 2 decimalki (denar) */
export function round2(value: number): number {
  const n = Number(value)
  if (!Number.isFinite(n)) return 0
  return Math.round(n * 100) / 100
}

/** Ocenjena vrednost izbire: Σ (suggestedQty × unitPrice), zaokroženo na 2 decimalki */
export function groupEstimatedValue(
  items: Array<Pick<ReorderCenterSuggestion, 'suggestedQty' | 'unitPrice'>>,
): number {
  const total = items.reduce((sum, s) => sum + toNum(s.suggestedQty) * toNum(s.unitPrice), 0)
  return round2(total)
}

export interface StatusSummary {
  total: number
  critical: number
  low: number
  ok: number
  coveredByPo: number
  /** dataStatus 'insufficient' — brez zadosti podatkov o porabi */
  withoutData: number
}

/** Števeci po statusu (vključno z 'brez podatkov' = dataStatus insufficient) */
export function summarizeStatuses(
  list: Array<Pick<ReorderCenterSuggestion, 'status' | 'dataStatus'>>,
): StatusSummary {
  const summary: StatusSummary = { total: list.length, critical: 0, low: 0, ok: 0, coveredByPo: 0, withoutData: 0 }
  for (const s of list) {
    if (s.status === 'critical') summary.critical += 1
    else if (s.status === 'low') summary.low += 1
    else if (s.status === 'ok') summary.ok += 1
    else if (s.status === 'covered-by-po') summary.coveredByPo += 1
    if (s.dataStatus === 'insufficient') summary.withoutData += 1
  }
  return summary
}

const STATUS_RANK: Record<ReorderStatus, number> = {
  critical: 0,
  low: 1,
  ok: 2,
  'covered-by-po': 3,
}

function daysRank(s: ReorderCenterSuggestion): number {
  const d = s.daysUntilEmpty
  // 999 = konvencija API-ja "zaloga praktično ne zmanjka"
  return d === null || d >= 999 || !Number.isFinite(d) ? Number.POSITIVE_INFINITY : d
}

/** Sortiraj po nujnosti: kritični prvi, nato po daysUntilEmpty naraščajoče, nato po imenu */
export function sortByUrgency(list: ReorderCenterSuggestion[]): ReorderCenterSuggestion[] {
  return [...list].sort((a, b) =>
    STATUS_RANK[a.status] - STATUS_RANK[b.status] ||
    daysRank(a) - daysRank(b) ||
    a.name.localeCompare(b.name, 'sl'),
  )
}

/** Oznaka za preskočene artikle iz odgovora POST /api/reorder/draft-po → "Preskočeni: X (razlog); Y (razlog)" */
export function formatSuggestionNote(
  skipped: Array<{ itemId?: string | null; name?: string | null; reason?: string | null }>,
): string {
  if (!Array.isArray(skipped) || skipped.length === 0) return ''
  const parts = skipped.map(s => {
    const label = s?.name || s?.itemId || '?'
    return s?.reason ? `${label} (${s.reason})` : label
  })
  return `Preskočeni artikli: ${parts.join('; ')}`
}

/** Kompaktni izpis količine (celo število brez decimalk, sicer max 2 decimalki) */
export function fmtQty(value: unknown): string {
  const n = toNum(value)
  return Number.isInteger(n) ? String(n) : String(round2(n))
}

/** Varni datum v sl-SI obliki → null, če ni razumljiv */
export function formatDateSafe(value: string | null | undefined): string | null {
  if (!value) return null
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return null
  try {
    return d.toLocaleDateString('sl-SI', { day: 'numeric', month: 'short', year: 'numeric' })
  } catch {
    return d.toISOString().slice(0, 10)
  }
}

// ============================================
// R131 (epic #115 P1-13) — PACK-SIZE kontekst
// ============================================

export interface PackHintParts {
  /** advisory št. paketov (celo število, min 1 — kanon: naroči cele pakete) */
  packs: number
  packQty: number
  packUnit: string
  baseUnit: string
  /** packs × packQty (3 decimalki, kanon zaloga Decimal(12,3)) */
  baseQty: number
}

/**
 * Pack kontekst iz kataloga dobavitelja za reorder kartico —
 * razčlenjen v dele za i18n template. Vrne null, ko pack kontekst ni
 * veljaven (packSource ni 'catalog', packQty ≤ 0 / nekonečno ali
 * packsNeeded manjka) — parity z unitPriceSource obravnavo (R130-b).
 */
export function packHintParts(
  s: Pick<ReorderCenterSuggestion, 'packSource' | 'packQty' | 'packUnit' | 'baseUnit' | 'unit' | 'packsNeeded'>,
): PackHintParts | null {
  if (s.packSource !== 'catalog') return null
  const packQty = toNullableNum(s.packQty)
  const packsNeeded = toNullableNum(s.packsNeeded)
  if (packQty === null || packQty <= 0 || packsNeeded === null) return null
  const packs = Math.max(1, Math.ceil(packsNeeded))
  return {
    packs,
    packQty,
    packUnit: s.packUnit ?? 'paket',
    baseUnit: s.baseUnit ?? s.unit ?? '',
    baseQty: Math.round(packs * packQty * 1000) / 1000,
  }
}

/** Surova vrstica iz draft-po odgovora orders[].items (ADDITIVNO — lahko manjka) */
export interface RawDraftPoPackItem {
  name?: string | null
  packs?: number | string | null
  packUnit?: string | null
  packQty?: number | string | null
  baseQty?: number | string | null
  pricePerPack?: number | string | null
  totalPrice?: number | string | null
}

/**
 * Pack povzetek ene vrstice osnutka naročilnice:
 * zapakirana → "Moka: 2 × vrečka po 25 kg = 50 kg";
 * legacy vrstica (packQty neveljaven) → "Pivo: 24" (osnovne enote).
 * Defenzivno: neveljavni/manjkajoči podatki → '—' (nikoli crash).
 */
export function formatDraftPoPackItem(item: RawDraftPoPackItem): string {
  const safe = (item ?? {}) as RawDraftPoPackItem
  const name = typeof safe.name === 'string' && safe.name.trim().length > 0 ? safe.name.trim() : '?'
  const packQty = toNullableNum(safe.packQty)
  const packs = toNullableNum(safe.packs)
  const baseQty = toNullableNum(safe.baseQty)
  if (packQty !== null && packQty > 0 && packs !== null) {
    const packUnit = typeof safe.packUnit === 'string' && safe.packUnit.trim().length > 0 ? safe.packUnit.trim() : 'paket'
    const total = baseQty !== null ? baseQty : Math.round(packs * packQty * 1000) / 1000
    return `${name}: ${fmtQty(packs)} × ${packUnit} po ${fmtQty(packQty)} = ${fmtQty(total)}`
  }
  return `${name}: ${baseQty !== null ? fmtQty(baseQty) : '—'}`
}

/**
 * Pack povzetek vseh vrstic enega osnutka naročilnice (orders[].items) →
 * en niz ali null, če items ne obstajajo / niso array / so prazni
 * (back-compat: stari draft-po odgovor NE dobi nobenega dodatnega izpisa).
 */
export function formatDraftPoPackSummary(items: unknown): string | null {
  if (!Array.isArray(items) || items.length === 0) return null
  return items.map(i => formatDraftPoPackItem(i as RawDraftPoPackItem)).join('; ')
}
