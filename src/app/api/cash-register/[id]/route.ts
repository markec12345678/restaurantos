import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'

// PUT /api/cash-register/[id] — Close a shift
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params

    // FIX BUG 7: Zahtevaj avtentikacijo za zapiranje izmene
    const authResult = await requireAuth(req, { permission: 'manage_cash' })
    if (authResult.error) return authResult.error

    const body = await req.json()

    const shift = await db.cashRegisterShift.findUnique({ where: { id } })
    if (!shift) {
      return NextResponse.json({ error: 'Izmena ni najdena' }, { status: 404 })
    }
    if (shift.status === 'closed') {
      return NextResponse.json({ error: 'Izmena je že zaprta' }, { status: 400 })
    }

    // FIX: Izračun prihodkov in zaprtje izmene v transakciji — prepreči race condition
    const closedShift = await db.$transaction(async (tx) => {
      const paidOrders = await tx.order.findMany({
        where: {
          paymentStatus: { in: ['paid', 'storno'] },
          paidAt: { gte: shift.openedAt },
        },
        select: {
          total: true,
          discount: true,
          paymentMethod: true,
          paymentStatus: true,
        },
      })

      // Loči plačane in stornirane
      const paid = paidOrders.filter(o => o.paymentStatus === 'paid')
      const storno = paidOrders.filter(o => o.paymentStatus === 'storno')

      const cashSales = paid.filter(o => o.paymentMethod === 'cash').reduce((sum, o) => sum + o.total, 0)
      const cardSales = paid.filter(o => o.paymentMethod === 'card').reduce((sum, o) => sum + o.total, 0)
      const mobileSales = paid.filter(o => o.paymentMethod === 'mobile').reduce((sum, o) => sum + o.total, 0)
      const alternateSales = paid.filter(o => ['voucher', 'loyalty', 'giftcard', 'alternate'].includes(o.paymentMethod)).reduce((sum, o) => sum + o.total, 0)
      const splitPayments = paid.filter(o => o.paymentMethod === 'split').reduce((sum, o) => sum + o.total, 0)
      const totalSales = paid.reduce((sum, o) => sum + o.total, 0)
      const totalDiscounts = paid.reduce((sum, o) => sum + o.discount, 0)
      const totalVoided = storno.reduce((sum, o) => sum + Math.abs(o.total), 0)
      const totalOrders = paid.length
      const expectedCash = shift.startingCash + cashSales
      const closingCash = body.closingCash ?? expectedCash
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
          totalTips: body.totalTips || 0,
          totalVoided,
          cashDifference,
          notes: body.notes || '',
        },
      })
    })

    return NextResponse.json(closedShift)
  } catch (error) {
    console.error('Napaka pri zapiranju izmene:', error)
    return NextResponse.json({ error: 'Napaka pri zapiranju izmene' }, { status: 500 })
  }
}
