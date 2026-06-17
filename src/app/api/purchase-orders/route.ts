// ============================================
// NABAVNA NAROČILA — Profesionalna implementacija
// Toast POS standard — ND-YYYY-NNNNNN format
// Avtentikacija + Zod validacija
// ============================================

// GET - Pridobi nabavna naročila
import { db } from '@/lib/db'
import { deepToNumbers } from '@/lib/decimal'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { createPurchaseOrderSchema } from '@/lib/validations'
import { getNextCounter } from '@/lib/counters'
import { handleApiError, validateRequest } from '@/lib/api-utils'

export async function GET(req: Request) {
  try {
    // FIX C-09: Zahtevaj avtentikacijo za vpogled v nabavna naročila
    const authResult = await requireAuth(req, { permission: 'manage_inventory' })
    if (authResult.error) return authResult.error

    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status') || ''
    const supplierId = searchParams.get('supplierId') || ''

    const where: Record<string, unknown> = {}
    if (status) where.status = status
    if (supplierId) where.supplierId = supplierId

    // FIX MEDIUM: Paginacija z NaN varnostjo
    const rawLimit = parseInt(searchParams.get('limit') || '50')
    const rawOffset = parseInt(searchParams.get('offset') || '0')
    const limit = Math.min(Number.isNaN(rawLimit) ? 50 : rawLimit, 500)
    const offset = Number.isNaN(rawOffset) ? 0 : rawOffset

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

    return NextResponse.json({ orders: deepToNumbers(orders), total, limit, offset })
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
