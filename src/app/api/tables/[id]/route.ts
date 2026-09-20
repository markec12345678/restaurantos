
import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { deepToNumbers } from '@/lib/decimal'
import { requireAuth } from '@/lib/auth-middleware'
import { resolveTenantLocationIdOrThrow } from '@/lib/tenant-scope'
import { updateTableSchema } from '@/lib/validations'
import { parseJsonBody, handleApiError, validateBody } from '@/lib/api-utils'

export const dynamic = 'force-dynamic'

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params

    // Auth check
    const authResult = await requireAuth(req)
    if (authResult.error) return authResult.error

    // FIX R86-2c1 (M2): raw spread `session?.locationId ?? undefined` je bil
    // FAIL-OPEN za non-admin sejo z NULL lokacijo (session-lifecycle.ts:114-117
    // sprejme null za vsako vlogo) — prazen filter = cross-tenant update mize.
    // Zdaj: centralni resolver — regular user brez lokacije → 403 fail-closed;
    // super-admin (null) = globalni pogled.
    const scope = resolveTenantLocationIdOrThrow(authResult.session, new URL(req.url).searchParams, {
      endpoint: 'PUT /api/tables/[id]',
    })
    if ('error' in scope) return scope.error

    const bodyResult = await parseJsonBody(req)
    if (bodyResult.error) return bodyResult.error

    // FIX H-01: Validiraj vnos z Zod
    const { data, error: validationError } = validateBody(updateTableSchema, bodyResult.data)
    if (validationError) return validationError

    // Preveri, da miza obstaja (FIX IDOR: findUnique → findFirst z locationId scope)
    const existing = await db.table.findFirst({
      where: { id, ...(scope.locationId ? { locationId: scope.locationId } : {}) },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Miza ni najdena' }, { status: 404 })
    }

    const table = await db.table.update({
      where: { id },
      data: {
        ...(data.number !== undefined && { number: data.number }),
        ...(data.capacity !== undefined && { capacity: data.capacity }),
        ...(data.status !== undefined && { status: data.status }),
        ...(data.area !== undefined && { area: data.area }),
        // FIX BUG-01 HIGH: Vizualni tloris — uporabljaj validirane podatke iz Zod (data), ne raw body
        ...(data.posX !== undefined && { posX: data.posX }),
        ...(data.posY !== undefined && { posY: data.posY }),
        ...(data.width !== undefined && { width: data.width }),
        ...(data.height !== undefined && { height: data.height }),
        ...(data.shape !== undefined && { shape: data.shape }),
        ...(data.rotation !== undefined && { rotation: data.rotation }),
      },
    })
    return NextResponse.json(deepToNumbers(table))
  } catch (error: unknown) {
    if (typeof error === 'object' && error !== null && 'code' in error && (error as { code: string }).code === 'P2002') {
      return NextResponse.json(
        { error: 'Miza s to številko že obstaja' },
        { status: 409 }
      )
    }
    return handleApiError(error, 'PUT /api/tables/[id]', 'Napaka pri posodobitvi mize')
  }
}

// FIX H-06: Soft-delete z preverjanjem aktivnih naročil
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params

    // FIX C-05: Zahtevaj avtentikacijo
    const authResult = await requireAuth(req, { permission: 'take_orders' })
    if (authResult.error) return authResult.error

    // FIX R86-2c1 (M2): isti raw-spread fail-open kot PUT — cross-tenant hard
    // DELETE mize. Zdaj: resolver (regular NULL → 403; super-admin globalni).
    const scope = resolveTenantLocationIdOrThrow(authResult.session, new URL(req.url).searchParams, {
      endpoint: 'DELETE /api/tables/[id]',
    })
    if ('error' in scope) return scope.error

    // FIX IDOR (tenant scope): findUnique → findFirst z locationId scope (cross-tenant zaščita)
    const table = await db.table.findFirst({
      where: { id, ...(scope.locationId ? { locationId: scope.locationId } : {}) },
      include: { orders: { where: { status: { in: ['pending', 'in-progress', 'ready'] } } } },
    })

    if (!table) {
      return NextResponse.json({ error: 'Miza ni najdena' }, { status: 404 })
    }

    // Preveri, da nima aktivnih naročil
    if (table.orders.length > 0) {
      return NextResponse.json(
        { error: 'Miza ima aktivna naročila — je ni mogoče izbrisati. Najprej zaključite ali prekličite naročila.' },
        { status: 400 }
      )
    }

    // Hard-delete je varen, ker ni aktivnih naročil
    await db.table.delete({ where: { id } })

    return NextResponse.json({ success: true, message: 'Miza izbrisana' })
  } catch (error: unknown) {
    return handleApiError(error, 'DELETE /api/tables/[id]', 'Napaka pri brisanju mize')
  }
}
