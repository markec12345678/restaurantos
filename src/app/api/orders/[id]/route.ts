
// PUT / PATCH / DELETE /api/orders/[id]
import { NextResponse } from 'next/server'
import { deepToNumbers } from '@/lib/decimal'
import { requireAuth } from '@/lib/auth-middleware'
import { orderPatchActionSchema } from '@/lib/validations'
import { parseJsonBody, handleApiError, validateBody } from '@/lib/api-utils'
import { resolveTenantLocationIdOrThrow } from '@/lib/tenant-scope'
import { db } from '@/lib/db'
import { handlePutOrder } from './_helpers'
import { handleFireAction, handleItemStatusUpdate, performOrderSoftDelete } from './webhooks'


export const dynamic = 'force-dynamic'

// FIX Bug #2: Dodan GET method — prej samo PUT/PATCH/DELETE (405 za GET)
// FIX P0-C1 (IDOR): findUnique → findFirst z locationId scope (cross-tenant zaščita)
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authResult = await requireAuth(req, { permission: 'take_orders' })
    if (authResult.error) return authResult.error

    const { id } = await params
    // FIX R86-2a (M2 fail-open): raw `session?.locationId ?? undefined` je regularno
    // sejo z NULL locationId pustil do GLOBALNEGA findFirst (session-store sprejme
    // null lokacijo za KATEROKOLI vlogo). Centralni resolver: fail-closed 403.
    const { searchParams } = new URL(req.url)
    const scope = resolveTenantLocationIdOrThrow(authResult.session, searchParams, {
      endpoint: 'GET /api/orders/[id]',
    })
    if ('error' in scope) return scope.error
    const order = await db.order.findFirst({
      where: { id, ...(scope.locationId ? { locationId: scope.locationId } : {}) },
      include: {
        table: true,
        orderItems: {
          include: {
            menuItem: { include: { category: { include: { menu: true } } } },
          },
        },
      },
    })
    if (!order) return NextResponse.json({ error: 'Naročilo ni najdeno' }, { status: 404 })
    return NextResponse.json(deepToNumbers(order))
  } catch (error: unknown) {
    return handleApiError(error, 'GET /api/orders/[id]', 'Napaka pri pridobivanju naročila')
  }
}

// PUT — Posodobi naročilo (status, paymentStatus, itd.)
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handlePutOrder(req, params)
}

// PATCH — Item status posodobitve (KDS + Natakar)
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params

    const authResult = await requireAuth(req, { permission: 'take_orders' })
    if (authResult.error) return authResult.error

    // FIX R87-4 (higiena, R86-FINAL-AUDIT LOW #3): scope resolver TAKOJ za
    // requireAuth, PRED body parse (kanon: tables/merge, webhooks, purchase-orders).
    // FIX R86-2a (M2 fail-open): scope iz centralnega resolverja (prej raw spread)
    const { searchParams } = new URL(req.url)
    const scope = resolveTenantLocationIdOrThrow(authResult.session, searchParams, {
      endpoint: 'PATCH /api/orders/[id]',
    })
    if ('error' in scope) return scope.error

    const bodyResult = await parseJsonBody(req)
    if (bodyResult.error) return bodyResult.error

    const { data: patchData, error: patchError } = validateBody(orderPatchActionSchema, bodyResult.data)
    if (patchError) return patchError

    if (patchData.action === 'item_status') {
      const { itemId, status } = patchData
      // FIX P0-C1 (IDOR): findUnique → findFirst z locationId scope (cross-tenant zaščita)
      const order = await db.order.findFirst({
        where: { id, ...(scope.locationId ? { locationId: scope.locationId } : {}) },
      })
      if (!order) return NextResponse.json({ error: 'Naročilo ni najdeno' }, { status: 404 })

      const result = await handleItemStatusUpdate(id, itemId, status, order)
      if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.status })
      return NextResponse.json(deepToNumbers(result))
    }

    if (patchData.action === 'fire') {
      // FIX P0-C1 (IDOR): Preveri locationId scope pred fire akcijo
      const orderForFire = await db.order.findFirst({
        where: { id, ...(scope.locationId ? { locationId: scope.locationId } : {}) },
        select: { id: true },
      })
      if (!orderForFire) return NextResponse.json({ error: 'Naročilo ni najdeno' }, { status: 404 })
      return await handleFireAction(id)
    }

    return NextResponse.json({ error: 'Neznana akcija' }, { status: 400 })
  } catch (error: unknown) {
    return handleApiError(error, 'PATCH /api/orders/[id]', 'Napaka pri posodobitvi')
  }
}

// DELETE — Soft delete
// FIX P0-C1 (IDOR): findUnique → findFirst z locationId scope (cross-tenant zaščita)
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params

    const authResult = await requireAuth(req, { permission: 'take_orders' })
    if (authResult.error) return authResult.error

    // FIX R86-2a (M2 fail-open): centralni resolver namesto raw spread-a
    const { searchParams } = new URL(req.url)
    const scope = resolveTenantLocationIdOrThrow(authResult.session, searchParams, {
      endpoint: 'DELETE /api/orders/[id]',
    })
    if ('error' in scope) return scope.error
    const order = await db.order.findFirst({
      where: { id, ...(scope.locationId ? { locationId: scope.locationId } : {}) },
      include: { receipt: true },
    })

    if (!order) {
      return NextResponse.json({ error: 'Naročilo ni najdeno' }, { status: 404 })
    }

    if (order.status === 'completed') {
      return NextResponse.json({ error: 'Zaključenega naročila ni mogoče izbrisati. Uporabite storno postopek.' }, { status: 400 })
    }

    if (order.status === 'cancelled') {
      return NextResponse.json({ error: 'Naročilo je že preklicano' }, { status: 400 })
    }

    // FIX R112-A (ORD-4): performOrderSoftDelete je zdaj avtoritativni kanon
    // (Serializable tx + advisory lock 'order-write:{id}' + tx-fresh guardi +
    // CAS) — stale guardi zgoraj ostanejo kot hitri UX fast-path, odločitev je
    // tx-fresh. Strukturiran { ok, reason } rezultat → pravi 404/400/409
    // (plačano naročilo = 409 storno pot; prej: race z plačilom je lahko
    // PREKLICAL plačano naročilo).
    const result = await performOrderSoftDelete(id, order, authResult.session?.employeeId)
    if (!result.ok) {
      const responses: Record<string, { error: string; status: number }> = {
        not_found: { error: 'Naročilo ni najdeno', status: 404 },
        already_cancelled: { error: 'Naročilo je že preklicano', status: 400 },
        completed: { error: 'Zaključenega naročila ni mogoče izbrisati. Uporabite storno postopek.', status: 400 },
        paid: { error: 'Naročilo je plačano — uporabite storno/povračilo postopek.', status: 409 },
        conflict: { error: 'Naročilo je v obdelavi (sočasna sprememba) — osvežite in poskusite znova.', status: 409 },
      }
      const mapped = responses[result.reason]
      return NextResponse.json({ error: mapped.error }, { status: mapped.status })
    }

    return NextResponse.json({ success: true, action: 'soft-delete', message: 'Naročilo preklicano' })
  } catch (error: unknown) {
    return handleApiError(error, 'DELETE /api/orders/[id]', 'Napaka pri brisanju naročila')
  }
}
