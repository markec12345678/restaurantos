
import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { requireAuth, resolveTenantLocationIdOrThrow } from '@/lib/auth-middleware'
import { updateInventorySchema } from '@/lib/validations'
import { parseJsonBody, validateBody } from '@/lib/api-utils'
import { toNum, round2, divide, decEquals, deepToNumbers } from '@/lib/decimal'
import { handleDeleteInventory } from './_helpers'
import { setInventoryItemQuantity } from '../_helpers/stock-mutations'
import { structuredErrorResponse } from '@/lib/structured-error'
import { Prisma } from '@prisma/client'

/** R106 INV-2: race-pathi (P2002/P2034) → 409 (nikoli 500). */
function stockRaceErrorResponse(error: unknown, context: string, fallback: string): NextResponse {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    (error.code === 'P2002' || error.code === 'P2034')
  ) {
    return NextResponse.json(
      { error: 'Posodobitev zaloge je v obdelavi (sočasen dostop) — poskusite znova' },
      { status: 409 }
    )
  }
  return structuredErrorResponse(error, context, fallback)
}


export const dynamic = 'force-dynamic'

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const bodyResult = await parseJsonBody(req)
    if (bodyResult.error) return bodyResult.error

    // FIX C-05: Zahtevaj avtentikacijo
    const authResult = await requireAuth(req, { permission: 'manage_inventory' })
    if (authResult.error) return authResult.error

    // FIX H-01: Validiraj vnos z Zod
    const { data, error: validationError } = validateBody(updateInventorySchema, bodyResult.data)
    if (validationError) return validationError

    // FIX IDOR (tenant scope): findUnique → findFirst z locationId scope (cross-tenant zaščita)
    // R86-2b (M2 razred): prej raw spread `session?.locationId ?? undefined` —
    // fail-open za non-admin seja z NULL lokacijo (cross-tenant PUT/PATCH zaloge
    // + StockTransaction zapis tujega artikla). Resolver: fail-closed 403 + pin.
    const scope = resolveTenantLocationIdOrThrow(authResult.session, new URL(req.url).searchParams, {
      endpoint: 'PUT /api/inventory/[id]',
    })
    if ('error' in scope) return scope.error
    const existing = await db.inventoryItem.findFirst({
      where: { id, ...(scope.locationId ? { locationId: scope.locationId } : {}) },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Artikel zaloge ni najden' }, { status: 404 })
    }

    const costPerUnit = data.costPerUnit !== undefined ? data.costPerUnit : existing.costPerUnit
    const servingsPerUnit = data.servingsPerUnit !== undefined ? data.servingsPerUnit : existing.servingsPerUnit

    const updateData: Record<string, unknown> = {}
    if (data.name !== undefined) updateData.name = data.name
    if (data.description !== undefined) updateData.description = data.description
    if (data.image !== undefined) updateData.image = data.image
    if (data.unit !== undefined) updateData.unit = data.unit
    if (data.minQuantity !== undefined) updateData.minQuantity = data.minQuantity
    if (data.supplier !== undefined) updateData.supplier = data.supplier
    if (data.category !== undefined) updateData.category = data.category
    if (data.location !== undefined) updateData.location = data.location // FIX MEDIUM: Podpora za lokacijo
    if (data.expiryDate !== undefined) updateData.expiryDate = data.expiryDate ? new Date(data.expiryDate) : null
    if (data.menuItemId !== undefined) updateData.menuItemId = data.menuItemId || null
    if (data.servingSize !== undefined) updateData.servingSize = data.servingSize
    if (data.servingsPerUnit !== undefined) updateData.servingsPerUnit = data.servingsPerUnit
    if (data.costPerUnit !== undefined) updateData.costPerUnit = data.costPerUnit

    // Avtomatsko posodobi costPerServing
    if (data.costPerUnit !== undefined || data.servingsPerUnit !== undefined) {
      updateData.costPerServing = toNum(servingsPerUnit) > 0 ? round2(divide(costPerUnit, servingsPerUnit)) : 0
    }

    // FIX: Če se količina spreminja, ustvari transakcijski zapis
    if (data.quantity !== undefined && !decEquals(data.quantity, existing.quantity)) {
      // R106 INV-2 (HIGH, kanon R105): stale `existing` določa SAMO vstop v
      // pisalno pot — diff + absolute set sta v kanonu (setInventoryItemQuantity)
      // z tx-fresh re-read + per-item advisory lock + Serializable, tako da
      // sočasna prodaja (decrement) NE more biti tiho prepisana (prej:
      // NEPOGOJEN update({ where: { id } }) iz stale diff-a = lost update
      // + duplirana StockTransaction vrstica).
      const result = await setInventoryItemQuantity({
        inventoryItemId: id,
        sessionLocationId: scope.locationId,
        newQuantity: data.quantity,
        extraUpdate: updateData,
        reasonPositive: 'Ročna prilagoditev zaloge',
        reasonNegative: 'Ročna razknjižba zaloge',
        note: 'Posodobitev preko API',
        employeeName: authResult.session?.employeeId || '',
      })

      return NextResponse.json(deepToNumbers(result.item))
    }

    const item = await db.inventoryItem.update({
      where: { id },
      data: updateData,
      include: { menuItem: true },
    })
    return NextResponse.json(deepToNumbers(item))
  } catch (error: unknown) {
    // R106 INV-2 (error kontrakt): race-pathi → 409; strukturirani tx
    // throw-i (404) → pravi statusi.
    return stockRaceErrorResponse(error, 'PUT /api/inventory/[id]', 'Napaka pri posodobitvi zaloge')
  }
}

