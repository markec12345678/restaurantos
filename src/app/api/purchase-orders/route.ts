// ============================================
// NABAVNA NAROČILA — Profesionalna implementacija
// Toast POS standard — ND-YYYY-NNNNNN format
// ============================================

import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

// GET - Pridobi nabavna naročila
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status') || ''
    const supplierId = searchParams.get('supplierId') || ''

    const where: Record<string, unknown> = {}
    if (status) where.status = status
    if (supplierId) where.supplierId = supplierId

    const orders = await db.purchaseOrder.findMany({
      where,
      include: {
        supplier: true,
        items: { include: { inventoryItem: true } },
      },
      orderBy: { orderDate: 'desc' },
      take: 50,
    })

    return NextResponse.json(orders)
  } catch (error) {
    console.error('Napaka pri pridobivanju nabavnih naročil:', error)
    return NextResponse.json({ error: 'Napaka pri pridobivanju nabavnih naročil' }, { status: 500 })
  }
}

// POST - Ustvari nabavno naročilo
export async function POST(req: Request) {
  try {
    const body = await req.json()

    // Validacija
    if (!body.supplierId) {
      return NextResponse.json({ error: 'Dobavitelj je obvezen' }, { status: 400 })
    }

    // Generiraj številko naročila
    const year = new Date().getFullYear()
    const count = await db.purchaseOrder.count({
      where: { poNumber: { startsWith: `ND-${year}-` } },
    })
    const poNumber = `ND-${year}-${String(count + 1).padStart(6, '0')}`

    // Izračunaj zneske
    let subtotal = 0
    const items = (body.items || []).map((item: {
      description: string; inventoryItemId?: string; quantityOrdered: number;
      unit?: string; unitPrice: number; vatRate?: number; notes?: string
    }) => {
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
        supplierId: body.supplierId,
        status: body.status || 'draft',
        orderDate: new Date(),
        expectedDate: body.expectedDate ? new Date(body.expectedDate) : null,
        subtotal,
        vatAmount,
        totalAmount,
        deliveryAddress: body.deliveryAddress || '',
        deliveryNotes: body.deliveryNotes || '',
        requestedBy: body.requestedBy || '',
        approvedBy: body.approvedBy || '',
        notes: body.notes || '',
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
