// ============================================
// NABAVNA NAROČILA — Profesionalna implementacija
// Toast POS standard — ND-YYYY-NNNNNN format
// Avtentikacija + Zod validacija
// ============================================

import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { validateBody, createPurchaseOrderSchema } from '@/lib/validations'
import { getNextCounter } from '@/lib/counters'

// GET - Pridobi nabavna naročila
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

    return NextResponse.json({ orders, total, limit, offset })
  } catch (error) {
    console.error('Napaka pri pridobivanju nabavnih naročil:', error)
    return NextResponse.json({ error: 'Napaka pri pridobivanju nabavnih naročil' }, { status: 500 })
  }
}

// POST - Ustvari nabavno naročilo
export async function POST(req: Request) {
  try {
    // FIX C-09: Zahtevaj avtentikacijo za ustvarjanje nabavnega naročila
    const authResult = await requireAuth(req, { permission: 'manage_inventory' })
    if (authResult.error) return authResult.error

    const body = await req.json()

    // FIX H-01: Zod validacija
    const { data, error: validationError } = validateBody(createPurchaseOrderSchema, body)
    if (validationError) return validationError

    // FIX HIGH: Atomna številka naročila — prepreči race condition (kot orderNumber/receiptNumber)
    const year = new Date().getFullYear()
    const counterName = `purchaseOrderNumber-${year}`
    const seq = await getNextCounter(counterName)
    const poNumber = `ND-${year}-${String(seq).padStart(6, '0')}`

    // Izračunaj zneske iz postavk
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

    // DDV po stopnjah (poenostavljeno — uporabi 22% za vse)
    const vatAmount = subtotal * 0.22
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

    return NextResponse.json(po, { status: 201 })
  } catch (error) {
    console.error('Napaka pri ustvarjanju nabavnega naročila:', error)
    return NextResponse.json({ error: 'Napaka pri ustvarjanju nabavnega naročila' }, { status: 500 })
  }
}
