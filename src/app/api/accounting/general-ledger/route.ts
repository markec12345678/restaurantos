// GET /api/accounting/general-ledger
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { resolveTenantLocationId } from '@/lib/auth-middleware/tenant-scope'
import { handleApiError } from '@/lib/api-utils'
import { generateGeneralLedger } from '@/lib/accounting/journal-generator'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  try {
    const authResult = await requireAuth(req, { permission: 'view_reports' })
    if (authResult.error) return authResult.error

    const { searchParams } = new URL(req.url)
    const dateFrom = searchParams.get('dateFrom')
    const dateTo = searchParams.get('dateTo')
    // ISSUE #31: opcijsko filtriranje po lokaciji za multi-tenant accounting
    const locationId = resolveTenantLocationId(authResult, searchParams)

    const result = await generateGeneralLedger(
      dateFrom ? new Date(dateFrom) : undefined,
      dateTo ? new Date(dateTo + 'T23:59:59') : undefined,
      locationId || undefined,
    )

    return NextResponse.json(result)
  } catch (error: unknown) {
    return handleApiError(error, 'GET /api/accounting/general-ledger', 'Napaka pri pridobivanju poročila')
  }
}
