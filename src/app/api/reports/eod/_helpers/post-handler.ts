// POST handler za EOD — zaključek obratovalnega dneva

import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { eodCloseSchema } from '@/lib/validations'
import { parseJsonBody, validateBody, handleApiError } from '@/lib/api-utils'
import { computeEodCloseData, closeShiftTransaction, logEodClose } from './eod-close'

export async function handleEodPost(req: Request, authSession: { session?: { employeeId?: string } | null }) {
  const bodyResult = await parseJsonBody(req)
  if (bodyResult.error) return bodyResult.error

  // FIX: Zod validacija za zaključek dneva
  const { data, error: validationError } = validateBody(eodCloseSchema, bodyResult.data)
  if (validationError) return validationError

  const { date, closingCash, notes } = data

  const targetDate = date || new Date().toISOString().split('T')[0]
  const dayStart = new Date(targetDate + 'T00:00:00.000Z')
  const dayEnd = new Date(targetDate + 'T23:59:59.999Z')

  // Preveri, da so vsa naročila zaključena ali preklicana
  const pendingOrders = await db.order.count({
    where: {
      createdAt: { gte: dayStart, lte: dayEnd },
      status: { in: ['pending', 'in-progress', 'ready'] },
    },
  })

  if (pendingOrders > 0) {
    return NextResponse.json({
      error: `Obstaja ${pendingOrders} odprtih naročil. Najprej zaključite ali prekličite vsa naročila.`,
      pendingCount: pendingOrders,
    }, { status: 400 })
  }

  // Izračunaj zaključne podatke
  const closeData = await computeEodCloseData(dayStart, dayEnd, closingCash, targetDate)

  // Zapri izmeno
  await closeShiftTransaction(closeData.activeShift.id, {
    actualClosingCash: closeData.actualClosingCash,
    expectedCash: closeData.expectedCash,
    cashDifference: closeData.cashDifference,
    cashSales: closeData.cashSales,
    cardSales: closeData.cardSales,
    mobileSales: closeData.mobileSales,
    alternateSales: closeData.alternateSales,
    totalSales: closeData.totalSales,
    completedOrdersCount: closeData.completedOrders.length,
    totalDiscounts: closeData.totalDiscounts,
    totalTips: closeData.totalTips,
    totalVoided: closeData.totalVoided,
    notes: notes || undefined,
  })

  // Revizijski dnevnik
  await logEodClose(
    authSession.session?.employeeId,
    closeData.activeShift.id,
    targetDate,
    {
      totalSales: closeData.totalSales,
      cashSales: closeData.cashSales,
      cardSales: closeData.cardSales,
      mobileSales: closeData.mobileSales,
      cashDifference: closeData.cashDifference,
    },
  )

  return NextResponse.json({
    success: true,
    message: 'Obratovalni dan uspešno zaključen',
    shiftId: closeData.activeShift.id,
    closedAt: new Date().toISOString(),
    summary: {
      totalSales: closeData.totalSales, cashSales: closeData.cashSales, cardSales: closeData.cardSales, mobileSales: closeData.mobileSales,
      totalTips: closeData.totalTips, totalDiscounts: closeData.totalDiscounts,
      startingCash: closeData.startingCash,
      expectedCash: closeData.expectedCash, closingCash: closeData.actualClosingCash, cashDifference: closeData.cashDifference,
    },
  })
}

// Error handler za EOD POST
export function handleEodPostError(error: unknown) {
  if (error instanceof Error && error.message === 'NO_OPEN_SHIFT') {
    return NextResponse.json({ error: 'Ni odprte blagajniške izmene' }, { status: 400 })
  }
  if (error instanceof Error && error.message === 'SHIFT_ALREADY_CLOSED') {
    return NextResponse.json({ error: 'Izmena je že zaprta' }, { status: 409 })
  }
  return handleApiError(error, 'POST /api/reports/eod', 'Napaka pri zaključku dneva')
}
