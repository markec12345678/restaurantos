// POST /api/inventory/adjust — Razknjižba/Odpis zaloge
import { db, createAuditLog } from '@/lib/db'
import { NextResponse } from 'next/server'
import { deepToNumbers, toNum, round2, multiply } from '@/lib/decimal'
import { requireAuth } from '@/lib/auth-middleware'
import { inventoryAdjustSchema, batchAdjustSchema } from '@/lib/validations'
import { parseJsonBody, handleApiError, validateBody } from '@/lib/api-utils'
import { notInScopeResponse } from '@/lib/tenant-scope'
import { structuredErrorResponse } from '@/lib/structured-error'
import { adjustInventoryItemStock } from '../_helpers/stock-mutations'
import { Prisma } from '@prisma/client'

export const dynamic = 'force-dynamic'

// FIX R81-F (LEAK-HIGH): inline role-aware fail-closed gate (zrcali
// resolveCatalogScope semantiko; subscription platformAdminGate stil —
// brez tenant-scope helperjev). Non-admin BREZ session.locationId = 403
// (data integrity issue), ker ne moremo izpeljati scope-a.
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

export async function POST(req: Request) {
  try {
    const bodyResult = await parseJsonBody(req)
    if (bodyResult.error) return bodyResult.error
    // FIX C-05: Zahtevaj avtentikacijo
    const authResult = await requireAuth(req, { permission: 'manage_inventory' })
    if (authResult.error) return authResult.error
    // FIX R81-F (LEAK-HIGH): scope gate (403) PRED validacijo/db
    const scope = requireLocationScope(authResult)
    if ('error' in scope) return scope.error
    const sessionLocId = scope.sessionLocId
    // FIX H-01: Validiraj vnos z Zod
    const { data, error: validationError } = validateBody(inventoryAdjustSchema, bodyResult.data)
    if (validationError) return validationError
    // FIX R81-F (LEAK-HIGH, WRITE IDOR): fast-path scoped lookup — izven
    // scope-a → 404 notInScopeResponse (WRITE IDOR politika R80/R81-F).
    // R106 INV-1: dejanski pisalni tok je v kanonu (adjustInventoryItemStock)
    // s tx-fresh scoped re-read — ta read je SAMO zgodnja 404/403 stopnica.
    const item = await db.inventoryItem.findFirst({
      where: {
        id: data.inventoryItemId,
        ...(sessionLocId ? { locationId: sessionLocId } : {}),
      },
    })
    if (!item) {
      return notInScopeResponse('Zalogov artikel')
    }

    // R106 INV-1 (HIGH, kanon R105/R104): odpisna + absolutna pot v ENEM
    // skupnem kanonu — $transaction(Serializable) + advisory lock per item +
    // tx-fresh re-read + validacija samo proti svežim podatkom + atomarni
    // pogojni decrement (negativna zaloga nemogoča) + strukturirani throw-i.
    // Prej: outer stale read določal cap, tx telo NEPOGOJEN decrement
    // (dva sočasna odpisa = negativna zaloga) in absolutna pot lost update.
    const result = await adjustInventoryItemStock({
      inventoryItemId: data.inventoryItemId,
      sessionLocationId: sessionLocId,
      type: data.type,
      quantity: data.quantity,
      newQuantity: data.newQuantity,
      reason: data.reason,
      note: data.note,
      supplierDoc: data.supplierDoc,
      employeeName: data.employeeName || authResult.session?.employeeId || '',
    })

    const transaction = result.transaction as {
      quantity: number
      previousQty: number
      newQty: number
    } | null

    // FIX MEDIUM: Audit log za razknjižbo zaloge — z TX-FRESH vrednostmi
    // (prej: previousQty/newQty iz stale read-a pred tx).
    await createAuditLog({
      userId: authResult.session?.employeeId,
      action: 'INVENTORY_ADJUST',
      entityType: 'InventoryItem',
      entityId: data.inventoryItemId,
      details: {
        type: data.type,
        quantity: transaction?.quantity ?? 0,
        previousQty: transaction?.previousQty ?? 0,
        newQty: transaction?.newQty ?? 0,
        reason: data.reason,
        itemName: (result.item as { name?: string }).name,
      },
    })
    return NextResponse.json(deepToNumbers(result))
  } catch (error: unknown) {
    // R106 INV-1 (error kontrakt): P2002/P2034 race-pathi → 409 (nikoli 500);
    // strukturirani { error, status } throw-i iz tx teles (404/400) → pravi
    // statusi (prej: `throw new Error('Artikel ni najden')` → 500).
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      (error.code === 'P2002' || error.code === 'P2034')
    ) {
      return NextResponse.json(
        { error: 'Prilagoditev zaloge je v obdelavi (sočasen dostop) — poskusite znova' },
        { status: 409 }
      )
    }
    return structuredErrorResponse(error, 'POST /api/inventory/adjust', 'Napaka pri razknjižbi')
  }
}
// PUT — batch razknjižba (V ENI TRANSAKCIJI)
// R106: batch pot OSTANE na P3 atomarnem vzorcu (updateMany gte per item) —
// negativna zaloga nemogoča že od fixa P3; kanon z advisory lockom je obvezen
// za enojne pisalne poti (POST/PUT/PATCH/restock), batch ostaja per-item CAS.
export async function PUT(req: Request) {
  try {
    const bodyResult = await parseJsonBody(req)
    if (bodyResult.error) return bodyResult.error
    // FIX C-05: Zahtevaj avtentikacijo
    const authResult = await requireAuth(req, { permission: 'manage_inventory' })
    if (authResult.error) return authResult.error
    // FIX R81-F (LEAK-HIGH): scope gate (403) PRED validacijo/db
    const scope = requireLocationScope(authResult)
    if ('error' in scope) return scope.error
    const sessionLocId = scope.sessionLocId
    // FIX H-01: Validiraj vnos z Zod
    const { data, error: validationError } = validateBody(batchAdjustSchema, bodyResult.data)
    if (validationError) return validationError
    // FIX: Batch operacije v ENI transakciji
    const results = await db.$transaction(async (tx) => {
      const processed: { updated: Record<string, unknown>; transaction: Record<string, unknown> }[] = []
      const skipped: { inventoryItemId: string; reason: string }[] = []
      for (const entry of data.items) {
        // FIX R81-F (LEAK-HIGH, WRITE IDOR): batch lookup je bil nescopecan
        // (findUnique po raw ID) — odpis tujih zalog. findFirst scoped
        // (ista politika kot POST zgoraj / R80 transactions fix).
        const item = await tx.inventoryItem.findFirst({
          where: {
            id: entry.inventoryItemId,
            ...(sessionLocId ? { locationId: sessionLocId } : {}),
          },
        })
        if (!item) {
          // FIX MEDIUM: Namesto tihega preskoka — zabeleži kateri artikli manjkajo
          skipped.push({ inventoryItemId: entry.inventoryItemId, reason: 'Artikel ni najden' })
          continue
        }
        const previousQty = item.quantity
        const deductQty = entry.quantity
        if (deductQty <= 0) {
          skipped.push({ inventoryItemId: entry.inventoryItemId, reason: 'Količina mora biti pozitivna' })
          continue
        }

        // FIX P3 (audit 2026-09-06): Atomic preprečitev negative stock.
        // Prej: `decrement` + clamp-to-0 (če gre v negativo, popravi na 0).
        // Problem: race condition — dva sočasna zahtevka lahko oba gresta v negativo
        // preden drugi clamp-a. Tudi: tih over-sell je dovoljen brez opozorila.
        // Sedaj: updateMany z WHERE quantity >= deductQty. Če ni dovolj zaloge,
        // se update ne zgodi (count=0) in zabeležimo napako.
        const updateResult = await tx.inventoryItem.updateMany({
          where: {
            id: entry.inventoryItemId,
            quantity: { gte: deductQty }, // ← atomarni check
          },
          data: { quantity: { decrement: deductQty } },
        })

        if (updateResult.count === 0) {
          // Ni dovolj zaloge — zabeležimo napako, NE gremo v negativo
          skipped.push({
            inventoryItemId: entry.inventoryItemId,
            reason: `Premalo zaloge za "${item.name}" — na voljo: ${toNum(previousQty)}, potrebno: ${deductQty}`,
          })

          // Zabeležimo poskus (za audit)
          await tx.stockTransaction.create({
            data: {
              inventoryItemId: entry.inventoryItemId,
              type: data.type,
              quantity: 0, // ni bilo odbito
              previousQty: toNum(previousQty),
              newQty: toNum(previousQty), // nespremenjeno
              costPerUnit: item.costPerUnit,
              totalCost: 0,
              reason: `POSKUS (nezadostna zaloga): ${data.reason || entry.reason || ''}`.slice(0, 500),
              note: entry.note || '',
              employeeName: data.employeeName || authResult.session?.employeeId || '',
            },
          })
          continue
        }

        // Uspešno odbito — preberemo novo stanje
        const updated = await tx.inventoryItem.findUnique({
          where: { id: entry.inventoryItemId },
          include: { menuItem: true },
        })
        const newQty = toNum(updated?.quantity ?? 0)
        const totalCost = round2(multiply(deductQty, item.costPerUnit))
        const txQuantity = -deductQty

        const transaction = await tx.stockTransaction.create({
          data: {
            inventoryItemId: entry.inventoryItemId,
            type: data.type,
            quantity: txQuantity,
            previousQty: toNum(previousQty),
            newQty,
            costPerUnit: item.costPerUnit,
            totalCost,
            reason: data.reason || entry.reason || '',
            note: entry.note || '',
            employeeName: data.employeeName || authResult.session?.employeeId || '',
          },
        })
        processed.push({ updated: updated as Record<string, unknown>, transaction: transaction as unknown as Record<string, unknown> })
      }
      return { processed, skipped }
    })
    return NextResponse.json({ processed: results.processed.length, results: results.processed, skipped: results.skipped })
  } catch (error: unknown) {
    return handleApiError(error, 'PUT /api/inventory/adjust', 'Napaka pri batch razknjižbi')
  }
}
