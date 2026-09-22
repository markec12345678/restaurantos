// POST /api/purchase-orders/[id]/receive — Prejem blaga (Goods Receipt)
// FIX BUG-PO-2: Ta endpoint prej ni obstajal — celoten receive flow je bil nedokončan.
//
// Sprejme seznam prejetih postavk (itemId + quantityReceived), posodobi zalogo
// in ustvari StockTransaction zapise. Ob popolnem prejemu avtomatsko ustvari
// AccountsPayable (obveznost do dobavitelja).
//
// Prav tako posodobi status PO-ja: partial (delno) ali received (popolnoma).
// FIX: Ustvari AuditLog za vsak prejem (revizijski dnevnik).
//
// R105 (TOCTOU razred iz R100–R104): celoten prevzemni tok teče prek skupnega
// kanona receivePurchaseOrderItems() (src/app/api/purchase-orders/[id]/_helpers.ts):
// $transaction(Serializable) + pg_advisory_xact_lock(hashtext(poId)) + tx-fresh
// re-read + validacija samo proti svežim podatkom + idempotentno AP ustvarjanje.
// Prej: PO + items stale read izven transakcije → dva sočasna prevzema =
// dvojna zaloga + dvojna obveznost (r156-168 AP brez pregleda); P2002 na
// apNumber @unique (count+1 števec) → 500 (R104 Q1 razred: uspeh → 500).
// Zdaj: P2002/P2034 race-path → 409 (nikoli 500).

import { createAuditLog } from '@/lib/db'
import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { requireAuth, resolveTenantLocationIdOrThrow } from '@/lib/auth-middleware'
import { deepToNumbers } from '@/lib/decimal'
import { validateRequest } from '@/lib/api-utils'
import { structuredErrorResponse } from '@/lib/structured-error'
import { receivePurchaseOrderItems } from '../_helpers'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const receiveSchema = z.object({
  receivedItems: z.array(z.object({
    itemId: z.string().min(1, 'ID postavke je obvezen'),
    quantityReceived: z.number().min(0.01, 'Količina mora biti pozitivna').max(99999, 'Količina je prevelika'),
  })).min(1, 'Vsaj ena postavka je obvezna').max(100, 'Največ 100 postavk na prevzem'),
  notes: z.string().max(2000, 'Opombe so predolge').optional(),
})

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authResult = await requireAuth(req, { permission: 'manage_inventory' })
    if (authResult.error) return authResult.error

    const { id } = await params

    const { data: body, error: validationError } = await validateRequest(req, receiveSchema)
    if (validationError) return validationError

    // FIX IDOR (tenant scope): prevzemi SAMO naročilo znotraj session lokacije
    // R86-2b (M2 razred): prej raw spread `session?.locationId ?? undefined` —
    // fail-open za non-admin seja z NULL lokacijo (cross-tenant prevzem: zaloga
    // increment + StockTransaction + AccountsPayable tujega tenanta). Resolver.
    const scope = resolveTenantLocationIdOrThrow(authResult.session, new URL(req.url).searchParams, {
      endpoint: 'POST /api/purchase-orders/[id]/receive',
    })
    if ('error' in scope) return scope.error

    // R105: skupni prevzemni kanon (advisory lock + Serializable + tx-fresh).
    // Prej: stale po findFirst izven transakcije + status check proti stale
    // podatkom + read-modify-write po itemih + nepogojen AP create.
    const result = await receivePurchaseOrderItems({
      poId: id,
      sessionLocationId: scope.locationId,
      receivedItems: body.receivedItems,
      employeeId: authResult.session?.employeeId ?? null,
      notes: body.notes,
    })

    const poNumber = (result.po as { poNumber?: string }).poNumber
    const supplierName = ((result.po as { supplier?: { name?: string } }).supplier?.name) || 'Neznan'

    // FIX: Ustvari AuditLog za revizijski dnevnik (zunanje transakcijo)
    try {
      await createAuditLog({
        userId: authResult.session?.employeeId,
        action: 'PURCHASE_ORDER_RECEIVED',
        entityType: 'PurchaseOrder',
        entityId: id,
        details: {
          poNumber,
          supplier: supplierName,
          status: (result.po as { status?: string }).status,
          itemsReceived: body.receivedItems.map((ri: { itemId: string; quantityReceived: number }) => ({
            itemId: ri.itemId,
            quantity: ri.quantityReceived,
          })),
          allReceived: result.allReceived,
        },
      })
    } catch {
      // Audit log napaka ne sme blokirati prejema blaga
    }

    return NextResponse.json({
      success: true,
      message: result.allReceived
        ? 'Blago v celoti prevzeto — zaloga posodobljena, obveznost ustvarjena'
        : 'Blago delno prevzeto — zaloga posodobljena',
      purchaseOrder: deepToNumbers(result.po),
      status: (result.po as { status?: string }).status,
    }, { status: 200 })
  } catch (error: unknown) {
    // R105: race-pathi nikoli 500 — P2002 (apNumber @unique count+1 števec
    // med sočasna zaključka dveh različnih PO-jev) → 409 retry; P2034
    // serialization conflict → 409 retry.
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      (error.code === 'P2002' || error.code === 'P2034')
    ) {
      return NextResponse.json(
        { error: 'Prevzem je v obdelavi (sočasen dostop) — poskusite znova' },
        { status: 409 }
      )
    }
    // R105 PO-6: strukturirani { error, status } throw-i iz tx teles
    // (404/400) → pravi statusi (prej string-matching catch).
    return structuredErrorResponse(error, 'POST /api/purchase-orders/[id]/receive', 'Napaka pri prevzemu blaga')
  }
}
