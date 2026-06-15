// Pomožne funkcije za Dashboard API — FURS status, aktivna izmena, COGS

import { db } from '@/lib/db'
import { toNum, round2, abs } from '@/lib/decimal'
import type { FursShiftCogsResult } from './types'

// ─── FURS status, aktivna izmena, COGS ─────────────────────

export async function fetchFursShiftCogs(today: Date, tomorrow: Date, todayRevenue: number): Promise<FursShiftCogsResult> {
  const [settings, todayVerifiedReceipts, todayUnverifiedReceipts, activeShift, stockMovements] = await Promise.all([
    db.restaurantSettings.findFirst({ where: { isActive: true } }),
    db.receipt.count({
      where: { createdAt: { gte: today, lt: tomorrow }, fiscalVerified: true },
    }),
    db.receipt.count({
      where: { createdAt: { gte: today, lt: tomorrow }, fiscalVerified: false },
    }),
    db.cashRegisterShift.findFirst({
      where: { status: 'open' },
      orderBy: { openedAt: 'desc' },
    }),
    db.stockTransaction.findMany({
      where: { createdAt: { gte: today, lt: tomorrow }, type: 'sale' },
      select: { totalCost: true },
    }),
  ])

  const todayCogs = stockMovements.reduce((sum, t) => sum + toNum(abs(t.totalCost)), 0)
  const grossProfit = todayRevenue - todayCogs

  return {
    fursStatus: {
      configured: !!(settings?.fursCertPath),
      environment: settings?.fursEnvironment || 'test',
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
