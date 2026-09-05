// GET /api/accounting/trial-balance — trial balance (seštevek debet/kredit po kontih)
import { NextResponse } from 'next/server'
import { requireAuth, resolveTenantLocationId } from '@/lib/auth-middleware'
import { handleApiError } from '@/lib/api-utils'
import { generateTrialBalance } from '@/lib/accounting/journal-generator'


export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  try {
    const authResult = await requireAuth(req, { permission: 'view_reports' })
    if (authResult.error) return authResult.error

    const { searchParams } = new URL(req.url)
    const dateFrom = searchParams.get('dateFrom')
    const dateTo = searchParams.get('dateTo')
    // FIX P0-C2: Centralni tenant scope resolver — fail-closed, no ?locationId bypass
    const scope = resolveTenantLocationId(authResult.session, searchParams, {
      endpoint: 'GET /api/accounting/trial-balance',
    })
    if (!scope.ok) return scope.error

    const result = await generateTrialBalance(
      dateFrom ? new Date(dateFrom) : undefined,
      dateTo ? new Date(dateTo + 'T23:59:59') : undefined,
      scope.locationId ?? undefined,
    )

    return NextResponse.json(result)
  } catch (error: unknown) {
    return handleApiError(error, 'GET /api/accounting/trial-balance', 'Napaka pri pridobivanju bruto bilance')
  }
}
