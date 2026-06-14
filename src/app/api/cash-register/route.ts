
// Validacija za odpiranje izmene
import { db } from '@/lib/db'
import { toNum, deepToNumbers } from '@/lib/decimal'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { z } from 'zod'
import { emitEvent } from '@/lib/event-emitter'
import { logger } from '@/lib/logger'
import { checkRateLimit, getClientIp, AUTHENTICATED_LIMIT } from '@/lib/rate-limit'
import { handleRouteError, handleApiError, validateRequest } from '@/lib/api-utils'
const openShiftSchema = z.object({
  employeeId: z.string().max(100, 'ID zaposlenega je predolg').optional(),
  employeeName: z.string().max(100, 'Ime ne sme preseči 100 znakov').default(''),
  startingCash: z.number().min(0, 'Začetna gotovina ne more biti negativna').max(9999999, 'Začetna gotovina je previsoka').default(0),
})

// GET /api/cash-register — Get current and recent shifts
export async function GET(req: Request) {
  try {
    // Rate limiting — prepreči zlorabo API-ja
    const rl = checkRateLimit('cash-register', getClientIp(req), AUTHENTICATED_LIMIT)
    if (!rl.allowed) return NextResponse.json({ error: 'Preveč zahtevkov' }, { status: 429, headers: { 'Retry-After': String(Math.ceil((rl.retryAfterMs || 60000) / 1000)) } })

    // FIX C-07: Zahtevaj avtentikacijo za blagajno
    const authResult = await requireAuth(req, { permission: 'manage_cash' })
    if (authResult.error) return authResult.error

    // FIX HIGH: Get currently open shift with location filtering
    const { searchParams } = new URL(req.url)
    const locationId = searchParams.get('locationId')
    const shiftWhere: Record<string, unknown> = { status: 'open' }
    if (locationId) shiftWhere.locationId = locationId

    const activeShift = await db.cashRegisterShift.findFirst({
      where: shiftWhere,
      orderBy: { openedAt: 'desc' },
    })

    // If there's an active shift, calculate live stats
    // FIX CRITICAL: Use ACTUAL Payment records from checks (not order.paymentMethod)
    // order.paymentMethod is a single string — doesn't account for split payments
    // Must match the same logic as close-shift for consistency
    let liveStats: Record<string, number> | null = null
    if (activeShift) {
      // OPTIMIZACIJA: Filtriraj naročila po lokaciji izmene — prepreči mešanje lokacij
      const orderWhere: Record<string, unknown> = {
        paymentStatus: { in: ['paid', 'storno'] },
        paidAt: { gte: activeShift.openedAt },
      }
      if (activeShift.locationId) {
        orderWhere.locationId = activeShift.locationId
      }

      // OPTIMIZACIJA: Pridobi plačila neposredno po tipu z groupBy — prepreči JS-side .filter().reduce()
      // Namesto nalaganja vseh plačil in filtranja v JS, uporabimo Prisma groupBy
      // za agregacijo po tipu plačila (cash, card, mobile, alternate)
      const paymentWhere = {
        status: 'completed' as const,
        check: { order: orderWhere },
      }

      const [paymentByType, totalPaymentsResult, cashTipsResult, paidOrderCount, stornoTotals, discountResult] = await Promise.all([
        // groupBy po tipu plačila — agregacija vsote zneskov
        db.payment.groupBy({
          by: ['type'],
          where: paymentWhere,
          _sum: { amount: true },
        }),
        // Skupna vsota vseh plačil
        db.payment.aggregate({
          where: paymentWhere,
          _sum: { amount: true },
        }),
        // Skupni gotovinski napitnini
        db.payment.aggregate({
          where: { ...paymentWhere, type: 'cash' },
          _sum: { tipAmount: true },
        }),
        // Število plačanih naročil (count namesto findMany)
        db.order.count({
          where: { ...orderWhere, paymentStatus: 'paid' },
        }),
        // Skupni storno znesek (aggregate namesto findMany + reduce)
        db.order.aggregate({
          where: { ...orderWhere, paymentStatus: 'storno' },
          _sum: { total: true },
        }),
        // Skupni popusti (aggregate namesto findMany + reduce)
        db.order.aggregate({
          where: { ...orderWhere, paymentStatus: 'paid' },
          _sum: { discount: true },
        }),
      ])

      // Izgradi mapo tip → vsota iz groupBy rezultata
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

      liveStats = {
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

    // Get recent closed shifts
    // FIX BUG-6 MEDIUM: Dodaj locationId filter — brez tega se prikažejo izmene vseh lokacij
    const recentShiftsWhere: Record<string, unknown> = { status: 'closed' }
    if (locationId) recentShiftsWhere.locationId = locationId
    const recentShifts = await db.cashRegisterShift.findMany({
      where: recentShiftsWhere,
      orderBy: { closedAt: 'desc' },
      take: 10,
    })

    return NextResponse.json(deepToNumbers({ activeShift, liveStats, recentShifts }))
  } catch (error: unknown) {
    return handleApiError(error, 'GET /api/cash-register', 'Napaka pri pridobivanju blagajne')
  }
}

// POST /api/cash-register — Open a new shift
export async function POST(req: Request) {
  try {
    // Rate limiting — prepreči zlorabo API-ja
    const rl = checkRateLimit('cash-register', getClientIp(req), AUTHENTICATED_LIMIT)
    if (!rl.allowed) return NextResponse.json({ error: 'Preveč zahtevkov' }, { status: 429, headers: { 'Retry-After': String(Math.ceil((rl.retryAfterMs || 60000) / 1000)) } })

    // FIX C-07: Zahtevaj avtentikacijo za odpiranje izmene
    const authResult = await requireAuth(req, { permission: 'manage_cash' })
    if (authResult.error) return authResult.error

    // FIX: Validiraj vnos z validateRequest — vključuje 1MB omejitev in sanatizacijo
    const { data, error: validationError } = await validateRequest(req, openShiftSchema)
    if (validationError) return validationError

    // FIX BUG-09: Preveri in ustvari izmeno v transakciji — prepreči race condition
    const shift = await db.$transaction(async (tx) => {
      // Preveri, da ni že odprte izmene (znotraj transakcije za atomarnost)
      // FIX MEDIUM: Upoštevaj locationId — več lokacij ima lahko vsaka svojo izmeno
      const shiftWhere: Record<string, unknown> = { status: 'open' }
      if (data.employeeId) {
        // Če je podan employeeId, poveži z lokacijo zaposlenega
        const emp = await tx.employee.findUnique({ where: { id: data.employeeId } })
        if (emp?.locationId) shiftWhere.locationId = emp.locationId
      }
      const existingShift = await tx.cashRegisterShift.findFirst({
        where: shiftWhere,
      })

      if (existingShift) {
        throw new Error('ALREADY_OPEN')
      }

      // FIX BUG-16 HIGH: employeeId je obvezen — brez identifikacije ne moremo odpreti izmene
      if (!data.employeeId) {
        throw new Error('EMPLOYEE_ID_REQUIRED')
      }

      // FIX MEDIUM: Pridobi lokacijo zaposlenega za povezavo z izmeno
      let shiftLocationId: string | null = null
      if (data.employeeId) {
        const emp = await tx.employee.findUnique({ where: { id: data.employeeId } })
        shiftLocationId = emp?.locationId || null
      }

      // FIX BUG-01 CRITICAL: Preveri začetno gotovino proti prejšnji zaprti izmeni
      // Če je bila prejšnja izmena zaprta z določeno closingCash, mora nova startingCash ustrezati
      const previousShift = await tx.cashRegisterShift.findFirst({
        where: {
          status: 'closed',
          ...(shiftLocationId ? { locationId: shiftLocationId } : {}),
        },
        orderBy: { closedAt: 'desc' },
      })
      if (previousShift && previousShift.closingCash !== undefined) {
        const tolerance = 0.01 // 1 cent tolerance za zaokroževanje
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

    // Webhook: cash_register.opened
    emitEvent('cash_register.opened', {
      shiftId: shift.id,
      employeeName: data.employeeName || '',
      startingCash: data.startingCash,
    }).catch(err => logger.error('API', '[Webhook] cash_register.opened napaka:', err))

    return NextResponse.json(deepToNumbers(shift))
  } catch (error: unknown) {
    return handleRouteError(error, 'POST /api/cash-register', [
      { match: 'ALREADY_OPEN', message: 'Že obstaja odprta izmena. Najprej zaprite trenutno izmeno.', status: 400 },
      { match: 'EMPLOYEE_ID_REQUIRED', message: 'Identifikacija zaposlenega je obvezna za odpiranje izmene.', status: 400 },
      { match: 'STARTING_CASH_MISMATCH', message: 'Začetna gotovina se ne ujema s končnim stanjem prejšnje izmene. Preverite in vnesite pravilen znesek.', status: 409, extra: (parts) => ({ expectedCash: toNum(parts[1] || '0'), actualCash: toNum(parts[2] || '0') }) },
    ], 'Napaka pri odpiranju izmene')
  }
}
