
// FIX CRITICAL: Zod validacija za zaprtje izmene
import { db, createAuditLog } from '@/lib/db'
import { toNum, deepToNumbers } from '@/lib/decimal'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { z } from 'zod'
import { emitEvent } from '@/lib/event-emitter'
import { logger } from '@/lib/logger'
import { handleRouteError, validateRequest } from '@/lib/api-utils'
const closeShiftSchema = z.object({
  closingCash: z.number().min(0, 'Končna gotovina ne more biti negativna').optional(),
  totalTips: z.number().min(0, 'Napitnine ne morejo biti negativne').default(0),
  notes: z.string().max(1000, 'Opombe ne smejo preseči 1000 znakov').default(''),
})

// PUT /api/cash-register/[id] — Close a shift
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params

    // FIX BUG 7: Zahtevaj avtentikacijo za zapiranje izmene
    const authResult = await requireAuth(req, { permission: 'manage_cash' })
    if (authResult.error) return authResult.error

    const { data, error: validationError } = await validateRequest(req, closeShiftSchema)
    if (validationError) return validationError

    // FIX CASH-05 HIGH: Premakni status check ZNOTRAJ transakcije — prepreči race condition
    // Prejšnja koda je preverila status PRED transakcijo, kar je dovoljevalo double-close
    const closedShift = await db.$transaction(async (tx) => {
      const shift = await tx.cashRegisterShift.findUnique({ where: { id } })
      if (!shift) {
        throw new Error('SHIFT_NOT_FOUND')
      }
      if (shift.status === 'closed') {
        throw new Error('SHIFT_ALREADY_CLOSED')
      }

      // FIX BUG-07: Preveri, da ni odprtih naročil pred zaprtjem izmene
      // FIX HIGH: Filtriraj po locationId — brez tega se prikažejo naročila iz VSEH lokacij
      const openOrders = await tx.order.count({
        where: {
          paymentStatus: { in: ['unpaid', 'partial'] },
          createdAt: { gte: shift.openedAt },
          ...(shift.locationId ? { locationId: shift.locationId } : {}),
        },
      })
      if (openOrders > 0) {
        throw new Error(`OPEN_ORDERS:${openOrders}`)
      }

      // FIX CASH-04 HIGH: Prepreči double-counting storno naročil
      // FIX CRITICAL: Dodaj locationId filter — brez tega se pri več lokacijah prikažejo naročila iz VSEH lokacij
      const paidOrders = await tx.order.findMany({
        where: {
          paymentStatus: 'paid',
          paidAt: { gte: shift.openedAt },
          ...(shift.locationId ? { locationId: shift.locationId } : {}),
        },
        select: {
          id: true,
          total: true,
          discount: true,
          tip: true,
          paymentStatus: true,
          checks: {
            select: {
              payments: {
                where: { status: 'completed' },
                select: { type: true, amount: true, tipAmount: true },
              },
            },
          },
        },
      })

      // Ločeno poizvedba za storno — BREZ prekrivanja s plačanimi
      // FIX HIGH: Storno naročila naj uporabijo cancelledAt namesto updatedAt — updatedAt se spremeni ob vsaki redakciji
      const stornoOrders = await tx.order.findMany({
        where: {
          paymentStatus: 'storno',
          cancelledAt: { gte: shift.openedAt },
          ...(shift.locationId ? { locationId: shift.locationId } : {}),
        },
        select: { id: true, total: true },
      })

      // FIX CRITICAL: Izračunaj po ACTUAL plačilih (uporabi payments iz checkov)
      const allPayments = paidOrders.flatMap(o => o.checks.flatMap(c => c.payments))
      const cashSales = allPayments.filter(p => p.type === 'cash').reduce((sum, p) => sum + toNum(p.amount), 0)
      const cardSales = allPayments.filter(p => p.type === 'card').reduce((sum, p) => sum + toNum(p.amount), 0)
      const mobileSales = allPayments.filter(p => p.type === 'mobile').reduce((sum, p) => sum + toNum(p.amount), 0)
      const alternateSales = allPayments.filter(p => ['voucher', 'loyalty', 'giftcard', 'alternate'].includes(p.type)).reduce((sum, p) => sum + toNum(p.amount), 0)

      // FIX CASH-06 MEDIUM: Split plačila — preštej naročila z več plačilnimi metodami
      const ordersWithMultiplePayments = paidOrders.filter(o => {
        const paymentTypes = new Set(o.checks.flatMap(c => c.payments.map(p => p.type)))
        return paymentTypes.size > 1
      })
      const splitPayments = ordersWithMultiplePayments.length

      const totalSales = allPayments.reduce((sum, p) => sum + toNum(p.amount), 0)
      const totalDiscounts = paidOrders.reduce((sum, o) => sum + toNum(o.discount), 0)
      const totalTips = allPayments.reduce((sum, p) => sum + toNum(p.tipAmount), 0)
      const totalVoided = stornoOrders.reduce((sum, o) => sum + Math.abs(toNum(o.total)), 0)
      const totalOrders = paidOrders.length
      // FIX MEDIUM: Gotovinske napitnine se prištejejo k pričakovani gotovini
      const cashTips = allPayments.filter(p => p.type === 'cash').reduce((sum, p) => sum + toNum(p.tipAmount), 0)
      const expectedCash = toNum(shift.startingCash) + cashSales + cashTips
      // FIX HIGH: closingCash uporabi ?? namesto || — 0€ v blagajni je legitimna vrednost
      // Prejšnja koda je obravnavala 0 kot falsy in zamenjala z expectedCash (skrivanje kraje)
      const closingCash = data.closingCash ?? expectedCash
      const cashDifference = closingCash - expectedCash

      return await tx.cashRegisterShift.update({
        where: { id },
        data: {
          status: 'closed',
          closedAt: new Date(),
          closingCash,
          expectedCash,
          cashSales,
          cardSales,
          mobileSales,
          alternateSales,
          splitPayments,
          totalSales,
          totalOrders,
          totalDiscounts,
          // FIX MEDIUM: Vedno uporabi IZRAČUNANE napitnine iz plačil — NE dovoli ročnega prepisa
          totalTips,
          totalVoided,
          cashDifference,
          notes: data.notes || '',
        },
      })
    })

    // FIX MEDIUM: Audit log za zaprtje izmene
    await createAuditLog({
      userId: authResult.session?.employeeId,
      action: 'CLOSE_REGISTER_SHIFT',
      entityType: 'CashRegisterShift',
      entityId: id,
      details: {
        totalSales: toNum(closedShift.totalSales),
        cashSales: toNum(closedShift.cashSales),
        cardSales: toNum(closedShift.cardSales),
        cashDifference: toNum(closedShift.cashDifference),
      },
    })

    // Webhook: cash_register.closed
    emitEvent('cash_register.closed', {
      shiftId: id,
      employeeName: closedShift.employeeName || '',
      totalSales: toNum(closedShift.totalSales),
      cashDifference: toNum(closedShift.cashDifference),
    }).catch(err => logger.error('API', '[Webhook] cash_register.closed napaka:', err))

    // Webhook: daily_report.ready
    emitEvent('daily_report.ready', {
      date: new Date().toISOString().split('T')[0],
      totalSales: toNum(closedShift.totalSales),
      totalOrders: closedShift.totalOrders,
    }).catch(err => logger.error('API', '[Webhook] daily_report.ready napaka:', err))

    return NextResponse.json(deepToNumbers(closedShift))
  } catch (error: unknown) {
    return handleRouteError(error, 'PUT /api/cash-register/[id]', [
      { match: 'SHIFT_NOT_FOUND', message: 'Izmena ni najdena', status: 404 },
      { match: 'SHIFT_ALREADY_CLOSED', message: 'Izmena je že zaprta', status: 400 },
      { match: 'OPEN_ORDERS', message: 'Obstaja odprtih/neplačanih naročil. Rešite jih pred zaprtjem izmene.', status: 400, extra: (parts) => ({ openOrders: parseInt(parts[1]) || 0 }) },
    ], 'Napaka pri zapiranju izmene')
  }
}
