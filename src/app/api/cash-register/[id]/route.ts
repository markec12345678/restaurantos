import { db, createAuditLog } from '@/lib/db'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { z } from 'zod'

// FIX CRITICAL: Zod validacija za zaprtje izmene
const closeShiftSchema = z.object({
  closingCash: z.number().min(0, 'Končna gotovina ne more biti negativna').optional(),
  totalTips: z.number().min(0, 'Napitnine ne morejo biti negativne').default(0),
  notes: z.string().max(1000).default(''),
})

// PUT /api/cash-register/[id] — Close a shift
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params

    // FIX BUG 7: Zahtevaj avtentikacijo za zapiranje izmene
    const authResult = await requireAuth(req, { permission: 'manage_cash' })
    if (authResult.error) return authResult.error

    const body = await req.json()

    // FIX CRITICAL: Zod validacija za zaprtje izmene
    const { data, error: validationError } = closeShiftSchema.safeParse(body)
    if (validationError) {
      return NextResponse.json(
        { error: 'Neveljavni podatki', validationErrors: validationError.issues.map(e => ({ field: e.path.join('.'), message: e.message })) },
        { status: 400 }
      )
    }

    const shift = await db.cashRegisterShift.findUnique({ where: { id } })
    if (!shift) {
      return NextResponse.json({ error: 'Izmena ni najdena' }, { status: 404 })
    }
    if (shift.status === 'closed') {
      return NextResponse.json({ error: 'Izmena je že zaprta' }, { status: 400 })
    }

    // FIX: Izračun prihodkov in zaprtje izmene v transakciji — prepreči race condition
    // FIX CRITICAL: Uporabi ACTUAL payments iz checkov namesto order.paymentMethod
    // order.paymentMethod je samo en string — ne upošteva split plačil (več metod na eno naročilo)
    const closedShift = await db.$transaction(async (tx) => {
      const paidOrders = await tx.order.findMany({
        where: {
          paymentStatus: { in: ['paid', 'storno'] },
          // FIX MEDIUM: Include orders without paidAt if they are storno —
          // storno orders may not have paidAt set (it's only set on 'paid')
          OR: [
            { paidAt: { gte: shift.openedAt } },
            { paymentStatus: 'storno', updatedAt: { gte: shift.openedAt } },
          ],
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

      // Loči plačane in stornirane
      const paid = paidOrders.filter(o => o.paymentStatus === 'paid')
      const storno = paidOrders.filter(o => o.paymentStatus === 'storno')

      // FIX CRITICAL: Izračunaj po ACTUAL plačilih (uporabi payments iz checkov)
      const allPayments = paid.flatMap(o => o.checks.flatMap(c => c.payments))
      const cashSales = allPayments.filter(p => p.type === 'cash').reduce((sum, p) => sum + p.amount, 0)
      const cardSales = allPayments.filter(p => p.type === 'card').reduce((sum, p) => sum + p.amount, 0)
      const mobileSales = allPayments.filter(p => p.type === 'mobile').reduce((sum, p) => sum + p.amount, 0)
      const alternateSales = allPayments.filter(p => ['voucher', 'loyalty', 'giftcard', 'alternate'].includes(p.type)).reduce((sum, p) => sum + p.amount, 0)
      // Split plačila so že porazdeljena v zgornje kategorije — ne dodajaj še enkrat
      const splitPayments = 0 // TODO: implementiraj split payment tracking
      const totalSales = allPayments.reduce((sum, p) => sum + p.amount, 0)
      const totalDiscounts = paid.reduce((sum, o) => sum + o.discount, 0)
      const totalTips = allPayments.reduce((sum, p) => sum + (p.tipAmount || 0), 0)
      const totalVoided = storno.reduce((sum, o) => sum + Math.abs(o.total), 0)
      const totalOrders = paid.length
      // FIX MEDIUM: Gotovinske napitnine se prištejejo k pričakovani gotovini
      const cashTips = allPayments.filter(p => p.type === 'cash').reduce((sum, p) => sum + (p.tipAmount || 0), 0)
      const expectedCash = shift.startingCash + cashSales + cashTips
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
          totalTips: data.totalTips > 0 ? data.totalTips : totalTips,
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
        totalSales: closedShift.totalSales,
        cashSales: closedShift.cashSales,
        cardSales: closedShift.cardSales,
        cashDifference: closedShift.cashDifference,
      },
    })

    return NextResponse.json(closedShift)
  } catch (error) {
    console.error('Napaka pri zapiranju izmene:', error)
    return NextResponse.json({ error: 'Napaka pri zapiranju izmene' }, { status: 500 })
  }
}
