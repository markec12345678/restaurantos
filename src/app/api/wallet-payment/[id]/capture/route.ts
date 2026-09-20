// ============================================
// POST /api/wallet-payment/[id]/capture — capture authorized payment
// ============================================
import { NextResponse } from 'next/server'
import { requireAuth, resolveTenantLocationIdOrThrow } from '@/lib/auth-middleware'
import { handleApiError } from '@/lib/api-utils'
import { captureWalletPayment } from '@/lib/wallet-payment'

export const dynamic = 'force-dynamic'

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authResult = await requireAuth(req, { permission: 'manage_cash' })
    if (authResult.error) return authResult.error

    // R84-FIX2 (final-auditor H3): tenant scope — prej je bilo capture čez VSE
    // tenant-e (cross-tenant money movement). Lokacijsko vezan klicatelj sme
    // bremeti SAMO plačila svoje lokacije; super-admin globalno.
    const { searchParams } = new URL(req.url)
    const scope = resolveTenantLocationIdOrThrow(authResult.session, searchParams, {
      endpoint: 'POST /api/wallet-payment/[id]/capture',
    })
    if ('error' in scope) return scope.error

    const { id } = await params
    const result = await captureWalletPayment(id, scope.locationId)

    return NextResponse.json({ success: true, ...result })
  } catch (err) {
    return handleApiError(err, 'wallet-payment capture')
  }
}
