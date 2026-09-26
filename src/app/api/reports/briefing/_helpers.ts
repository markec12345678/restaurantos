// ============================================
// P2-28 (epic #115, R141-b) — MANAGER DAILY BRIEFING — sekcija fetcherji
// ============================================
// En strežniški agregat GET /api/reports/briefing namesto 8–12 klijentskih
// klicev (kontrakt R141-a audit). Vsak fetcher je SAMOODGOVEN za eno sekcijo;
// route.ts vsako klic ovije v svoj .catch → nevtralni fallback (dashboard
// kanon) — ena padla sekcija NIKOLI ne 500-a celotnega briefinja.
//
// ČASOVNI KANON (P2-08 / R126 lekcija — obvezni LJ poslovni dan):
//   • Order.paidAt / WasteRecord.createdAt / InventoryBatch.expiryDate /
//     Reservation.dateTime so VREMENSKI žigi → LJ meje (ljubljanaDayBounds).
//     Obstoječi /reports/sales in /reports/eod rabita UTC meje — briefing ju
//     NAMERNO ne posnema (R126: UTC meje prestavijo nočna plačila v napačen
//     poslovni dan; digest-trend/daily-close kanon je LJ day-start).
//   • StaffShift.shiftDate je "samo-datum" stolpec, ki se PIŠE kot
//     new Date('YYYY-MM-DD') (UTC polnoč — staff-shifts route:140), zato je
//     okno po shiftDate UTC-polnočno (write-path pariteta; buildShiftsWhere
//     uporablja server-local setHours — na UTC strežniku identično, na LJ
//     strežniku pa bi setHours meje zgrešil vrstice zapisane ob polnoči UTC).
//   • ZReport.reportDate in DailyClose.businessDate sta day-start žig
//     ljubljanskega poslovnega dne (z-report/_helpers/upsert-z-report.ts:86 in
//     daily-close/route.ts:255: reportDate = ljubljanaDayBounds(date).start).
//
// SCOPE kanon: null locationId (super-admin global) = PRAZEN filter —
// NIKOLI { locationId: null } (tenant-scope.ts kanon). Sekciji, ki BREZ
// lokacije ne moreta vrniti smiselnega odgovora (ZReport/DailyClose sta
// per-(date, locationId) unikata), vrneta null — UI izriše "—", ne
// izmišljenega "none".
//
// READ-ONLY: brez createAuditLog (vsi report GET-i — R141-a audit).
// PII: odgovor NIKOLI ne vsebuje telefona/e-pošte — VIP se izpelje kot samo
// boolean prek soft-joina Guest.isVip (Reservation nima guestId).

import { db } from '@/lib/db'
import { toNum, round2 } from '@/lib/decimal'
import { pctChange } from '@/lib/percent-change'
import { ljubljanaDayBounds, ljubljanaTodayStr } from '@/lib/timezone-sl'
import { OPEN_PO_STATUSES } from '@/lib/reorder/canon'
import { computePrepStats, resolveBaseAt } from '@/lib/kds/metrics'

// Kanon "uskoro preteče" — pariteta /api/inventory/batches EXPIRING_SOON_DAYS
// (lokalni const, ker batches ruta je ne izvaža; vrednost 7 dni).
export const EXPIRING_SOON_DAYS = 7

// Capi po kontraktu P2-28.
const UPCOMING_RESERVATIONS_CAP = 20
const SHIFTS_LIST_CAP = 20
const LOW_STOCK_CAP = 10
const EXPIRING_CAP = 10
const OPEN_PO_CAP = 10
const TOP_ITEMS_CAP = 5
const TOP_REASONS_CAP = 3
// Bounded poizvedbe (dashboard/kitchen-metrics cap kanon).
const LOW_STOCK_SCAN_CAP = 500
const BATCH_SCAN_CAP = 500
const OPEN_PO_SCAN_CAP = 200
const TOP_ITEMS_SCAN_CAP = 5000
const KDS_SAMPLE_CAP = 20_000 // pariteta kitchen/metrics THROUGHPUT_SAMPLE_CAP

// Statusi aktivnih artiklov na KDS — 1:1 kitchen/metrics ACTIVE_ITEM_STATUSES.
const KDS_ACTIVE_ITEM_STATUSES = ['pending', 'fired', 'preparing'] as const

