// Pomožne funkcije za Dashboard API — FURS status, aktivna izmena, COGS

import { db } from '@/lib/db'
import { toNum, round2, abs } from '@/lib/decimal'
import type { DecimalLike } from '@/lib/decimal'
import type { CashRegisterShift } from '@prisma/client'
import type { FursShiftCogsResult } from './types'

// ─── FURS status, aktivna izmena, COGS ─────────────────────

// FIX P0-C3A: Dodan locationId parameter. Prej je settings.findFirst({isActive:true})
// bilo globalno — v multi-tenant setupu je dashboard prikazal FURS status napačne lokacije.
// Prav tako so receipt/shift/stock poizvedbe sedaj scopeane na locationId.
export async function fetchFursShiftCogs(
  today: Date,
  tomorrow: Date,
  todayRevenue: number,
  locationId?: string | null,
): Promise<FursShiftCogsResult> {
  // FIX P0-C3A: Pridobi FURS cert status iz Location (ne globalnih settings)
  const location = locationId
    ? await db.location.findUnique({
        where: { id: locationId },
        select: { fursCertPath: true, fursEnvironment: true },
      })
    : null
  const locationFilter = locationId ? { locationId } : {}

  // FIX: Wrap v try-catch — production DB morda nima vseh stolpcev
  let todayVerifiedReceipts = 0
  let todayUnverifiedReceipts = 0
  // R191: realni domenski tipi (Prisma payload) namesto any — R190 vzorec.
  // .catch fallbacki ohranijo tipe: null / [] sta združljiva z deklaracijami.
  let activeShift: CashRegisterShift | null = null
  let stockMovements: Array<{ totalCost: DecimalLike }> = []

  try {
    [todayVerifiedReceipts, todayUnverifiedReceipts, activeShift, stockMovements] = await Promise.all([
      db.receipt.count({
        where: { ...locationFilter, createdAt: { gte: today, lt: tomorrow }, fiscalVerified: true },
      }).catch(() => 0),
      db.receipt.count({
        where: { ...locationFilter, createdAt: { gte: today, lt: tomorrow }, fiscalVerified: false },
      }).catch(() => 0),
      db.cashRegisterShift.findFirst({
        where: { ...locationFilter, status: 'open' },
        orderBy: { openedAt: 'desc' },
      }).catch(() => null),
      db.stockTransaction.findMany({
        // FIX R85-H1: + tenant scope — StockTransaction nima lastnega locationId
        // (R84 financial vzorec): scope prek inventoryItem.locationId. Prej je
        // todayCogs zajel strosek prodaje VSEH lokacij.
        // G2 R216 (#152 korak 2): sale COGS bucketiran na LJ poslovni dan
        // prodaje (order.paidAt — ISTI kanon kot todayRevenue prihodek, ki
        // prihaja iz paidAt okna), fallback (brez plačanega naročila) na času
        // ognja (createdAt) = prejšnje vedenje. Naročilo ob 23:50 / plačilo ob
        // 00:10 ne razdeli več brute marže med dneva.
        where: {
          type: 'sale',
          OR: [
            { order: { paidAt: { gte: today, lt: tomorrow } } },
            { createdAt: { gte: today, lt: tomorrow }, OR: [{ orderId: null }, { order: { paidAt: null } }] },
          ],
          ...(locationId ? { inventoryItem: { locationId } } : {}),
        },
        select: { totalCost: true },
      }).catch(() => []),
    ])
  } catch {
    // Fallback — return defaults
  }

  const todayCogs = stockMovements.reduce((sum, t) => sum + toNum(abs(t.totalCost)), 0)
  const grossProfit = todayRevenue - todayCogs

  return {
    fursStatus: {
      configured: !!(location?.fursCertPath),
      environment: location?.fursEnvironment || 'test',
      todayVerified: todayVerifiedReceipts,
      todayUnverified: todayUnverifiedReceipts,
    },
    activeShift: activeShift ? {
      id: activeShift.id,
      openedAt: activeShift.openedAt.toISOString(),
      startingCash: toNum(activeShift.startingCash),
      cashSales: toNum(activeShift.cashSales),
      cardSales: toNum(activeShift.cardSales),
      totalSales: toNum(activeShift.totalSales),
      totalOrders: activeShift.totalOrders,
    } : null,
    todayCogs: round2(todayCogs),
    grossProfit: round2(grossProfit),
    grossMargin: todayRevenue > 0 ? round2((grossProfit / todayRevenue) * 100) : 0,
  }
}
