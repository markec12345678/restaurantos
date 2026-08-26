// GET /api/accounting/profit-loss
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { handleApiError } from '@/lib/api-utils'
import { generateProfitLoss } from '@/lib/accounting/journal-generator'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  try {
    const authResult = await requireAuth(req, { permission: 'view_reports' })
    if (authResult.error) return authResult.error

    const { searchParams } = new URL(req.url)
    const dateFrom = searchParams.get('dateFrom')
    const dateTo = searchParams.get('dateTo')

    const result = await generateProfitLoss(
      dateFrom ? new Date(dateFrom) : undefined,
      dateTo ? new Date(dateTo + 'T23:59:59') : undefined
    )

    return NextResponse.json(result)
  } catch (error: unknown) {
    return handleApiError(error, 'GET /api/accounting/profit-loss', 'Napaka pri pridobivanju poročila')
  }
}