// ---------- Datum pomožniki ----------

/** 'YYYY-MM-DD' + n dni → 'YYYY-MM-DD' (čisti koledarski add/sub po vzorcu
 *  ljubljanaYesterdayStr — DST-varno, brez start-24h). */
export function addDaysToYmd(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10)
}

/** UTC-polnočno okno 'YYYY-MM-DD' dneva — za "samo-datum" stolpce, ki se
 *  pišejo z new Date('YYYY-MM-DD') (StaffShift.shiftDate — glej header). */
export function utcDayBounds(dateStr: string): { start: Date; end: Date } {
  return {
    start: new Date(`${dateStr}T00:00:00.000Z`),
    end: new Date(`${addDaysToYmd(dateStr, 1)}T00:00:00.000Z`),
  }
}

/** Koliko LJ koledarskih dni je trenutek `at` od poslovnega dne `fromYmd`
 *  (0 = tisti dan). DST-varno: primerjava LJ day-start koledarskih datumov,
 *  ne surova ms-differ. */
function ljCalendarDaysBetween(fromYmd: string, at: Date): number {
  const atYmd = ljubljanaTodayStr(at)
  const [fy, fm, fd] = fromYmd.split('-').map(Number)
  const [ay, am, ad] = atYmd.split('-').map(Number)
  return Math.round((Date.UTC(ay, am - 1, ad) - Date.UTC(fy, fm - 1, fd)) / 86_400_000)
}

/** Pogojni lokacijski filter — null scope (super-admin) = prazen (global). */
function locWhere(locationId: string | null): { locationId?: string } {
  return locationId ? { locationId } : {}
}

// ---------- Tipi odgovora (pin kontrakta za R141-c UI) ----------

export interface BriefingReservationsSection {
  summary: { confirmed: number; seated: number; cancelled: number; noShow: number; totalGuests: number }
  upcoming: Array<{
    id: string; customerName: string; dateTime: string; partySize: number
    status: string; tableNumber: number | null; notes: string; specialRequests: string; isVip: boolean
  }>
}

export interface BriefingStaffSection {
  shifts: Array<{ employeeName: string; role: string; shiftType: string; startTime: string; endTime: string; status: string }>
  coverage: { scheduled: number; confirmed: number; byRole: Record<string, number> }
  pendingTimeOff: number
}

export interface BriefingInventorySection {
  lowStock: Array<{ id: string; name: string; quantity: number; minQuantity: number; unit: string; status: 'critical' | 'low' }>
  lowStockCount: number
  expiring: Array<{ lotNumber: string; itemName: string; expiryDate: string; daysToExpiry: number; quantityRemaining: number; unit: string }>
  expiredCount: number
}

export interface BriefingPurchasingSection {
  openPos: Array<{ poNumber: string; supplierName: string; status: string; expectedDate: string | null; totalAmount: number }>
  openCount: number
  arrivingToday: Array<{ poNumber: string; supplierName: string }>
}

export interface BriefingYesterdaySection {
  sales: { revenue: number; ordersCount: number; avgTicket: number; tips: number; revenueChangePct: number | null }
  topItems: Array<{ name: string; quantity: number; revenue: number }>
  waste: { totalCost: number; topReasons: Array<{ reason: string; cost: number; count: number }> }
  zReportStatus: 'draft' | 'finalized' | 'approved' | null
  dailyCloseStatus: 'PENDING_APPROVAL' | 'CLOSED' | 'REOPENED' | null
}

export interface BriefingIssuesSection {
  unresolvedFeedback: { new: number; inReview: number; oldest: string | null }
  pendingApprovals: { dailyCloses: number; stocktakes: number }
}

export interface BriefingKdsSection {
  lateCount: number
  onTimeRate: number
  avgFiredToReadyMinutes: number
  activeTickets: number
}

