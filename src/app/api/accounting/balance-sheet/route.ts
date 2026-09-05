// GET /api/accounting/balance-sheet
import { NextResponse } from 'next/server'
import { requireAuth, resolveTenantLocationId } from '@/lib/auth-middleware'
import { handleApiError } from '@/lib/api-utils'
import { generateBalanceSheet } from '@/lib/accounting/journal-generator'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  try {
    const authResult = await requireAuth(req, { permission: 'view_reports' })
    if (authResult.error) return authResult.error

    const { searchParams } = new URL(req.url)
    const dateTo = searchParams.get('dateTo')
    // FIX P0-C2: Centralni tenant scope resolver — fail-closed, no ?locationId bypass
    const scope = resolveTenantLocationId(authResult.session, searchParams, {
      endpoint: 'GET /api/accounting/balance-sheet',
    })
    if (!scope.ok) return scope.error

    const result = await generateBalanceSheet(
      dateTo ? new Date(dateTo + 'T23:59:59') : undefined,
      scope.locationId ?? undefined,
    )

    return NextResponse.json(result)
  } catch (error: unknown) {
    return handleApiError(error, 'GET /api/accounting/balance-sheet', 'Napaka pri pridobivanju poročila')
  }
}
