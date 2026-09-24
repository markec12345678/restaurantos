// ============================================
// DAILY CLOSE DETAIL — GET /api/daily-close/[id] (epic #115 P0-02, R126-a)
// ============================================
// Scoped detail dnevnega zaključka: findUnique + isWithinScope → tuja /
// neobstoječa vrstica = enak 404 (ne razkrivamo obstoja tujih zaključkov).
import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { resolveTenantLocationIdOrThrow, isWithinScope } from '@/lib/tenant-scope'
import { deepToNumbers } from '@/lib/decimal'
import { handleApiError } from '@/lib/api-utils'

export const dynamic = 'force-dynamic'

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const authResult = await requireAuth(req, { permission: 'manage_cash' })
    if (authResult.error) return authResult.error

    const { id } = await params

    // P0-C2: centralni tenant scope resolver — fail-closed, no ?locationId bypass
    const { searchParams } = new URL(req.url)
    const scope = resolveTenantLocationIdOrThrow(authResult.session, searchParams, {
      endpoint: 'GET /api/daily-close/[id]',
    })
    if ('error' in scope) return scope.error

    const close = await db.dailyClose.findUnique({ where: { id } })
    if (!close || !isWithinScope(scope.locationId, close.locationId)) {
      return NextResponse.json({ error: 'Dnevni zaključek ni najden' }, { status: 404 })
    }

    return NextResponse.json(deepToNumbers(close))
  } catch (error: unknown) {
    return handleApiError(error, 'GET /api/daily-close/[id]', 'Napaka pri pridobivanju dnevnega zaključka')
  }
}
