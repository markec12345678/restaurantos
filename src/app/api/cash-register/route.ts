import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { z } from 'zod'
import { emitEvent } from '@/lib/event-emitter'

// Validacija za odpiranje izmene
const openShiftSchema = z.object({
  employeeId: z.string().optional(),
  employeeName: z.string().max(100).default(''),
  startingCash: z.number().min(0, 'Začetna gotovina ne more biti negativna').default(0),
})

// GET /api/cash-register — Get current and recent shifts
export async function GET(req: Request) {
  try {
    // FIX C-07: Zahtevaj avtentikacijo za blagajno
    const authResult = await requireAuth(req, { permission: 'manage_cash' })
    if (authResult.error) return authResult.error

    // Get currently open shift
    const activeShift = await db.cashRegisterShift.findFirst({
      where: { status: 'open' },
      orderBy: { openedAt: 'desc' },
    })

    // If there's an active shift, calculate live stats
    // FIX CRITICAL: Use ACTUAL Payment records from checks (not order.paymentMethod)
    // order.paymentMethod is a single string — doesn't account for split payments
    // Must match the same logic as close-shift for consistency
    let liveStats: Record<string, number> | null = null
    if (activeShift) {
      const paidOrders = await db.order.findMany({
        where: {
          paymentStatus: { in: ['paid', 'storno'] },
          paidAt: { gte: activeShift.openedAt },
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

      // FIX CRITICAL: Use actual payments from checks (same as close-shift logic)
      const paid = paidOrders.filter(o => o.paymentStatus === 'paid')
      const storno = paidOrders.filter(o => o.paymentStatus === 'storno')

      const allPayments = paid.flatMap(o => o.checks.flatMap(c => c.payments))
      const cashSales = allPayments.filter(p => p.type === 'cash').reduce((sum, p) => sum + p.amount, 0)
      const cardSales = allPayments.filter(p => p.type === 'card').reduce((sum, p) => sum + p.amount, 0)
      const mobileSales = allPayments.filter(p => p.type === 'mobile').reduce((sum, p) => sum + p.amount, 0)
      const alternateSales = allPayments.filter(p => ['voucher', 'loyalty', 'giftcard', 'alternate'].includes(p.type)).reduce((sum, p) => sum + p.amount, 0)
      const totalSales = allPayments.reduce((sum, p) => sum + p.amount, 0)
      const totalDiscounts = paid.reduce((sum, o) => sum + o.discount, 0)
      const totalOrders = paid.length
      const totalVoided = storno.reduce((sum, o) => sum + Math.abs(o.total), 0)
      // FIX: Cash tips included in expected cash calculation
      const cashTips = allPayments.filter(p => p.type === 'cash').reduce((sum, p) => sum + (p.tipAmount || 0), 0)
      const expectedCash = activeShift.startingCash + cashSales + cashTips

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
    const recentShifts = await db.cashRegisterShift.findMany({
      where: { status: 'closed' },
      orderBy: { closedAt: 'desc' },
      take: 10,
    })

    return NextResponse.json({ activeShift, liveStats, recentShifts })
  } catch (error) {
    console.error('Napaka pri pridobivanju blagajne:', error)
    return NextResponse.json({ error: 'Napaka pri pridobivanju blagajne' }, { status: 500 })
  }
}

// POST /api/cash-register — Open a new shift
export async function POST(req: Request) {
  try {
    // FIX C-07: Zahtevaj avtentikacijo za odpiranje izmene
    const authResult = await requireAuth(req, { permission: 'manage_cash' })
    if (authResult.error) return authResult.error

    const body = await req.json()

    // FIX: Validiraj vnos — prepreči negativno začetno gotovino
    const { data, error: validationError } = openShiftSchema.safeParse(body)
    if (validationError) {
      return NextResponse.json(
        { error: 'Neveljavni podatki', validationErrors: validationError.issues.map(e => ({ field: e.path.join('.'), message: e.message })) },
        { status: 400 }
      )
    }

    // Check if there's already an open shift
    const existingShift = await db.cashRegisterShift.findFirst({
      where: { status: 'open' },
    })

    if (existingShift) {
      return NextResponse.json(
        { error: 'Že obstaja odprta izmena. Najprej zaprite trenutno izmeno.' },
        { status: 400 }
      )
    }

    const shift = await db.cashRegisterShift.create({
      data: {
        employeeId: data.employeeId || null,
        employeeName: data.employeeName,
        startingCash: data.startingCash,
        status: 'open',
      },
    })

    // Webhook: cash_register.opened
    emitEvent('cash_register.opened', {
      shiftId: shift.id,
      employeeName: data.employeeName || '',
      startingCash: data.startingCash,
    }).catch(err => console.error('[Webhook] cash_register.opened napaka:', err))

    return NextResponse.json(shift)
  } catch (error) {
    console.error('Napaka pri odpiranju izmene:', error)
    return NextResponse.json({ error: 'Napaka pri odpiranju izmene' }, { status: 500 })
  }
}
