// ============================================
// POST /api/wallet-payment/[id]/capture — capture authorized payment
// ============================================
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { handleApiError } from '@/lib/api-utils'
import { captureWalletPayment } from '@/lib/wallet-payment'

export const dynamic = 'force-dynamic'

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authResult = await requireAuth(req, { permission: 'manage_cash' })
    if (authResult.error) return authResult.error

    const { id } = await params
    const result = await captureWalletPayment(id)

    return NextResponse.json({ success: true, ...result })
  } catch (err) {
    return handleApiError(err, 'wallet-payment capture')
  }
}
