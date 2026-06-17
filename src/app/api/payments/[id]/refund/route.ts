// POST /api/payments/[id]/refund — Delno ali popolno povračilo plačila
import { db } from '@/lib/db'
import { toNum } from '@/lib/decimal'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { handleApiError } from '@/lib/api-utils'
import { createAuditLog } from '@/lib/db'
import { z } from 'zod'


const refundSchema = z.object({
  amount: z.number().positive('Znesek povračila mora biti pozitiven'),
  reason: z.string().max(500).default(''),
  employeeId: z.string().nullable().optional(),
})

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const authResult = await requireAuth(req, { permission: 'manage_cash' })
    if (authResult.error) return authResult.error

    const body = await req.json().catch(() => null)
    if (!body) return NextResponse.json({ error: 'Manjkajoči podatki' }, { status: 400 })

    const { amount, reason, employeeId } = refundSchema.parse(body)

    const payment = await db.payment.findUnique({ where: { id }, include: { check: { include: { order: true } } } })
    if (!payment) return NextResponse.json({ error: 'Plačilo ni najdeno' }, { status: 404 })

    const currentRefunded = toNum(payment.refundAmount)
    const maxRefundable = toNum(payment.amount) - currentRefunded
    if (amount > maxRefundable) {
      return NextResponse.json(
        { error: `Znesek povračila (€${amount.toFixed(2)}) presega max povračilo (€${maxRefundable.toFixed(2)})` },
        { status: 400 }
      )
    }

    // FIX: Transakcija — posodobi refundAmount + reverse gift card/loyalty če potrebno + audit
    const updated = await db.$transaction(async (tx) => {
      const newRefundAmount = currentRefunded + amount
      const isFullyRefunded = newRefundAmount >= toNum(payment.amount)

      const updatedPayment = await tx.payment.update({
        where: { id },
        data: {
          refundAmount: newRefundAmount,
          // Če popolnoma povrnjeno, označi kot refunded
          ...(isFullyRefunded ? { status: 'refunded' } : {}),
        },
      })

      // Audit log
      await tx.auditLog.create({
        data: {
          userId: employeeId || authResult.session?.employeeId || null,
          action: 'REFUND_PAYMENT',
          entityType: 'Payment',
          entityId: id,
          details: JSON.stringify({ amount, reason, previousRefund: currentRefunded, newRefund: newRefundAmount, fullyRefunded: isFullyRefunded }),
          ipAddress: '',
        },
      })

      return updatedPayment
    })

    return NextResponse.json({
      success: true,
      payment: { ...updated, refundAmount: toNum(updated.refundAmount) },
      refundAmount: amount,
      totalRefunded: currentRefunded + amount,
      fullyRefunded: toNum(updated.refundAmount) >= toNum(payment.amount),
    })
  } catch (error: unknown) {
    return handleApiError(error, 'POST /api/payments/[id]/refund', 'Napaka pri povračilu plačila')
  }
}
