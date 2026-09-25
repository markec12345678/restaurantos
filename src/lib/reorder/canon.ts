// ============================================
// R129 / EPIC #115 P1-07 — REORDER KANON (enoten vir resnice)
// ============================================
// Explainable reorder izračun: ENA formula, ENA vrsta razlogov (factors),
// vsak faktor označen z VIROM podatka. Kanon P1-07:
//
//   "available + poraba + safety − odprta naročila — razložljivo,
//    brez izmišljanja" (audit R129-a: 3 ločene plastlje → en kanon)
//
// Formula (zadostni podatki — txCount > 0):
//   suggestedQty = ceil(max(0, rP + safety + ADU × lead − available − openPo))
// Formula (nezadostni podatki):
//   suggestedQty = max(0, ceil(2 × minQuantity − available − openPo))
//   — NO usage-derived numbers v faktorjih (ne izmišljujemo napovedi)
//
// PURE jedro: computeReorderSuggestion NE dela prisma klicev (unit-testable);
// db berejo SAMO collect* funkcije (batched, brez N+1).
//
// Pomen polj (audit R129-a, prisma/schema.prisma 938-988):
//   quantity  = fizična zaloga. RESERVED stock koncept V SHEMI NE OBSTAJA
//               (ni reservedQuantity stolpca) → available = quantity.
//               Kanon: pokaži kjer podatki obstajajo, ne ugibaj.
// ============================================

import type { Prisma } from '@prisma/client'
import { toNum } from '@/lib/decimal'
import { isValidPack, packsToBaseQty } from '@/lib/procurement/pack-size'

// ---------- Kanonske konstante ----------

/** Odprta naročilnica = statusi živega PO state machine-a ([id]/_helpers.ts 66-73).
 *  R129 FIX: prej stale ['draft','sent','confirmed'] (predictive-ordering) —
 *  'sent'/'confirmed' ne obstajata v state machine-u → odprta naročila niso bila
 *  videta (dvojni nalogi). 'received'/'cancelled' so zaprta. */
export const OPEN_PO_STATUSES = ['draft', 'submitted', 'approved', 'partial'] as const

/** Realna poraba = prodaja + odpis sestavin pri pripravah (batch-consumption
 *  piše NEGATIVNO quantity — batch-preparation-mutations.ts 445). R129 FIX:
 *  prej so ADU izračuni šteli SAMO type='sale' in zamudili realno porabo.
 *  NE štejemo: procurement/return/write-off/adjustment/restock/batch-production. */
export const CONSUMPTION_TX_TYPES = ['sale', 'batch-consumption'] as const

/** Varnostna zaloga v dnevih porabe (vzeto iz predictive-ordering L65 — EN vir). */
export const SAFETY_STOCK_DAYS = 2

/** Privzeti dobavni čas (dni), ko ni podatka nikjer (item → pravilo → prevzemi). */
export const DEFAULT_LEAD_TIME_DAYS = 2

/** Zgornja meja okna porabe (dni) — pošteno omejen query (audit: bounded fine). */
export const MAX_USAGE_WINDOW_DAYS = 90

export type OpenPoStatus = (typeof OPEN_PO_STATUSES)[number]
export type ConsumptionTxType = (typeof CONSUMPTION_TX_TYPES)[number]

// ---------- Tipi ----------

/** Izmerjena poraba v oknu (batched branje StockTransaction). */
export interface UsageFacts {
  windowDays: number
  recentDays: number
  /** Σ |quantity| po CONSUMPTION_TX_TYPES v oknu (poraba je zapisana negativno;
   *  abs za robustnost — pariteta s predictive-ordering Math.abs). */
  totalConsumed: number
  avgDailyUsage: number
  recentConsumed: number
  recentDailyUsage: number
  /** Št. porabnih transakcij v oknu — osnova za hasEnoughData. */
  txCount: number
  /** txCount > 0 — če false, kanon NE uporablja števil iz porabe. */
  hasEnoughData: boolean
}

