// ============================================
// NABAVNA NAROČILA — Profesionalna implementacija
// Toast POS standard — ND-YYYY-NNNNNN format
// Avtentikacija + Zod validacija
// ============================================

// GET - Pridobi nabavna naročila
import { db } from '@/lib/db'
import { deepToNumbers } from '@/lib/decimal'
import { NextResponse } from 'next/server'
import { requireAuth, resolveTenantLocationIdOrThrow } from '@/lib/auth-middleware'
import { resolveWriteLocationId } from '@/lib/tenant-scope'
import { createPurchaseOrderSchema } from '@/lib/validations'
import { getNextCounter } from '@/lib/counters'
import { handleApiError, parsePaginationParams, validateRequest } from '@/lib/api-utils'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  try {
    // FIX C-09: Zahtevaj avtentikacijo za vpogled v nabavna naročila
    const authResult = await requireAuth(req, { permission: 'manage_inventory' })
    if (authResult.error) return authResult.error

    const { searchParams } = new URL(req.url)

    // R80 FIX HIGH (aggregate leak): prej je GET vračal nabavna naročila VSEH
    // lokacij (where je imel samo status/supplierId; manage_inventory dosegljiv
    // managerjem → dobavitelji in zneski tujih tenantov). PurchaseOrder ima
    // lasten locationId stolpec. Fail-closed; null scope (super-admin) = vse.
    const scope = resolveTenantLocationIdOrThrow(authResult.session, searchParams, {
      endpoint: 'GET /api/purchase-orders',
    })
    if ('error' in scope) return scope.error

    const status = searchParams.get('status') || ''
    const supplierId = searchParams.get('supplierId') || ''

    const where: Record<string, unknown> = {
      // R80: tenant filter — findMany + count oba dedita ta where
      // (null scope = PRAZEN filter, nikoli { locationId: null })
      ...(scope.locationId ? { locationId: scope.locationId } : {}),
    }
    if (status) where.status = status
    if (supplierId) where.supplierId = supplierId

    // FIX MEDIUM: Paginacija z NaN varnostjo
    // P1-16: centralna pagination validacija (limit max, offset, search dolžina)
    const { limit, offset } = parsePaginationParams(searchParams)

    const [orders, total] = await Promise.all([
      db.purchaseOrder.findMany({
        where,
        include: {
          supplier: true,
          items: { include: { inventoryItem: true } },
        },
        orderBy: { orderDate: 'desc' },
        take: limit,
        skip: offset,
      }),
      db.purchaseOrder.count({ where }),
    ])

    // FIX BUG-PO-4 & BUG-PO-5: Dodaj 'name' in 'quantity' alias-e za boljšo
    // kompatibilnost s frontend komponentami ki pričakujejo ta polja.
    const enrichedOrders = deepToNumbers(orders).map((po: Record<string, unknown>) => ({
      ...po,
      items: Array.isArray(po.items) ? po.items.map((item: Record<string, unknown>) => ({
        ...item,
        // FIX BUG-PO-4: 'name' alias za 'description' (nekateri UI komponente pričakujejo name)
        name: item.name || item.description || '',
        // FIX BUG-PO-5: 'quantity' alias za 'quantityOrdered' (standardizacija)
        quantity: item.quantity ?? item.quantityOrdered ?? 0,
      })) : [],
    }))

    return NextResponse.json({ orders: enrichedOrders, total, limit, offset })
  } catch (error: unknown) {
    return handleApiError(error, 'GET /api/purchase-orders', 'Napaka pri pridobivanju nabavnih naročil')
  }
}

// POST - Ustvari nabavno naročilo
export async function POST(req: Request) {
  try {
    // FIX C-09: Zahtevaj avtentikacijo za ustvarjanje nabavnega naročila
    const authResult = await requireAuth(req, { permission: 'manage_inventory' })
    if (authResult.error) return authResult.error

    // FIX QA runda 38: DB stolpec PurchaseOrder.locationId je NOT NULL (schema drift,
    // P2011 potrjen na prod) — resolvi lokacijo pred create.
    // FIX R87-4 (LOW preostanek): centralni resolver TAKOJ za requireAuth (pred body
    // parse) + fail-closed write resolution. Prej: resolveLocationId(session, employee)
    // je za NULL-location sejo (permission 'manage_inventory' ≠ vloga admin!) povlekel
    // GLOBALNI prva-lokacija fallback (location-fallback.ts) → nabavno naročilo,
    // postavke in številčni counter so se žigali na PRVO lokacijo KATEREGA KOLI
    // tenanta. Zdaj: regular/manager NULL → 403; super-admin brez ?locationId → 400
    // fail-closed (ne global-first stamp).
    const scope = resolveTenantLocationIdOrThrow(authResult.session, new URL(req.url).searchParams, {
      endpoint: 'POST /api/purchase-orders',
    })
    if ('error' in scope) return scope.error
    const writeLoc = resolveWriteLocationId(scope.locationId)
    if (!writeLoc.ok) return writeLoc.response
    const locationId = writeLoc.locationId

    // FIX SECURITY: validateRequest() prepreči DoS z oversized payload
    const { data, error: validationError } = await validateRequest(req, createPurchaseOrderSchema)
    if (validationError) return validationError

    // FIX HIGH: Atomna številka naročila — prepreči race condition (kot orderNumber/receiptNumber)
    const year = new Date().getFullYear()
    const counterName = `purchaseOrderNumber-${year}`
    const seq = await getNextCounter(counterName)
    const poNumber = `ND-${year}-${String(seq).padStart(6, '0')}`

    // Izračunaj zneske iz postavk
    // Note: data.items fields (quantityOrdered, unitPrice, vatRate) are numbers from Zod validation
    let subtotal = 0
    const items = data.items.map((item) => {
      const totalPrice = item.quantityOrdered * item.unitPrice
      subtotal += totalPrice
      return {
        description: item.description,
        inventoryItemId: item.inventoryItemId || null,
        quantityOrdered: item.quantityOrdered,
        quantityReceived: 0,
        unit: item.unit || 'kos',
        unitPrice: item.unitPrice,
        vatRate: item.vatRate || 22.0,
        totalPrice,
        status: 'pending',
        notes: item.notes || '',
      }
    })

    // FIX HIGH: DDV po stopnjah — uporabi per-item vatRate namesto hardcoded 22%
    // Prej: const vatAmount = subtotal * 0.22 — narobe za artikle z 9.5% DDV
    const vatAmount = items.reduce((sum, item) => {
      return sum + (item.quantityOrdered * item.unitPrice * (item.vatRate || 22.0) / 100)
    }, 0)
    const totalAmount = subtotal + vatAmount

    const po = await db.purchaseOrder.create({
      data: {
        poNumber,
        supplierId: data.supplierId,
        locationId,
        status: 'draft',
        orderDate: new Date(),
        expectedDate: data.expectedDate ? new Date(data.expectedDate) : null,
        subtotal,
        vatAmount,
        totalAmount,
        deliveryAddress: data.deliveryAddress || '',
        deliveryNotes: data.deliveryNotes || '',
        requestedBy: authResult.session?.employeeId || '',
        approvedBy: '',
        notes: data.notes || '',
        items: { create: items },
      },
      include: { supplier: true, items: { include: { inventoryItem: true } } },
    })

    return NextResponse.json(deepToNumbers(po), { status: 201 })
  } catch (error: unknown) {
    return handleApiError(error, 'POST /api/purchase-orders', 'Napaka pri ustvarjanju nabavnega naročila')
  }
}