// Nevtralni fallbacki (dashboard kanon) — route jih uporablja v .catch.
export const NEUTRAL_RESERVATIONS: BriefingReservationsSection = {
  summary: { confirmed: 0, seated: 0, cancelled: 0, noShow: 0, totalGuests: 0 },
  upcoming: [],
}
export const NEUTRAL_STAFF: BriefingStaffSection = {
  shifts: [],
  coverage: { scheduled: 0, confirmed: 0, byRole: {} },
  pendingTimeOff: 0,
}
export const NEUTRAL_PURCHASING: BriefingPurchasingSection = {
  openPos: [], openCount: 0, arrivingToday: [],
}
export const NEUTRAL_YESTERDAY: BriefingYesterdaySection = {
  sales: { revenue: 0, ordersCount: 0, avgTicket: 0, tips: 0, revenueChangePct: null },
  topItems: [],
  waste: { totalCost: 0, topReasons: [] },
  zReportStatus: null,
  dailyCloseStatus: null,
}
export const NEUTRAL_ISSUES: BriefingIssuesSection = {
  unresolvedFeedback: { new: 0, inReview: 0, oldest: null },
  pendingApprovals: { dailyCloses: 0, stocktakes: 0 },
}
export const NEUTRAL_KDS: BriefingKdsSection = {
  lateCount: 0, onTimeRate: 0, avgFiredToReadyMinutes: 0, activeTickets: 0,
}

// ============================================================
// 1. REZERVACIJE — izbrani dan (LJ meje)
// ============================================================
export async function fetchReservationsSection(
  locationId: string | null,
  bounds: { start: Date; end: Date },
): Promise<BriefingReservationsSection> {
  const dateTime = { gte: bounds.start, lt: bounds.end }
  const [statusCounts, upcomingRows, guestsSum] = await Promise.all([
    // Summary: VSE statusi (vključno cancelled/no_show) v dnevskem oknu.
    db.reservation.groupBy({
      by: ['status'],
      where: { dateTime, ...locWhere(locationId) },
      _count: true,
    }),
    // Upcoming: samo confirmed+seated, časovno naraščajoče, cap 20.
    db.reservation.findMany({
      where: { dateTime, status: { in: ['confirmed', 'seated'] }, ...locWhere(locationId) },
      include: { table: { select: { number: true } } },
      orderBy: { dateTime: 'asc' },
      take: UPCOMING_RESERVATIONS_CAP,
    }),
    // totalGuests = Σ partySize nad confirmed+seated (kontrakt P2-28).
    db.reservation.aggregate({
      where: { dateTime, status: { in: ['confirmed', 'seated'] }, ...locWhere(locationId) },
      _sum: { partySize: true },
    }),
  ])

  // VIP best-effort soft-join: Reservation NIMA guestId; edina vez je
  // customerPhone → Guest.phone (indeksiran). Match-miss → false. V odgovor
  // gre SAMO boolean — telefon/e-pošta nikoli ne zapustita strežnika.
  const phones = [...new Set(upcomingRows.map((r) => r.customerPhone).filter(Boolean))]
  const vipRows = phones.length > 0
    ? await db.guest.findMany({ where: { phone: { in: phones } }, select: { phone: true, isVip: true } })
    : []
  const vipPhones = new Set(vipRows.filter((g) => g.isVip).map((g) => g.phone))

  const statusMap = Object.fromEntries(statusCounts.map((s) => [s.status, s._count]))
  return {
    summary: {
      confirmed: statusMap['confirmed'] ?? 0,
      seated: statusMap['seated'] ?? 0,
      cancelled: statusMap['cancelled'] ?? 0,
      noShow: statusMap['no_show'] ?? 0,
      totalGuests: guestsSum._sum.partySize ?? 0,
    },
    upcoming: upcomingRows.map((r) => ({
      id: r.id,
      customerName: r.customerName,
      dateTime: r.dateTime.toISOString(),
      partySize: r.partySize,
      status: r.status,
      tableNumber: r.table?.number ?? null,
      notes: r.notes,
      specialRequests: r.specialRequests,
      isVip: vipPhones.has(r.customerPhone),
    })),
  }
}