/** Dobavna zgodovina iz procurement transakcij (intervali med prevzemi). */
export interface DeliveryFacts {
  /** Povprečni interval med prevzemi (dnevi) — null, če < 2 prevzema. */
  avgDeliveryDays: number | null
  /** Zadnji prevzem (ISO) — vir za kompatibilno polje lastOrderDate. */
  lastProcurementDate: string | null
}

/** Referenca odprte naročilnice za artikel. */
export interface OpenPoRef {
  poNumber: string
  expectedDate?: string | Date | null
}

export interface ReorderItemInput {
  id: string
  name: string
  unit: string
  supplier: string
  quantity: number
  minQuantity: number
  reorderPoint?: number | null
  safetyStock?: number | null
  leadTimeDays?: number | null
  costPerUnit: number
}

export interface ReorderContext {
  /** Σ ne-prejetih količin po odprtih naročilnicah (quantityOrdered − received). */
  openPoQty?: number
  openPoRefs?: OpenPoRef[]
  /** leadTimeDays iz aktivnega ReorderRule (veriga: item → rule → derived → default). */
  ruleLeadTimeDays?: number | null
  /** Izpeljan dobavni čas iz intervalov prevzemov. */
  avgDeliveryDays?: number | null
}

export type ReorderStatus = 'covered-by-po' | 'critical' | 'low' | 'ok'
export type DataStatus = 'sufficient' | 'insufficient'
export type LeadTimeSource = 'item' | 'rule' | 'derived' | 'default'
export type SafetyStockSource = 'item' | 'derived' | 'none'
export type ReorderPointSource = 'item' | 'derived' | 'min-fallback'

/** Strukturiran, razložljiv predlog — kanonski izhod. */
export interface ExplainableSuggestion {
  itemId: string
  name: string
  unit: string
  supplier: string
  /** Fizična zaloga (reserved koncept ne obstaja — glej header komentar). */
  available: number
  reorderPoint: number
  reorderPointSource: ReorderPointSource
  /** null = ni podatka (v formuli prištevano 0). */
  safetyStock: number | null
  safetyStockSource: SafetyStockSource
  leadTimeDays: number
  leadTimeSource: LeadTimeSource
  openPoQty: number
  openPos: Array<{ poNumber: string; expectedDate: string | null }>
  /** Najzgodnejši expectedDate odprtih naročilnic (ISO) ali null. */
  expectedDelivery: string | null
  status: ReorderStatus
  dataStatus: DataStatus
  suggestedQty: number
  /** Human-readable slovensko — ENA vrstica per faktor, vsak z virom. */
  factors: string[]
}

/** Strukturno minimalen db klient — samo modeli, ki jih kanon bere
 *  (PrismaClient in $transaction tx sta oba dodeljiva). */
export type ReorderDbClient = Pick<Prisma.TransactionClient, 'stockTransaction' | 'purchaseOrderItem'>

// ---------- Db bralci (batched — brez N+1) ----------

function zeroUsageFacts(windowDays: number, recentDays: number): UsageFacts {
  return {
    windowDays,
    recentDays,
    totalConsumed: 0,
    avgDailyUsage: 0,
    recentConsumed: 0,
    recentDailyUsage: 0,
    txCount: 0,
    hasEnoughData: false,
  }
}

/**
 * Izmeri porabo za VSE artikle v ENI query (window ≤ 90 dni, bounded) +
 * JS agregacija (okno + recent pod-okno). Artikli brez transakcij dobijo
 * zero-facts (hasEnoughData: false → kanon ne izmišljuje napovedi).
 */
