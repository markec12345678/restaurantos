// ============================================
// POST /api/wallet-payment/[id]/refund — refund captured payment
// ============================================
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { handleApiError } from '@/lib/api-utils'
import { z } from 'zod'
import { refundWalletPayment } from '@/lib/wallet-payment'

export const dynamic = 'force-dynamic'

const refundSchema = z.object({
  amount: z.number().positive().max(10000),
})

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authResult = await requireAuth(req, { permission: 'manage_cash' })
    if (authResult.error) return authResult.error

    const { id } = await params
    const body = await req.json().catch(() => ({}))
    const { amount } = refundSchema.parse(body)

    const result = await refundWalletPayment(id, amount)

    return NextResponse.json({ success: true, ...result })
  } catch (err) {
    return handleApiError(err, 'wallet-payment refund')
  }
}
