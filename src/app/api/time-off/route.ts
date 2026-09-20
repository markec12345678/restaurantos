// ============================================
// /api/time-off — CRUD za prošnje za dopust
// ============================================
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth, resolveTenantLocationIdOrThrow } from '@/lib/auth-middleware'
import { handleApiError } from '@/lib/api-utils'
import { isWithinScope, notInScopeResponse } from '@/lib/tenant-scope'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const createSchema = z.object({
  employeeId: z.string().min(1).max(100),
  type: z.enum(['vacation', 'sick', 'personal', 'holiday', 'unpaid']).default('vacation'),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  reason: z.string().max(500).default(''),
})

// GET — pridobi prošnje (filter po employeeId, status, datum)
export async function GET(req: Request) {
  try {
    const authResult = await requireAuth(req, { permission: 'view_reports' })
    if (authResult.error) return authResult.error

    // FIX R85-4b MEDIUM: Tenant scope — TimeOffRequest NIMA lastnega locationId
    // (schema.prisma:1659), scope se izpelje prek employee.locationId. Prej je
    // findMany zajel prošnje VSEH tenantov. Fail-closed za regular uporabnika
    // brez lokacije; null scope (super-admin) = globalni pogled (nikoli
    // { employee: { locationId: null } }).
    const { searchParams } = new URL(req.url)
    const scope = resolveTenantLocationIdOrThrow(authResult.session, searchParams, {
      endpoint: 'GET /api/time-off',
    })
    if ('error' in scope) return scope.error

    const employeeId = searchParams.get('employeeId')
    const status = searchParams.get('status')
    const upcoming = searchParams.get('upcoming') === '1'

    const where: Record<string, unknown> = {
      // R85: tenant filter prek izpeljane verige Employee.locationId
      // (null scope = PRAZEN filter, nikoli { locationId: null })
      ...(scope.locationId ? { employee: { locationId: scope.locationId } } : {}),
    }
    if (employeeId) where.employeeId = employeeId
    if (status) where.status = status
    if (upcoming) where.endDate = { gte: new Date() }

    const requests = await db.timeOffRequest.findMany({
      where,
      include: { employee: { select: { id: true, name: true } } },
      orderBy: { startDate: 'desc' },
    })

    return NextResponse.json({ requests })
  } catch (err) {
    return handleApiError(err, 'time-off GET')
  }
}

// POST — kreiraj prošnjo
export async function POST(req: Request) {
  try {
    const authResult = await requireAuth(req, { permission: 'manage_employees' })
    if (authResult.error) return authResult.error

    // FIX R85-4b MEDIUM: tenant scope — model NIMA locationId, zato žig ne obstaja;
    // namesto tega lastniški guard nad employeeId (tuji zaposleni → 404).
    const scope = resolveTenantLocationIdOrThrow(authResult.session, new URLSearchParams(), {
      endpoint: 'POST /api/time-off',
    })
    if ('error' in scope) return scope.error

    const body = await req.json().catch(() => ({}))
    const input = createSchema.parse(body)

    // Validacija: endDate >= startDate
    const start = new Date(input.startDate)
    const end = new Date(input.endDate)
    if (end < start) {
      return NextResponse.json({ error: 'endDate mora biti po startDate' }, { status: 400 })
    }

    // R85: ownership guard — zaposleni mora obstajati in ležati v scope-u
    // (izpeljano prek Employee.locationId; legacy NULL lokacija je za
    // lokacijsko vezanega admina zavrnjena — fail-closed).
    const employee = await db.employee.findUnique({
      where: { id: input.employeeId },
      select: { id: true, locationId: true },
    })
    if (!employee || !isWithinScope(scope.locationId, employee.locationId)) {
      return notInScopeResponse('Zaposleni')
    }

    const request = await db.timeOffRequest.create({
      data: {
        employeeId: input.employeeId,
        type: input.type,
        startDate: start,
        endDate: end,
        reason: input.reason,
        status: 'pending',
      },
      include: { employee: { select: { id: true, name: true } } },
    })

    return NextResponse.json({ success: true, request })
  } catch (err) {
    return handleApiError(err, 'time-off POST')
  }
}