// ============================================================
// 2. STAFF — izmene za izbrani datum + čakajoči dopusti
// ============================================================
export async function fetchStaffSection(
  locationId: string | null,
  dateStr: string,
): Promise<BriefingStaffSection> {
  // shiftDate okno = UTC-polnočno (write-path pariteta — glej header).
  const shiftDate = { gte: utcDayBounds(dateStr).start, lt: utcDayBounds(dateStr).end }
  const [rows, pendingTimeOff] = await Promise.all([
    db.staffShift.findMany({
      where: { shiftDate, ...locWhere(locationId) },
      include: { employee: { select: { name: true } } },
      orderBy: [{ startTime: 'asc' }, { shiftDate: 'asc' }],
      take: 200, // bounded (coverage računa čez cel dan, seznam je cap-an spodaj)
    }),
    // TimeOffRequest NIMA locationId — scope prek employee.locationId
    // (pariteta /api/time-off R85-4b).
    db.timeOffRequest.count({
      where: { status: 'pending', ...(locationId ? { employee: { locationId } } : {}) },
    }),
  ])

  // Coverage šteje izmene, ki dejansko pokrivajo dan (brez cancelled/no_show).
  const present = rows.filter((s) => s.status !== 'cancelled' && s.status !== 'no_show')
  const byRole: Record<string, number> = {}
  for (const s of present) byRole[s.role] = (byRole[s.role] ?? 0) + 1

  return {
    shifts: rows.slice(0, SHIFTS_LIST_CAP).map((s) => ({
      employeeName: s.employee?.name ?? '',
      role: s.role,
      shiftType: s.shiftType,
      startTime: s.startTime,
      endTime: s.endTime,
      status: s.status,
    })),
    coverage: {
      scheduled: rows.filter((s) => s.status === 'scheduled').length,
      confirmed: rows.filter((s) => s.status === 'confirmed').length,
      byRole,
    },
    pendingTimeOff,
  }
}

// ============================================================
// 3. INVENTORY — nizka zaloga + potekajoče serije
// ============================================================
// Interni izkupiček nosi še ne-cap-ane števce (issues.operational jih porabi);
// route razčleni in v odgovor pošlje SAMO kontraktna polja.
export interface InventorySectionData extends BriefingInventorySection {
  /** Št. kritičnih nizko-zalogovnih artiklov (celoten vzorec, brez cap-a). */
  _criticalCount: number
  /** Št. serij, ki potekajo v ≤7 dnevnem oknu (celoten vzorec, brez cap-a). */
  _expiringTotal: number
}

export async function fetchInventorySection(
  locationId: string | null,
  dateStr: string,
  bounds: { start: Date; end: Date },
): Promise<InventorySectionData> {
  // Okno "poteka v ≤7 dneh": [danes 00:00 LJ, konec dneva danes+7) —
  // daysToExpiry 0..7 po LJ koledarju (EXPIRING_SOON_DAYS kanon).
  const expiringEnd = ljubljanaDayBounds(addDaysToYmd(dateStr, EXPIRING_SOON_DAYS)).end

  const [lowStockRows, lowStockCount, expiredCount, expiringRows] = await Promise.all([
    // Nizka zaloga: quantity <= minQuantity — field-reference pariteta
    // /api/operational-alerts (~161-168). Operational alerts gleda samo
    // quantity/minQuantity; tukaj dodamo še safetyStock (R129) za critical.
    db.inventoryItem.findMany({
      where: { quantity: { lte: db.inventoryItem.fields.minQuantity }, ...locWhere(locationId) },
      select: { id: true, name: true, quantity: true, minQuantity: true, unit: true, safetyStock: true },
      take: LOW_STOCK_SCAN_CAP,
    }),
    db.inventoryItem.count({
      where: { quantity: { lte: db.inventoryItem.fields.minQuantity }, ...locWhere(locationId) },
    }),
    // Pretečene AKTIVNE serije z ostankom — meja: expiryDate < danes 00:00 LJ.
    db.inventoryBatch.count({
      where: {
        status: 'ACTIVE',
        quantityRemaining: { gt: 0 },
        expiryDate: { lt: bounds.start },
        ...locWhere(locationId),
      },
    }),
    db.inventoryBatch.findMany({
      where: {
        status: 'ACTIVE',
        expiryDate: { not: null, gte: bounds.start, lt: expiringEnd },
        ...locWhere(locationId),
      },
      select: {
        lotNumber: true,
        expiryDate: true,
        quantityRemaining: true,
        unit: true,
        inventoryItem: { select: { name: true } },
      },
      orderBy: [{ expiryDate: 'asc' }, { receivedAt: 'asc' }],
      take: BATCH_SCAN_CAP,
    }),
  ])

  const mappedLow = lowStockRows.map((i) => {
    const qty = toNum(i.quantity)
    const minQty = toNum(i.minQuantity)
    const critical = qty <= 0 || (i.safetyStock != null && qty <= toNum(i.safetyStock))
    return {
      id: i.id,
      name: i.name,
      quantity: qty,
      minQuantity: minQty,
      unit: i.unit,
      status: critical ? ('critical' as const) : ('low' as const),
      _ratio: minQty > 0 ? qty / minQty : qty, // notranji sort ključ (razmerje zaloga/min)
    }
  })
  // Top 10: critical najprej, znotraj razreda najnižje razmerje zaloga/min.
  mappedLow.sort((a, b) => {
    if (a.status !== b.status) return a.status === 'critical' ? -1 : 1
    return a._ratio - b._ratio
  })
  const lowStock = mappedLow.slice(0, LOW_STOCK_CAP).map(({ _ratio, ...row }) => row)

  const expiring = expiringRows
    .map((b) => {
      const expiry = b.expiryDate
      return {
        lotNumber: b.lotNumber,
        itemName: b.inventoryItem?.name ?? '',
        expiryDate: expiry ? expiry.toISOString() : '',
        daysToExpiry: expiry ? ljCalendarDaysBetween(dateStr, expiry) : 0,
        quantityRemaining: toNum(b.quantityRemaining),
        unit: b.unit,
      }
    })
    .slice(0, EXPIRING_CAP)

  return {
    lowStock,
    lowStockCount,
    expiring,
    expiredCount,
    _criticalCount: mappedLow.filter((i) => i.status === 'critical').length,
    _expiringTotal: expiringRows.length,
  }
}