export async function collectUsageFactsBatch(
  db: ReorderDbClient,
  inventoryItemIds: string[],
  opts: { windowDays?: number; recentDays?: number; now?: Date } = {},
): Promise<Map<string, UsageFacts>> {
  const now = opts.now ?? new Date()
  const windowDays = Math.min(Math.max(Math.floor(opts.windowDays ?? 30), 1), MAX_USAGE_WINDOW_DAYS)
  const recentDays = Math.min(Math.max(Math.floor(opts.recentDays ?? 7), 1), windowDays)

  const result = new Map<string, UsageFacts>()
  const ids = [...new Set(inventoryItemIds)].filter(Boolean)
  for (const id of ids) result.set(id, zeroUsageFacts(windowDays, recentDays))
  if (ids.length === 0) return result

  const windowStart = new Date(now.getTime() - windowDays * 86_400_000)
  const recentStart = new Date(now.getTime() - recentDays * 86_400_000)

  const rows = await db.stockTransaction.findMany({
    where: {
      inventoryItemId: { in: ids },
      type: { in: [...CONSUMPTION_TX_TYPES] },
      createdAt: { gte: windowStart },
    },
    select: { inventoryItemId: true, quantity: true, createdAt: true },
  })

  for (const row of rows) {
    const facts = result.get(row.inventoryItemId)
    if (!facts) continue
    const qty = Math.abs(toNum(row.quantity))
    facts.totalConsumed += qty
    facts.txCount += 1
    if (row.createdAt.getTime() >= recentStart.getTime()) {
      facts.recentConsumed += qty
    }
  }

  for (const facts of result.values()) {
    facts.avgDailyUsage = facts.totalConsumed / windowDays
    facts.recentDailyUsage = facts.recentConsumed / recentDays
    facts.hasEnoughData = facts.txCount > 0
  }
  return result
}

/** Poraba za EN artikel (delegat na batched varianto). */
export async function collectUsageFacts(
  db: ReorderDbClient,
  inventoryItemId: string,
  opts: { windowDays?: number; recentDays?: number; now?: Date } = {},
): Promise<UsageFacts> {
  const byItem = await collectUsageFactsBatch(db, [inventoryItemId], opts)
  return byItem.get(inventoryItemId) ?? zeroUsageFacts(
    Math.min(Math.max(Math.floor(opts.windowDays ?? 30), 1), MAX_USAGE_WINDOW_DAYS),
    Math.min(Math.max(Math.floor(opts.recentDays ?? 7), 1), 30),
  )
}

/**
 * Dobavna zgodovina iz procurement transakcij (istega tipa kot je bil v
 * reorder suggestions pomagalniku — intervali < 90 dni, ≥ 2 prevzema).
 */
export async function collectDeliveryFacts(
  db: ReorderDbClient,
  inventoryItemIds: string[],
  opts: { windowDays?: number; now?: Date } = {},
): Promise<Map<string, DeliveryFacts>> {
  const now = opts.now ?? new Date()
  const windowDays = Math.min(Math.max(Math.floor(opts.windowDays ?? 90), 1), MAX_USAGE_WINDOW_DAYS)
  const result = new Map<string, DeliveryFacts>()
  const ids = [...new Set(inventoryItemIds)].filter(Boolean)
  for (const id of ids) result.set(id, { avgDeliveryDays: null, lastProcurementDate: null })
  if (ids.length === 0) return result

  const windowStart = new Date(now.getTime() - windowDays * 86_400_000)

  const [lastProcs, history] = await Promise.all([
    db.stockTransaction.findMany({
      where: { inventoryItemId: { in: ids }, type: 'procurement' },
      orderBy: { createdAt: 'desc' },
      distinct: ['inventoryItemId'],
      select: { inventoryItemId: true, createdAt: true },
    }),
    db.stockTransaction.findMany({
      where: { inventoryItemId: { in: ids }, type: 'procurement', createdAt: { gte: windowStart } },
      orderBy: { createdAt: 'asc' },
      select: { inventoryItemId: true, createdAt: true },
    }),
  ])

  for (const proc of lastProcs) {
    const facts = result.get(proc.inventoryItemId)
    if (facts) facts.lastProcurementDate = proc.createdAt.toISOString()
  }

  const byItem = new Map<string, Date[]>()
  for (const row of history) {
    const list = byItem.get(row.inventoryItemId) ?? []
    list.push(row.createdAt)
    byItem.set(row.inventoryItemId, list)
  }
  for (const [itemId, dates] of byItem) {
    const facts = result.get(itemId)
    if (!facts || dates.length < 2) continue
    let totalDays = 0
    let intervals = 0
    for (let i = 1; i < dates.length; i++) {
      const diff = (dates[i].getTime() - dates[i - 1].getTime()) / 86_400_000
      if (diff > 0 && diff < 90) {
        totalDays += diff
        intervals++
      }
    }
    if (intervals > 0) facts.avgDeliveryDays = Math.round(totalDays / intervals)
  }
  return result
}

