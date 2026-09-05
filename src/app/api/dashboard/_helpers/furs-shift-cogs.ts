// Pomožne funkcije za Dashboard API — FURS status, aktivna izmena, COGS

import { db } from '@/lib/db'
import { toNum, round2, abs } from '@/lib/decimal'
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

  const [todayVerifiedReceipts, todayUnverifiedReceipts, activeShift, stockMovements] = await Promise.all([
    db.receipt.count({
      where: { ...locationFilter, createdAt: { gte: today, lt: tomorrow }, fiscalVerified: true },
    }),
    db.receipt.count({
      where: { ...locationFilter, createdAt: { gte: today, lt: tomorrow }, fiscalVerified: false },
    }),
    db.cashRegisterShift.findFirst({
      where: { ...locationFilter, status: 'open' },
      orderBy: { openedAt: 'desc' },
    }),
    db.stockTransaction.findMany({
      // StockTransaction morda nima locationId — uporabljamo order.locationId prek include
      where: { createdAt: { gte: today, lt: tomorrow }, type: 'sale' },
      select: { totalCost: true },
    }),
  ])

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