// FIX: PATCH method — delna posodobitev (npr. samo minQuantity ali quantity)
// Prej samo PUT, ki zahteva vse polja. PATCH omogoča posodobitev posameznih polj.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const bodyResult = await parseJsonBody(req)
    if (bodyResult.error) return bodyResult.error

    const authResult = await requireAuth(req, { permission: 'manage_inventory' })
    if (authResult.error) return authResult.error

    const { data, error: validationError } = validateBody(updateInventorySchema, bodyResult.data)
    if (validationError) return validationError

    // FIX IDOR (tenant scope): findUnique → findFirst z locationId scope (cross-tenant zaščita)
    // R86-2b (M2 razred): raw spread `?? undefined` → resolver (fail-closed 403).
    const scope = resolveTenantLocationIdOrThrow(authResult.session, new URL(req.url).searchParams, {
      endpoint: 'PATCH /api/inventory/[id]',
    })
    if ('error' in scope) return scope.error
    const existing = await db.inventoryItem.findFirst({
      where: { id, ...(scope.locationId ? { locationId: scope.locationId } : {}) },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Artikel zaloge ni najden' }, { status: 404 })
    }

    const updateData: Record<string, unknown> = {}
    if (data.name !== undefined) updateData.name = data.name
    if (data.description !== undefined) updateData.description = data.description
    if (data.image !== undefined) updateData.image = data.image
    if (data.unit !== undefined) updateData.unit = data.unit
    if (data.minQuantity !== undefined) updateData.minQuantity = data.minQuantity
    if (data.supplier !== undefined) updateData.supplier = data.supplier
    if (data.category !== undefined) updateData.category = data.category
    if (data.location !== undefined) updateData.location = data.location
    if (data.expiryDate !== undefined) updateData.expiryDate = data.expiryDate ? new Date(data.expiryDate) : null
    if (data.menuItemId !== undefined) updateData.menuItemId = data.menuItemId || null
    if (data.servingSize !== undefined) updateData.servingSize = data.servingSize
    if (data.servingsPerUnit !== undefined) updateData.servingsPerUnit = data.servingsPerUnit
    if (data.costPerUnit !== undefined) updateData.costPerUnit = data.costPerUnit

    // Avtomatsko posodobi costPerServing
    const costPerUnit = data.costPerUnit !== undefined ? data.costPerUnit : existing.costPerUnit
    const servingsPerUnit = data.servingsPerUnit !== undefined ? data.servingsPerUnit : existing.servingsPerUnit
    if (data.costPerUnit !== undefined || data.servingsPerUnit !== undefined) {
      updateData.costPerServing = toNum(servingsPerUnit) > 0 ? round2(divide(costPerUnit, servingsPerUnit)) : 0
    }

    // Če se količina spreminja, ustvari StockTransaction
    if (data.quantity !== undefined && !decEquals(data.quantity, existing.quantity)) {
      // R106 INV-2: PATCH pot — isti kanon kot PUT zgoraj (tx-fresh diff +
      // per-item lock + Serializable; absolutni set brez lost update).
      const result = await setInventoryItemQuantity({
        inventoryItemId: id,
        sessionLocationId: scope.locationId,
        newQuantity: data.quantity,
        extraUpdate: updateData,
        reasonPositive: 'Ročna prilagoditev (PATCH)',
        reasonNegative: 'Ročna razknjižba (PATCH)',
        note: 'Posodobitev preko API',
        employeeName: authResult.session?.employeeId || '',
      })
      return NextResponse.json(deepToNumbers(result.item))
    }

    const item = await db.inventoryItem.update({
      where: { id },
      data: updateData,
      include: { menuItem: true },
    })
    return NextResponse.json(deepToNumbers(item))
  } catch (error: unknown) {
    // R106 INV-2: isti error kontrakt kot PUT (race → 409, tx throwi → 404).
    return stockRaceErrorResponse(error, 'PATCH /api/inventory/[id]', 'Napaka pri delni posodobitvi zaloge')
  }
}

// FIX: Soft-delete namesto hard-delete — ohrani transakcijsko zgodovino
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return handleDeleteInventory(req, id)
}
