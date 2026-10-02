// Pomožne funkcije za finančno poročanje — poizvedbe in datumska obdobja
// GET /api/reports/financial — pomožni modul za poizvedbe

import { db } from '@/lib/db'
import { ljubljanaDayBounds, ljubljanaDateTimeParts } from '@/lib/timezone-sl'
import { buildSaleCogsWindowFilter, buildOtherStockTypesWindowFilter } from '@/lib/reports/sale-cogs-bucketing'

// R158-4 (R159-b): 'YYYY-MM-DD' + n dni (čisti koledarski add/sub po vzorcu
// briefing/_helpers addDaysToYmd — DST-varno, brez start-24h).
function addDaysToYmd(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10)
}

// ─── Tipi ───
export interface DateRange {
  startDate: Date
  endDate: Date
  prevStartDate: Date
  prevEndDate: Date
  periodLabel: string
}

// ─── Izračunaj obdobje glede na tip ───
// R158-4 (R159-b): vsa obdobja po LJ poslovnemu dnevu (P2-08 kanon) — prej
// setHours po strežniškem TZ. refDate prihaja kot new Date('YYYY-MM-DD')
// (UTC polnoč) — LJ datum izpeljemo prek ljubljanaDateTimeParts; meje so LJ
// polnoči, konzumenti (fetchFinancialData) uporabljajo lte → konec obdobja =
// zadnja milisekunda LJ končnega dne (pariteta s starim 23:59:59.999).
// prev okna = čisti koledarski odštevek po YMD (DST-varno, brez setDate-24h).
export function calcDateRange(refDate: Date, period: string): DateRange {
  const ymd = ljubljanaDateTimeParts(refDate.toISOString()).date
  const [y, m, d] = ymd.split('-').map(Number)
  const pad = (n: number): string => String(n).padStart(2, '0')

  const dayStart = (day: string): Date => ljubljanaDayBounds(day).start
  const dayEndIncl = (day: string): Date => new Date(ljubljanaDayBounds(day).end.getTime() - 1)

  let startDate: Date
  let endDate: Date
  let prevStartDate: Date
  let prevEndDate: Date
  let periodLabel: string

  switch (period) {
    case 'daily': {
      startDate = dayStart(ymd)
      endDate = dayEndIncl(ymd)
      const prevYmd = addDaysToYmd(ymd, -1)
      prevStartDate = dayStart(prevYmd)
      prevEndDate = dayEndIncl(prevYmd)
      periodLabel = startDate.toLocaleDateString('sl-SI', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Europe/Ljubljana' })
      break
    }
    case 'weekly': {
      const mondayOffset = (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7 // Pon=0
      const mondayYmd = addDaysToYmd(ymd, -mondayOffset)
      const sundayYmd = addDaysToYmd(mondayYmd, 6)
      startDate = dayStart(mondayYmd)
      endDate = dayEndIncl(sundayYmd)
      prevStartDate = dayStart(addDaysToYmd(mondayYmd, -7))
      prevEndDate = dayEndIncl(addDaysToYmd(mondayYmd, -1))
      periodLabel = `${startDate.toLocaleDateString('sl-SI', { day: '2-digit', month: '2-digit', timeZone: 'Europe/Ljubljana' })} - ${endDate.toLocaleDateString('sl-SI', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Europe/Ljubljana' })}`
      break
    }
    case 'monthly': {
      const lastDay = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10) // zadnji dan meseca
      startDate = dayStart(`${y}-${pad(m)}-01`)
      endDate = dayEndIncl(lastDay)
      const prevFirst = new Date(Date.UTC(y, m - 2, 1)).toISOString().slice(0, 10)
      const prevLast = new Date(Date.UTC(y, m - 1, 0)).toISOString().slice(0, 10)
      prevStartDate = dayStart(prevFirst)
      prevEndDate = dayEndIncl(prevLast)
      periodLabel = startDate.toLocaleDateString('sl-SI', { month: 'long', year: 'numeric', timeZone: 'Europe/Ljubljana' })
      break
    }
    case 'yearly': {
      startDate = dayStart(`${y}-01-01`)
      endDate = dayEndIncl(`${y}-12-31`)
      prevStartDate = dayStart(`${y - 1}-01-01`)
      prevEndDate = dayEndIncl(`${y - 1}-12-31`)
      periodLabel = String(y)
      break
    }
    default: {
      startDate = dayStart(ymd)
      endDate = dayEndIncl(ymd)
      const prevYmd = addDaysToYmd(ymd, -1)
      prevStartDate = dayStart(prevYmd)
      prevEndDate = dayEndIncl(prevYmd)
      periodLabel = startDate.toLocaleDateString('sl-SI', { timeZone: 'Europe/Ljubljana' })
    }
  }
  return { startDate, endDate, prevStartDate, prevEndDate, periodLabel }
}

// ─── Vzporedne poizvedbe za finančne podatke ───
// FIX CRITICAL: Za finančna poročila uporabimo paidAt (datum plačila) namesto createdAt.
// Naročilo, ustvarjeno včeraj a plačano danes, sodi v današnji dan.
// FIX R84-1 HIGH: locationId tenant scope — prej so vsi 10 agregati zajemali
// podatke VSEH lokacij. null scope (super-admin) = PRAZEN filter, nikoli
// { locationId: null }. StockTransaction nima lastnega locationId stolpca —
// vezava gre prek relacije inventoryItem.locationId.
export async function fetchFinancialData(
  startDate: Date,
  endDate: Date,
  prevStartDate: Date,
  prevEndDate: Date,
  locationId: string | null,
) {
  // Tenant filterji (pogojno — super-admin = globalno)
  const orderWhereBase = { ...(locationId ? { locationId } : {}) }
  // G2 R216 (#152 korak 2): sale-chain COGS ('sale'+'return') bucketiran na
  // LJ poslovni dan prodaje (order.paidAt — ISTI kanon kot prihodki zgoraj),
  // fallback (brez plačanega naročila) + ne-naročilni tipi na času ognja
  // (createdAt) = prejšnje vedenje. inventoryItem.locationId scope OSTANE
  // top-level ključ (R84-1 pin: implicitni AND z OR vejami).
  const stockWhere = {
    OR: [
      ...buildSaleCogsWindowFilter(startDate, endDate),
      buildOtherStockTypesWindowFilter(startDate, endDate),
    ],
    ...(locationId ? { inventoryItem: { locationId } } : {}),
  }
  const shiftWhere = {
    openedAt: { gte: startDate, lte: endDate },
    ...(locationId ? { locationId } : {}),
  }

  return Promise.all([
    // 1. Status counts za trenutno obdobje — groupBy namesto JS .filter()
    db.order.groupBy({
      by: ['status'],
      where: { createdAt: { gte: startDate, lte: endDate }, ...orderWhereBase },
      _count: true,
    }),
    // 2. Finančni agregati za trenutno obdobje — aggregate namesto findMany + reduce
    db.order.aggregate({
      where: { paidAt: { gte: startDate, lte: endDate }, paymentStatus: 'paid', ...orderWhereBase },
      _sum: { total: true, subtotal: true, tax: true, discount: true, tip: true },
      _count: true,
    }),
    // 3. Plačana naročila za podrobnosti (plačilne metode, napitnine, mize)
    db.order.findMany({
      where: { paidAt: { gte: startDate, lte: endDate }, paymentStatus: 'paid', ...orderWhereBase },
      select: {
        type: true, tableId: true, employeeId: true, total: true, tip: true,
        table: { select: { number: true, area: true } },
        checks: {
          select: {
            payments: {
              where: { status: 'completed' },
              select: { type: true, amount: true, tipAmount: true },
            },
          },
        },
      },
      orderBy: { paidAt: 'asc' },
    }),
    // 4. Zaključena naročila za časovno razdelitev — lahka poizvedba s select
    db.order.findMany({
      where: { createdAt: { gte: startDate, lte: endDate }, status: 'completed', ...orderWhereBase },
      select: { paidAt: true, createdAt: true, total: true },
    }),
    // 5. Finančni agregati za prejšnje obdobje
    db.order.aggregate({
      where: { paidAt: { gte: prevStartDate, lte: prevEndDate }, paymentStatus: 'paid', ...orderWhereBase },
      _sum: { total: true, subtotal: true, tax: true, discount: true, tip: true },
      _count: true,
    }),
    // 6. Plačana naročila za prejšnje obdobje časovno razdelitev
    db.order.findMany({
      where: { paidAt: { gte: prevStartDate, lte: prevEndDate }, paymentStatus: 'paid', ...orderWhereBase },
      select: { paidAt: true, createdAt: true, total: true },
    }),
    // 7. Artikli naročil za kategorije/DDV razčlenitev
    db.orderItem.findMany({
      where: { order: { paidAt: { gte: startDate, lte: endDate }, paymentStatus: 'paid', ...orderWhereBase }, voided: false },
      select: {
        menuItemId: true, price: true, quantity: true, vatRate: true, vatAmount: true,
        menuItem: { select: { name: true, category: { select: { name: true } } } },
      },
    }),
    // 8. Stroški zaloga po tipu — groupBy namesto JS .filter()
    db.stockTransaction.groupBy({
      by: ['type'],
      where: stockWhere,
      _sum: { totalCost: true },
    }),
    // 9. Blagajna izpiski — aggregate namesto findMany + reduce
    db.cashRegisterShift.aggregate({
      where: shiftWhere,
      _sum: { cashSales: true, cardSales: true, mobileSales: true },
      _count: true,
    }),
    // 10. Vrste naročil — groupBy namesto JS forEach
    db.order.groupBy({
      by: ['type'],
      where: { paidAt: { gte: startDate, lte: endDate }, paymentStatus: 'paid', ...orderWhereBase },
      _sum: { total: true },
      _count: true,
    }),
  ])
}
