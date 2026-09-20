// POST /api/inventory/restock — Vnos nabave (prevzem blaga v zalogo)
import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { deepToNumbers } from '@/lib/decimal'
import { requireAuth } from '@/lib/auth-middleware'
import { inventoryRestockSchema } from '@/lib/validations'
import { toNum, round2, multiply, divide, isPositive } from '@/lib/decimal'
import { handleApiError, parseJsonBody, validateBody } from '@/lib/api-utils'
import { notInScopeResponse } from '@/lib/tenant-scope'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  try {
    // FIX BUG 10: Zahtevaj avtentikacijo za restock
    const authResult = await requireAuth(req, { permission: 'manage_inventory' })
    if (authResult.error) return authResult.error
    // FIX R81-F (LEAK-HIGH): inline role-aware fail-closed gate (zrcali
    // resolveCatalogScope semantiko; subscription platformAdminGate stil) —
    // non-admin brez session.locationId = 403, ker scope-a ni mogoče izpeljati.
    const session = authResult.session
    const sessionLocId = session?.locationId ?? null
    const isRoleAdmin = session?.role === 'admin' || session?.role === 'super_admin'
    if (!sessionLocId && !isRoleAdmin) {
      return NextResponse.json(
        { error: 'Vaš račun nima dodeljene lokacije. Kontaktirajte administratorja.' },
        { status: 403 },
      )
    }
    const bodyResult = await parseJsonBody(req)
    if (bodyResult.error) return bodyResult.error
    // FIX BUG 10: Zod validacija
    const { data, error: validationError } = validateBody(inventoryRestockSchema, bodyResult.data)
    if (validationError) return validationError
    // Pridobi trenutno stanje
    // FIX R81-F (LEAK-HIGH, WRITE IDOR): item lookup je bil nescopecan
    // (findUnique po raw ID) — staff je lahko NAVAJAL zalogo TUJIH lokacij
    // (isti razred kot R80 inventory/transactions POST fix). findFirst z
    // lokacijskim filtrom iz seje; izven scope-a → 404 notInScopeResponse.
    // OPOMBA (shared stock): ko seja NI lokacijsko vezana (super-admin) se
    // filter NE uporabi — globalne NULL-location zaloge ostanejo dosegljive.
    const item = await db.inventoryItem.findFirst({
      where: {
        id: data.inventoryItemId,
        ...(sessionLocId ? { locationId: sessionLocId } : {}),
      },
    })
    if (!item) {
      return notInScopeResponse('Zalogov artikel')
    }
    const previousQty = item.quantity
    const _newQty = Math.round((toNum(previousQty) + data.quantity) * 10000) / 10000
    const unitCost = item.costPerUnit
    const totalCost = round2(multiply(data.quantity, unitCost))
    // FIX: Posodobi zalogo in ustvari transakcijo v eni transakciji — atomic increment
    const result = await db.$transaction(async (tx) => {
      // Atomic increment — prepreči race condition z več terminali
      const updated = await tx.inventoryItem.update({
        where: { id: data.inventoryItemId },
        data: {
          quantity: { increment: data.quantity },
          lastRestocked: new Date(),
          ...(isPositive(item.servingsPerUnit) ? {
            costPerServing: round2(divide(unitCost, item.servingsPerUnit)),
          } : {}),
        },
        include: { menuItem: true },
      })
      const actualNewQty = updated.quantity
      const transaction = await tx.stockTransaction.create({
        data: {
          inventoryItemId: data.inventoryItemId,
          type: 'procurement',
          quantity: data.quantity,
          previousQty: toNum(actualNewQty) - data.quantity,
          newQty: toNum(actualNewQty),
          costPerUnit: unitCost,
          totalCost,
          reason: data.reason,
          note: data.note,
          supplierDoc: data.supplierDoc,
          employeeName: data.employeeName || authResult.session?.employeeId || '',
        },
      })
      return { updated, transaction }
    })
    return NextResponse.json(deepToNumbers(result))
  } catch (error: unknown) {
    return handleApiError(error, 'POST /api/inventory/restock', 'Napaka pri vnosu nabave')
  }
}
