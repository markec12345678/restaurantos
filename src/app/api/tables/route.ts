
import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { deepToNumbers } from '@/lib/decimal'
import { requireAuth, resolveTenantLocationIdOrThrow } from '@/lib/auth-middleware'
import { createTableSchema } from '@/lib/validations'
import { handleApiError, validateRequest } from '@/lib/api-utils'
import { withETag } from '@/lib/middleware/cache-headers'
import { resolveCatalogScope, resolveWriteLocationId } from '@/lib/tenant-scope'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  try {
    // FIX: Zahtevaj avtentikacijo za branje miz
    const authResult = await requireAuth(req, { permission: 'take_orders' })
    if (authResult.error) return authResult.error

    // FIX Test 7.2 + R76 (centralizacija): centralni tenant scope namesto ročnega pogoja
    // (fail-open: session.locationId=null → globalni seznam miz vseh tenantov).
    const scope = resolveTenantLocationIdOrThrow(authResult.session, null, {
      endpoint: 'GET /api/tables',
    })
    if ('error' in scope) return scope.error
    const tableWhere: Record<string, unknown> = {}
    if (scope.locationId) {
      tableWhere.locationId = scope.locationId
    }

    const tables = await db.table.findMany({
      where: tableWhere,
      orderBy: { number: 'asc' },
      include: { orders: { where: { status: { in: ['pending', 'in-progress', 'ready'] } }, take: 1 } },
    })
    const responseBody = deepToNumbers(tables)
    // FIX P15: ETag za tables — mize se redko spreminjajo
    return withETag(req, NextResponse.json(responseBody), responseBody)
  } catch (error: unknown) {
    return handleApiError(error, 'GET /api/tables', 'Napaka pri pridobivanju miz')
  }
}

export async function POST(req: Request) {
  try {
    // Auth check
    const authResult = await requireAuth(req)
    if (authResult.error) return authResult.error

    // FIX SECURITY: validateRequest() prepreči DoS z oversized payload — omeji body na 1 MB
    // Prej: req.json() + validateBody() — brez omejitve velikosti, ranljivo za DoS
    const { data, error: validationError } = await validateRequest(req, createTableSchema)
    if (validationError) return validationError

    // MODEL A: Table.locationId je NOT NULL — lokacija iz seje (zaposleni) ali
    // izrecno ?locationId= (admin). Brez obeh = 400 (miza brez lokacije je bila
    // prej nevidna za scoped poizvedbe, a je order-resolucija vrstila naročila vanjo).
    const { searchParams } = new URL(req.url)
    const scopeRes = resolveCatalogScope(authResult)
    if (!scopeRes.ok) return scopeRes.response
    const loc = resolveWriteLocationId(scopeRes.scope, searchParams.get('locationId'))
    if (!loc.ok) return loc.response

    const table = await db.table.create({
      data: {
        number: data.number,
        capacity: data.capacity,
        status: data.status,
        area: data.area,
        locationId: loc.locationId,
        // FIX HIGH: Vizualni tloris — uporabi Zod-validirane vrednosti namesto direktnega body-ja
        posX: data.posX ?? Math.random() * 70 + 5,
        posY: data.posY ?? Math.random() * 70 + 5,
        width: data.width ?? 8,
        height: data.height ?? 10,
        shape: data.shape ?? 'round',
        rotation: data.rotation ?? 0,
      },
    })
    return NextResponse.json(table, { status: 201 })
  } catch (error: unknown) {
    // SQLite unique constraint violation
    if (typeof error === 'object' && error !== null && 'code' in error && (error as { code: string }).code === 'P2002') {
      return NextResponse.json(
        { error: `Miza s to številko že obstaja` },
        { status: 409 }
      )
    }
    return handleApiError(error, 'POST /api/tables', 'Napaka pri ustvarjanju mize')
  }
}