// ============================================================
// 4. PURCHASING — odprte naročilnice
// ============================================================
export async function fetchPurchasingSection(
  locationId: string | null,
  bounds: { start: Date; end: Date },
): Promise<BriefingPurchasingSection> {
  // OPEN_PO_STATUSES kanon (reorder/canon.ts) — 'sent'/'confirmed' iz stale
  // schema komentarja NE OBSTAJATA v živem state machine-u (R129 fix).
  const openWhere = { status: { in: [...OPEN_PO_STATUSES] }, ...locWhere(locationId) }
  const [rows, openCount] = await Promise.all([
    db.purchaseOrder.findMany({
      where: openWhere,
      include: { supplier: { select: { name: true } } },
      orderBy: { expectedDate: 'asc' },
      take: OPEN_PO_SCAN_CAP,
    }),
    db.purchaseOrder.count({ where: openWhere }),
  ])

  const arriving = rows.filter(
    (po) => po.expectedDate != null && po.expectedDate >= bounds.start && po.expectedDate < bounds.end,
  )

  return {
    openPos: rows.slice(0, OPEN_PO_CAP).map((po) => ({
      poNumber: po.poNumber,
      supplierName: po.supplier?.name ?? '',
      status: po.status,
      expectedDate: po.expectedDate ? po.expectedDate.toISOString() : null,
      totalAmount: toNum(po.totalAmount),
    })),
    openCount,
    arrivingToday: arriving.map((po) => ({
      poNumber: po.poNumber,
      supplierName: po.supplier?.name ?? '',
    })),
  }
}

