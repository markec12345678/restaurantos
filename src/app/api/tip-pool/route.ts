// ============================================
// TIP POOL API — Razdelitev napitnin
// Toast POS standard — equal, hours, points, manual
// ============================================

import { db } from '@/lib/db'
import { deepToNumbers } from '@/lib/decimal'
import { NextResponse } from 'next/server'
import { requireAuth, resolveTenantLocationId, tenantScopeToWhere } from '@/lib/auth-middleware'
import { handleApiError, validateRequest } from '@/lib/api-utils'
import {

  createTipPoolSchema,
  calculateDistributions,
  calculateHours,
  fetchDayPayments,
  persistTipPoolWithDistributions,
  handlePutTipPool,
} from './_helpers'

// FIX R81-G (LEAK-MEDIUM): inline role-aware fail-closed gate (zrcali
// resolveCatalogScope semantiko; inventory/adjust R81-F vzorec — brez
// tenant-scope helperjev za role check). Non-admin BREZ session.locationId
// = 403 (data integrity issue), ker ne moremo izpeljati scope-a.
function requireLocationScope(
  authResult: { session?: { role?: string; locationId?: string | null } | null },
): { sessionLocId: string | null } | { error: NextResponse } {
  const session = authResult.session
  const sessionLocId = session?.locationId ?? null
  const isRoleAdmin = session?.role === 'admin' || session?.role === 'super_admin'
  if (!sessionLocId && !isRoleAdmin) {
    return {
      error: NextResponse.json(
        { error: 'Vaš račun nima dodeljene lokacije. Kontaktirajte administratorja.' },
        { status: 403 },
      ),
    }
  }
  return { sessionLocId }
}

// GET — Pridobi tip poole
export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  try {
    const authResult = await requireAuth(req, { permission: 'manage_employees' })
    if (authResult.error) return authResult.error

    const { searchParams } = new URL(req.url)
    const date = searchParams.get('date')
    const status = searchParams.get('status')

    // FIX P0-C2: Centralni tenant scope resolver — fail-closed, no ?locationId bypass
    const scope = resolveTenantLocationId(authResult.session, searchParams, {
      endpoint: 'GET /api/tip-pool',
    })
    if (!scope.ok) return scope.error

    const where: Record<string, unknown> = {
      ...tenantScopeToWhere(scope),
    }
    if (date) {
      const d = new Date(date)
      const start = new Date(d.getFullYear(), d.getMonth(), d.getDate())
      const end = new Date(start.getTime() + 86400000)
      where.date = { gte: start, lt: end }
    }
    if (status) where.status = status

    const pools = await db.tipPool.findMany({
      where,
      include: { distributions: true },
      orderBy: { date: 'desc' },
      take: 30,
    })

    return NextResponse.json(deepToNumbers(pools))
  } catch (error: unknown) {
    return handleApiError(error, 'GET /api/tip-pool', 'Napaka pri pridobivanju napitnin')
  }
}

// POST — Ustvari tip pool za dan
export async function POST(req: Request) {
  try {
    const authResult = await requireAuth(req, { permission: 'manage_employees' })
    if (authResult.error) return authResult.error

    // FIX R81-G (LEAK-MEDIUM): scope gate (403) PRED validacijo/db
    const scope = requireLocationScope(authResult)
    if ('error' in scope) return scope.error
    const sessionLocId = scope.sessionLocId

    const { data, error: validationError } = await validateRequest(req, createTipPoolSchema)
    if (validationError) return validationError

    const { date, distributionMethod, locationId } = data

    // FIX R81-G (LEAK-MEDIUM): body locationId je STRIPPAN za lokacijsko vezane
    // seje (seja je avtoritativna — nikoli pool/distribucija na tuji lokaciji);
    // super-admin (brez session lokacije) sme podati izrecen locationId.
    const effectiveLocationId: string | undefined = sessionLocId || locationId || undefined

    const d = new Date(date)
    const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate())
    const dayEnd = new Date(dayStart.getTime() + 86400000)

    // Preveri če že obstaja
    const existing = await db.tipPool.findFirst({
      where: { date: dayStart, ...(effectiveLocationId ? { locationId: effectiveLocationId } : {}) },
    })
    if (existing && existing.status === 'paid') {
      return NextResponse.json({ error: 'Tip pool za ta dan je že izplačan' }, { status: 400 })
    }

    // Pridobi napitnine iz plačil za ta dan
    const { totalTips, cashTips, cardTips } = await fetchDayPayments(dayStart, dayEnd, effectiveLocationId)

    // Pridobi zaposlene, ki so delali ta dan
    // FIX R81-G (LEAK-MEDIUM, cross-tenant): findMany je bil brez lokacijskega
    // filtra — distribucije so vključevale izmene VSEH lokacij.
    // StaffShift.locationId je nullable (NULL = fail-closed za lokacijsko vezane
    // seje); super-admin = globalni pogled.
    // ISSUE #36 R125: legacy Shift model ukinjen — branje iz StaffShift.
    const shifts = await db.staffShift.findMany({
      where: {
        shiftDate: { gte: dayStart, lt: dayEnd },
        status: { in: ['completed', 'in_progress'] },
        ...(sessionLocId ? { locationId: sessionLocId } : {}),
      },
      include: { employee: true },
    })

    const employees = shifts.map(s => ({
      employeeId: s.employeeId,
      employeeName: s.employee.name,
      hoursWorked: calculateHours(s.startTime, s.endTime),
      points: 1,
    }))

    if (employees.length === 0) {
      return NextResponse.json({ error: 'Ni zaposlenih, ki so delali ta dan' }, { status: 400 })
    }

    // Izračunaj distribucijo
    const distributions = calculateDistributions(distributionMethod, employees, totalTips)

    // Upsert tip pool + distribucije
    const poolId = await persistTipPoolWithDistributions(
      existing,
      { date: dayStart, totalTips, cashTips, cardTips, distributionMethod, status: 'pending', locationId: effectiveLocationId || null },
      distributions
    )

    const result = await db.tipPool.findUnique({
      where: { id: poolId },
      include: { distributions: true },
    })

    return NextResponse.json(deepToNumbers(result), { status: existing ? 200 : 201 })
  } catch (error: unknown) {
    return handleApiError(error, 'POST /api/tip-pool', 'Napaka pri ustvarjanju tip poola')
  }
}

// PUT — Posodobi distribucijo / odobri
export async function PUT(req: Request) {
  try {
    const authResult = await requireAuth(req, { permission: 'manage_employees' })
    if (authResult.error) return authResult.error

    // FIX R81-G: session locationId se preda v handler (scope check na TipPool.locationId)
    return await handlePutTipPool(
      req,
      authResult as { session?: { employeeId?: string; locationId?: string | null } | null },
    )
  } catch (error: unknown) {
    return handleApiError(error, 'PUT /api/tip-pool', 'Napaka pri posodabljanju napitnin')
  }
}