/** Odprte naročilnice per artikel: Σ ne-prejetih količin + reference (dedup po poNumber). */
export async function collectOpenPurchaseOrders(
  db: ReorderDbClient,
  inventoryItemIds: string[],
): Promise<Map<string, { qty: number; refs: Array<{ poNumber: string; expectedDate: string | null }> }>> {
  const result = new Map<string, { qty: number; refs: Array<{ poNumber: string; expectedDate: string | null }> }>()
  const ids = [...new Set(inventoryItemIds)].filter(Boolean)
  if (ids.length === 0) return result

  const rows = await db.purchaseOrderItem.findMany({
    where: {
      inventoryItemId: { in: ids },
      purchaseOrder: { status: { in: [...OPEN_PO_STATUSES] } },
    },
    select: {
      inventoryItemId: true,
      quantityOrdered: true,
      quantityReceived: true,
      // R131 (epic #115 P1-13): pack snapshot — odprta naročilnica v PAKETIH se
      // pretvori v OSNOVNE enote (kanon: zaloga/poraba/odprto so VSE v osnovnih
      // enotah, sicer suggestedQty pod-naroči — dvojna naročila). Legacy vrstice
      // (packQty NULL) ostanejo nespremenjene.
      packQty: true,
      purchaseOrder: { select: { poNumber: true, expectedDate: true } },
    },
  })

  for (const row of rows) {
    if (!row.inventoryItemId) continue
    const entry = result.get(row.inventoryItemId) ?? { qty: 0, refs: [] }
    // Ne-prejeto = quantityOrdered − quantityReceived (delni prejem ne šteje kot odprto)
    // R131: ko je vrstica v PAKETIH (veljaven packQty snapshot), se odprta
    // količina pretvori v osnovne enote: (qo − qr) × packQty.
    const openRaw = Math.max(0, toNum(row.quantityOrdered) - toNum(row.quantityReceived))
    const packQtyNum = toNum((row as { packQty?: Prisma.Decimal | number | string | null }).packQty)
    entry.qty += isValidPack(packQtyNum) ? packsToBaseQty(openRaw, packQtyNum) : openRaw
    const poNumber = row.purchaseOrder.poNumber
    if (!entry.refs.some(r => r.poNumber === poNumber)) {
      entry.refs.push({ poNumber, expectedDate: row.purchaseOrder.expectedDate?.toISOString() ?? null })
    }
    result.set(row.inventoryItemId, entry)
  }

  for (const entry of result.values()) {
    entry.refs.sort((a, b) => {
      if (!a.expectedDate) return 1
      if (!b.expectedDate) return -1
      return a.expectedDate.localeCompare(b.expectedDate)
    })
  }
  return result
}

/** Mapa itemId → leadTimeDays iz pravil; preferira aktivna pravila. */
export function resolveRuleLeadTimeMap(
  rules: Array<{ inventoryItemId: string; leadTimeDays: number; isActive: boolean }>,
): Map<string, number> {
  const map = new Map<string, number>()
  // 1. prehod: aktivna pravila; 2. prehod: zalije vrzeli z neaktivnimi.
  for (const rule of rules) {
    if (rule.isActive) map.set(rule.inventoryItemId, rule.leadTimeDays)
  }
  for (const rule of rules) {
    if (!map.has(rule.inventoryItemId)) map.set(rule.inventoryItemId, rule.leadTimeDays)
  }
  return map
}

// ---------- PURE jedro ----------

function toIso(value: string | Date | null | undefined): string | null {
  if (value == null) return null
  return value instanceof Date ? value.toISOString() : value
}