// ============================================================
// 5. YESTERDAY — prodaja, top artikli, odpad, Z/DailyClose status
// ============================================================
export async function fetchYesterdaySection(
  locationId: string | null,
  yesterdayYmd: string,
  yBounds: { start: Date; end: Date },
  d2Bounds: { start: Date; end: Date },
): Promise<BriefingYesterdaySection> {
  const paidWhere = {
    paymentStatus: 'paid',
    paidAt: { gte: yBounds.start, lt: yBounds.end },
    ...locWhere(locationId),
  }
  const d2Where = {
    paymentStatus: 'paid',
    paidAt: { gte: d2Bounds.start, lt: d2Bounds.end },
    ...locWhere(locationId),
  }

  const [salesAgg, d2Agg, itemRows, wasteAgg, wasteByReason] = await Promise.all([
    db.order.aggregate({ where: paidWhere, _sum: { total: true, tip: true }, _count: true }),
    // day-2 primerjava — pctChange vrne null, ko day-2 nima plačanih naročil
    // (prev <= 0); nikoli ne izmišljujemo "%".
    db.order.aggregate({ where: d2Where, _sum: { total: true }, _count: true }),
    // Top artikli: voided=false, plačana naročila istega okna.
    db.orderItem.findMany({
      where: { voided: false, order: paidWhere },
      select: { menuItemName: true, quantity: true, price: true },
      take: TOP_ITEMS_SCAN_CAP,
    }),
    // Odpad: ne-reversiran, LJ okno včeraj (WasteRecord.locationId NOT NULL).
    db.wasteRecord.aggregate({
      where: { createdAt: { gte: yBounds.start, lt: yBounds.end }, reversedAt: null, ...locWhere(locationId) },
      _sum: { totalCost: true },
      _count: true,
    }),
    db.wasteRecord.groupBy({
      by: ['reason'],
      where: { createdAt: { gte: yBounds.start, lt: yBounds.end }, reversedAt: null, ...locWhere(locationId) },
      _sum: { totalCost: true },
      _count: true,
    }),
  ])

  const revenue = round2(toNum(salesAgg._sum.total))
  const ordersCount = salesAgg._count
  const revenueD2 = round2(toNum(d2Agg._sum.total))

  // Group po SNAPSHOT imenu (menuItemName) — top 5 po količini, tie po prihodku.
  const itemMap = new Map<string, { quantity: number; revenue: number }>()
  for (const row of itemRows) {
    const key = row.menuItemName || '(brez imena)'
    const bucket = itemMap.get(key) ?? { quantity: 0, revenue: 0 }
    bucket.quantity += row.quantity
    bucket.revenue += toNum(row.price) * row.quantity
    itemMap.set(key, bucket)
  }
  const topItems = [...itemMap.entries()]
    .map(([name, v]) => ({ name, quantity: v.quantity, revenue: round2(v.revenue) }))
    .sort((a, b) => b.quantity - a.quantity || b.revenue - a.revenue)
    .slice(0, TOP_ITEMS_CAP)

  const topReasons = wasteByReason
    .map((r) => ({ reason: r.reason, cost: round2(toNum(r._sum.totalCost)), count: r._count }))
    .sort((a, b) => b.cost - a.cost)
    .slice(0, TOP_REASONS_CAP)

  // Z/DailyClose status: per-(dan, lokacija) unikata → globalni scope (null)
  // NE more vrniti smiselnega statusa → null (UI izriše "—", ne "none").
  // reportDate/businessDate = LJ day-start žig včerajšnjega dne.
  let zReportStatus: BriefingYesterdaySection['zReportStatus'] = null
  let dailyCloseStatus: BriefingYesterdaySection['dailyCloseStatus'] = null
  if (locationId) {
    const yDayStart = ljubljanaDayBounds(yesterdayYmd).start
    const [zr, dc] = await Promise.all([
      db.zReport.findFirst({ where: { reportDate: yDayStart, locationId }, select: { status: true } }),
      db.dailyClose.findFirst({ where: { businessDate: yDayStart, locationId }, select: { status: true } }),
    ])
    zReportStatus = (zr?.status as BriefingYesterdaySection['zReportStatus']) ?? null
    dailyCloseStatus = (dc?.status as BriefingYesterdaySection['dailyCloseStatus']) ?? null
  }

  return {
    sales: {
      revenue,
      ordersCount,
      avgTicket: ordersCount > 0 ? round2(revenue / ordersCount) : 0,
      tips: round2(toNum(salesAgg._sum.tip)),
      revenueChangePct: pctChange(revenue, revenueD2),
    },
    topItems,
    waste: {
      totalCost: round2(toNum(wasteAgg._sum.totalCost)),
      topReasons,
    },
    zReportStatus,
    dailyCloseStatus,
  }
}

