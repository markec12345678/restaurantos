import { db } from '@/lib/db'
import { toNum, deepToNumbers, type DecimalLike } from '@/lib/decimal'
import { z } from 'zod'

// ============================================
// Cash register API helpers — extracted from route.ts
// ============================================

/** Validacija za odpiranje izmene */
export const openShiftSchema = z.object({
  employeeId: z.string().max(100, 'ID zaposlenega je predolg').optional(),
  employeeName: z.string().max(100, 'Ime ne sme preseči 100 znakov').default(''),
  startingCash: z.number().min(0, 'Začetna gotovina ne more biti negativna').max(9999999, 'Začetna gotovina je previsoka').default(0),
})

/** Izračunaj statistiko v živo za aktivno izmeno */
export async function calculateLiveStats(activeShift: { openedAt: Date; locationId: string | null; startingCash: DecimalLike }) {
  const orderWhere: Record<string, unknown> = {
    paymentStatus: { in: ['paid', 'storno'] },
    paidAt: { gte: activeShift.openedAt },
  }
  if (activeShift.locationId) {
    orderWhere.locationId = activeShift.locationId
  }

  const paymentWhere = {
    status: 'completed' as const,
    check: { order: orderWhere },
  }

  const [paymentByType, totalPaymentsResult, cashTipsResult, paidOrderCount, stornoTotals, discountResult] = await Promise.all([
    db.payment.groupBy({
      by: ['type'],
      where: paymentWhere,
      _sum: { amount: true },
    }),
    db.payment.aggregate({
      where: paymentWhere,
      _sum: { amount: true },
    }),
    db.payment.aggregate({
      where: { ...paymentWhere, type: 'cash' },
      _sum: { tipAmount: true },
    }),
    db.order.count({
      where: { ...orderWhere, paymentStatus: 'paid' },
    }),
    db.order.aggregate({
      where: { ...orderWhere, paymentStatus: 'storno' },
      _sum: { total: true },
    }),
    db.order.aggregate({
      where: { ...orderWhere, paymentStatus: 'paid' },
      _sum: { discount: true },
    }),
  ])

  const salesByType = new Map<string, number>()
  for (const row of paymentByType) {
    salesByType.set(row.type, toNum(row._sum.amount))
  }

  const cashSales = salesByType.get('cash') || 0
  const cardSales = salesByType.get('card') || 0
  const mobileSales = salesByType.get('mobile') || 0
  const alternateSales = ['voucher', 'loyalty', 'giftcard', 'alternate']
    .reduce((sum, type) => sum + (salesByType.get(type) || 0), 0)
  const totalSales = toNum(totalPaymentsResult._sum.amount)
  const totalDiscounts = toNum(discountResult._sum.discount)
  const totalOrders = paidOrderCount
  const totalVoided = Math.abs(toNum(stornoTotals._sum.total))
  const cashTips = toNum(cashTipsResult._sum.tipAmount)
  const expectedCash = toNum(activeShift.startingCash) + cashSales + cashTips

  return {
    cashSales,
    cardSales,
    mobileSales,
    alternateSales,
    totalSales,
    totalOrders,
    totalDiscounts,
    totalVoided,
    expectedCash,
  }
}

/** Odpri novo izmeno znotraj transakcije */
export async function openShift(data: { employeeId?: string; employeeName: string; startingCash: number }) {
  const shift = await db.$transaction(async (tx) => {
    const shiftWhere: Record<string, unknown> = { status: 'open' }
    if (data.employeeId) {
      const emp = await tx.employee.findUnique({ where: { id: data.employeeId } })
      if (emp?.locationId) shiftWhere.locationId = emp.locationId
    }
    const existingShift = await tx.cashRegisterShift.findFirst({
      where: shiftWhere,
    })

    if (existingShift) {
      throw new Error('ALREADY_OPEN')
    }

    if (!data.employeeId) {
      throw new Error('EMPLOYEE_ID_REQUIRED')
    }

    let shiftLocationId: string | null = null
    if (data.employeeId) {
      const emp = await tx.employee.findUnique({ where: { id: data.employeeId } })
      shiftLocationId = emp?.locationId || null
    }

    const previousShift = await tx.cashRegisterShift.findFirst({
      where: {
        status: 'closed',
        ...(shiftLocationId ? { locationId: shiftLocationId } : {}),
      },
      orderBy: { closedAt: 'desc' },
    })
    if (previousShift && previousShift.closingCash !== undefined) {
      const tolerance = 0.01
      if (Math.abs(data.startingCash - toNum(previousShift.closingCash)) > tolerance) {
        throw new Error(`STARTING_CASH_MISMATCH:${previousShift.closingCash}:${data.startingCash}`)
      }
    }

    return tx.cashRegisterShift.create({
      data: {
        employeeId: data.employeeId || null,
        employeeName: data.employeeName,
        startingCash: data.startingCash,
        status: 'open',
        locationId: shiftLocationId,
      },
    })
  })

  return deepToNumbers(shift)
}