/** Slovenska formatacija števil (decimalna vejica), brez sledečih ničel. */
function fmtSlo(n: number, maxDecimals = 3): string {
  return Number(n.toFixed(maxDecimals)).toString().replace('.', ',')
}

function fmtDateSlo(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.`
}

const LEAD_TIME_SOURCE_LABEL: Record<LeadTimeSource, string> = {
  item: 'iz artikla',
  rule: 'iz pravila',
  derived: 'izpeljano iz prevzemov',
  default: 'privzeto',
}

/**
 * Kanonski izračun — PURE (brez db). Vsi vhodni parametri so že izmerjeni;
 * vsak izhodni faktor nosi svoj VIR (razložljivost P1-07).
 */
export function computeReorderSuggestion(
  item: ReorderItemInput,
  facts: UsageFacts,
  ctx: ReorderContext = {},
): ExplainableSuggestion {
  const minQuantity = Math.max(0, item.minQuantity)
  // Reserved stock koncept NE obstaja v shemi → available = quantity (glej header).
  const available = item.quantity
  const openPoQty = Math.max(0, ctx.openPoQty ?? 0)
  const openPos = (ctx.openPoRefs ?? []).map(r => ({
    poNumber: r.poNumber,
    expectedDate: toIso(r.expectedDate),
  }))

  // 1. Dobavni čas — veriga virov: item → pravilo → izpeljava iz prevzemov → privzeto.
  const leadCandidates: Array<[number | null | undefined, LeadTimeSource]> = [
    [item.leadTimeDays, 'item'],
    [ctx.ruleLeadTimeDays, 'rule'],
    [ctx.avgDeliveryDays, 'derived'],
  ]
  let leadTimeDays = DEFAULT_LEAD_TIME_DAYS
  let leadTimeSource: LeadTimeSource = 'default'
  for (const [value, source] of leadCandidates) {
    if (value != null) {
      leadTimeDays = Math.max(0, value)
      leadTimeSource = source
      break
    }
  }

  // 2. Varnostna zaloga: eksplicitna → izpeljana (SAFETY_STOCK_DAYS dni porabe) → ni podatka.
  let safetyStock: number | null
  let safetyStockSource: SafetyStockSource
  if (item.safetyStock != null) {
    safetyStock = Math.max(0, item.safetyStock)
    safetyStockSource = 'item'
  } else if (facts.hasEnoughData) {
    safetyStock = Math.ceil(facts.avgDailyUsage * SAFETY_STOCK_DAYS)
    safetyStockSource = 'derived'
  } else {
    safetyStock = null
    safetyStockSource = 'none'
  }
  const safetyEffective = safetyStock ?? 0

  // 3. Točka naročila: eksplicitna → izpeljana (max(min, poraba med dobavo)) → min zaloga.
  let reorderPoint: number
  let reorderPointSource: ReorderPointSource
  if (item.reorderPoint != null) {
    reorderPoint = item.reorderPoint
    reorderPointSource = 'item'
  } else if (facts.hasEnoughData) {
    reorderPoint = Math.max(minQuantity, Math.ceil(facts.avgDailyUsage * leadTimeDays))
    reorderPointSource = 'derived'
  } else {
    reorderPoint = minQuantity
    reorderPointSource = 'min-fallback'
  }

  // 4. Status — vrstni red po kanonu: pokrito → kritično → nizko → ok.
  const covered = openPoQty > 0 && available + openPoQty >= reorderPoint
  const status: ReorderStatus = covered
    ? 'covered-by-po'
    : available <= 0
      ? 'critical'
      : available <= reorderPoint
        ? 'low'
        : 'ok'

  const dataStatus: DataStatus = facts.hasEnoughData ? 'sufficient' : 'insufficient'

  // 5. Predlog — zadostni podatki: kanonska formula; nezadostni: 2× min brez
  //    usage števil (kanon: ne izmišljuj napovedi).
  const suggestedQty = facts.hasEnoughData
    ? Math.ceil(Math.max(0, reorderPoint + safetyEffective + facts.avgDailyUsage * leadTimeDays - available - openPoQty))
    : Math.max(0, Math.ceil(2 * minQuantity - available - openPoQty))

  // 6. Faktorji — ENA vrstica per faktor, vsak z virom.
  const factors: string[] = []
  factors.push(`Zaloga: ${fmtSlo(available)} ${item.unit}`)
  if (facts.hasEnoughData) {
    factors.push(`Povprečna poraba (${facts.windowDays} dni): ${fmtSlo(facts.avgDailyUsage, 1)} ${item.unit}/dan — prodaja + poraba priprav`)
    factors.push(`Poraba (zadnjih ${facts.recentDays} dni): ${fmtSlo(facts.recentDailyUsage, 1)} ${item.unit}/dan`)
  }
  factors.push(`Dobavni čas: ${leadTimeDays} dni (${LEAD_TIME_SOURCE_LABEL[leadTimeSource]})`)
  if (safetyStockSource === 'item') {
    factors.push(`Varnostna zaloga: ${fmtSlo(safetyStock ?? 0)} ${item.unit} (eksplicitna)`)
  } else if (safetyStockSource === 'derived') {
    factors.push(`Varnostna zaloga: ${fmtSlo(safetyStock ?? 0)} ${item.unit} (izpeljano: ${SAFETY_STOCK_DAYS} dni porabe)`)
  } else {
    factors.push('Varnostna zaloga: ni podatka (prištevano 0)')
  }
  if (reorderPointSource === 'item') {
    factors.push(`Točka naročila: ${fmtSlo(reorderPoint)} ${item.unit} (eksplicitna)`)
  } else if (reorderPointSource === 'derived') {
    factors.push(`Točka naročila: ${fmtSlo(reorderPoint)} ${item.unit} (izpeljana: max(min zaloga, poraba med dobavo))`)
  } else {
    factors.push(`Točka naročila: ${fmtSlo(reorderPoint)} ${item.unit} (min zaloga — brez podatkov o porabi)`)
  }
  if (openPoQty > 0) {
    const refLabels = openPos.map(r => r.expectedDate ? `${r.poNumber}, pričakovano ${fmtDateSlo(r.expectedDate)}` : r.poNumber)
    factors.push(`Odprta naročilnica: ${fmtSlo(openPoQty)} ${item.unit} (${refLabels.join('; ')})`)
  }
  if (!facts.hasEnoughData) {
    factors.push('Podatki o porabi: nezadostni — predlog iz minimuma (brez izmišljanja napovedi)')
  }
  if (facts.hasEnoughData) {
    factors.push(`Predlog: naroči ${fmtSlo(suggestedQty)} ${item.unit} (rP ${fmtSlo(reorderPoint)} + varnost ${fmtSlo(safetyEffective)} + poraba med dobavo ${fmtSlo(facts.avgDailyUsage * leadTimeDays, 1)} − zaloga ${fmtSlo(available)} − odprto ${fmtSlo(openPoQty)})`)
  } else {
    factors.push(`Predlog: naroči ${fmtSlo(suggestedQty)} ${item.unit} (2× min zaloga ${fmtSlo(2 * minQuantity)} − zaloga ${fmtSlo(available)} − odprto ${fmtSlo(openPoQty)})`)
  }
  if (status === 'covered-by-po') {
    factors.push('Status: pokrito z odprto naročilnico — dodatno naročilo ni potrebno')
  }

  const dated = openPos.map(r => r.expectedDate).filter((d): d is string => !!d).sort()
  return {
    itemId: item.id,
    name: item.name,
    unit: item.unit,
    supplier: item.supplier,
    available,
    reorderPoint,
    reorderPointSource,
    safetyStock,
    safetyStockSource,
    leadTimeDays,
    leadTimeSource,
    openPoQty,
    openPos,
    expectedDelivery: dated[0] ?? null,
    status,
    dataStatus,
    suggestedQty,
    factors,
  }
}