// ============================================================
// 6. ISSUES — nerešena mnenja + čakajoča potrditve
// ============================================================
export async function fetchIssuesSection(
  locationId: string | null,
): Promise<BriefingIssuesSection> {
  const locFilter = locWhere(locationId)

  // Semantika nerešenih mnenj (R141-d popavek buga iz R141-b): migracija 0021
  // je status backfillala na 'new' (NOT NULL DEFAULT), zato vrstica s
  // statusom NULL fizično ne more obstajati — Prisma pa WHERE filter
  // { status: null } na NOT NULL stolpcu zavrže s PrismaClientValidationError.
  // Prejšnji "obrambni" legacy branchi (ločen best-effort count + ista OR-veja
  // v `oldest` agregatu BREZ lastnega catch-a) sta bila mrtva koda: prvi je
  // pričakal 0, drugi je SESUL celotno issues sekcijo (najdeno v R141-d
  // integration rundi). Edini pravi legacy signal je responded=true (stara
  // resolucija, status backfillan na 'new') — izključimo ga z responded: false.
  const [newCount, inReviewCount, oldestAgg, pendingCloses, pendingStocktakes] = await Promise.all([
    db.guestFeedback.count({ where: { status: 'new', responded: false, ...locFilter } }),
    db.guestFeedback.count({ where: { status: 'in_review', ...locFilter } }),
    // oldest = min createdAt celega nerešenega seta (new + in_review; legacy
    // resolved — responded=true, backfill 'new' — ni nerešen in ne sme lažno
    // starati najstarejšega mnenja).
    db.guestFeedback.aggregate({
      where: { status: { in: ['new', 'in_review'] }, responded: false, ...locFilter },
      _min: { createdAt: true },
    }),
    // DailyClose ima locationId NOT NULL — count deluje tudi globalno.
    db.dailyClose.count({ where: { status: 'PENDING_APPROVAL', ...locFilter } }),
    // Stocktake enum: DRAFT | IN_REVIEW | APPROVED | CANCELLED (schema :1175).
    db.stocktake.count({ where: { status: { in: ['DRAFT', 'IN_REVIEW'] }, ...locFilter } }),
  ])

  const oldest = oldestAgg._min.createdAt
  return {
    unresolvedFeedback: {
      new: newCount,
      inReview: inReviewCount,
      oldest: oldest ? oldest.toISOString() : null,
    },
    pendingApprovals: {
      dailyCloses: pendingCloses,
      stocktakes: pendingStocktakes,
    },
  }
}

// ============================================================
// 7. KDS — včerajšnji prep + živi aktivni ticketi
// ============================================================
export async function fetchKdsSection(
  locationId: string | null,
  yBounds: { start: Date; end: Date },
): Promise<BriefingKdsSection> {
  const [bumpedRows, activeTickets] = await Promise.all([
    // Bumped vzorec: readyAt v včerajšnjem LJ oknu, ne-voidane — 1:1
    // kitchen/metrics throughput where (legacy readyAt NULL naravno izključene).
    db.orderItem.findMany({
      where: {
        readyAt: { gte: yBounds.start, lt: yBounds.end },
        voided: false,
        ...(locationId ? { order: { locationId } } : {}),
      },
      select: {
        readyAt: true,
        firedAt: true,
        createdAt: true,
        orderId: true,
        menuItem: { select: { prepStation: { select: { avgPrepTime: true, type: true } } } },
      },
      orderBy: { readyAt: 'asc' },
      take: KDS_SAMPLE_CAP,
    }),
    // Živi aktivni ticketi — ISTA definicija kot kitchen/metrics live:
    // naročila pending/in-progress z vsaj 1 aktivnim (ne-voidanim) artiklom.
    db.order.count({
      where: {
        status: { in: ['pending', 'in-progress'] },
        ...(locationId ? { locationId } : {}),
        orderItems: { some: { voided: false, status: { in: [...KDS_ACTIVE_ITEM_STATUSES] } } },
      },
    }),
  ])

  const stats = computePrepStats(
    bumpedRows
      .filter((row): row is typeof row & { readyAt: Date } => row.readyAt != null)
      .map((row) => ({
        readyAt: new Date(row.readyAt),
        baseAt: resolveBaseAt(row.firedAt, row.createdAt),
        // Tarča = prepStation.avgPrepTime (R133 kanon — MenuItem.prepTimeMinutes
        // ne obstaja v shemi; brez postaje = brez tarče, izključena iz onTimeRate).
        targetMinutes: row.menuItem?.prepStation?.avgPrepTime ?? null,
        station: row.menuItem?.prepStation?.type ?? null,
        orderId: row.orderId,
      })),
  )

  // Kontrakt zahteva števila (ne null) — prazen vzorec/brez tarč → 0.
  return {
    lateCount: stats.lateCount,
    onTimeRate: stats.onTimeRate ?? 0,
    avgFiredToReadyMinutes: stats.avgMinutes ?? 0,
    activeTickets,
  }
}
