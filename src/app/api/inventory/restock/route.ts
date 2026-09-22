// POST /api/inventory/restock — Vnos nabave (prevzem blaga v zalogo)
import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { deepToNumbers } from '@/lib/decimal'
import { requireAuth } from '@/lib/auth-middleware'
import { inventoryRestockSchema } from '@/lib/validations'
import { parseJsonBody, validateBody } from '@/lib/api-utils'
import { notInScopeResponse } from '@/lib/tenant-scope'
import { structuredErrorResponse } from '@/lib/structured-error'
import { restockInventoryItem } from '../_helpers/stock-mutations'
import { Prisma } from '@prisma/client'

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
    // FIX R81-F (LEAK-HIGH, WRITE IDOR): fast-path scoped lookup — izven
    // scope-a → 404 notInScopeResponse (WRITE IDOR politika R80/R81-F).
    // R106 INV-3: dejanski pisalni tok je v kanonu (restockInventoryItem)
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

    // R106 INV-3 (MEDIUM, kanon R105/R104): restock v skupnem zalogovnem
    // kanonu — $transaction(Serializable) + advisory lock (SKUPNI per-item
    // ključ z adjust/PUT/PATCH — audit veriga brez prepletov) + tx-fresh
    // scoped re-read (strukturirana 404 namesto P2025 → 500 ob izbrisu
    // med stopnicama). Atomic increment ostaja (kvantiteta je varna že od
    // prej), sveža je zdaj tudi audit veriga (previousQty iz tx reada).
    const result = await restockInventoryItem({
      inventoryItemId: data.inventoryItemId,
      sessionLocationId: sessionLocId,
      quantity: data.quantity,
      reason: data.reason,
      note: data.note,
      supplierDoc: data.supplierDoc,
      employeeName: data.employeeName || authResult.session?.employeeId || '',
    })
    return NextResponse.json(deepToNumbers(result))
  } catch (error: unknown) {
    // R106 INV-3 (error kontrakt): P2002/P2034 race-pathi → 409 (nikoli 500);
    // strukturirani { error, status } throw-i iz tx teles (404) → pravi statusi.
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      (error.code === 'P2002' || error.code === 'P2034')
    ) {
      return NextResponse.json(
        { error: 'Vnos nabave je v obdelavi (sočasen dostop) — poskusite znova' },
        { status: 409 }
      )
    }
    return structuredErrorResponse(error, 'POST /api/inventory/restock', 'Napaka pri vnosu nabave')
  }
}
