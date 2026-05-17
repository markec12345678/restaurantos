// ============================================
// NABAVNO NAROČILO — Posodobi / Pridobi
// Vključuje prevzem blaga z avtomatsko posodobitvijo zaloge
// Avtentikacija za vse operacije
// ============================================

import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'

// GET - Pridobi posamezno naročilo
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    // FIX C-09: Zahtevaj avtentikacijo
    const authResult = await requireAuth(req, { permission: 'manage_inventory' })
    if (authResult.error) return authResult.error

    const { id } = await params
    const po = await db.purchaseOrder.findUnique({
      where: { id },
      include: { supplier: true, items: { include: { inventoryItem: true } } },
    })
    if (!po) return NextResponse.json({ error: 'Naročilo ni najdeno' }, { status: 404 })
    return NextResponse.json(po)
  } catch (error) {
    console.error('Napaka pri pridobivanju naročila:', error)
    return NextResponse.json({ error: 'Napaka pri pridobivanju naročila' }, { status: 500 })
  }
}

// PUT - Posodobi naročilo / Prevzemi blago
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    // FIX C-09: Zahtevaj avtentikacijo
    const authResult = await requireAuth(req, { permission: 'manage_inventory' })
    if (authResult.error) return authResult.error

    const { id } = await params
    const body = await req.json()

    // Prevzem blaga — posodobi zalogo
    if (body.action === 'receive' && body.receivedItems) {
      const po = await db.purchaseOrder.findUnique({
        where: { id },
        include: { items: true },
      })
      if (!po) return NextResponse.json({ error: 'Naročilo ni najdeno' }, { status: 404 })

      for (const receivedItem of body.receivedItems) {
        const poItem = po.items.find(i => i.id === receivedItem.itemId)
        if (!poItem) continue

        // FIX H-03: Preveri, da količina ne presega naročene
        const totalReceived = poItem.quantityReceived + receivedItem.quantityReceived
        if (totalReceived > poItem.quantityOrdered) {
          return NextResponse.json(
            { error: `Postavka "${poItem.description}": prevzeta količina presega naročeno` },
            { status: 400 }
          )
        }

        // Posodobi postavko naročila
        await db.purchaseOrderItem.update({
          where: { id: poItem.id },
          data: {
            quantityReceived: totalReceived,
            status: totalReceived >= poItem.quantityOrdered ? 'received' : 'partial',
          },
        })

        // Posodobi zalogo, če je povezana
        if (poItem.inventoryItemId) {
          const invItem = await db.inventoryItem.findUnique({
            where: { id: poItem.inventoryItemId },
          })
          if (invItem) {
            const previousQty = invItem.quantity
            const newQty = previousQty + receivedItem.quantityReceived
            await db.inventoryItem.update({
              where: { id: invItem.id },
              data: { quantity: newQty, lastRestocked: new Date() },
            })
            // Ustvari zalogo transakcijo
            await db.stockTransaction.create({
              data: {
                inventoryItemId: invItem.id,
                type: 'procurement',
                quantity: receivedItem.quantityReceived,
                previousQty,
                newQty,
                costPerUnit: poItem.unitPrice,
                totalCost: receivedItem.quantityReceived * poItem.unitPrice,
                reason: `Naročilo ${po.poNumber}`,
                supplierDoc: po.poNumber,
                employeeName: authResult.session?.employeeId || '',
              },
            })
          }
        }
      }

      // Preveri ali je vse prejeto
      const updatedPo = await db.purchaseOrder.findUnique({
        where: { id },
        include: { items: true },
      })
      const allReceived = updatedPo?.items.every(i => i.quantityReceived >= i.quantityOrdered)
      const anyPartial = updatedPo?.items.some(i => i.quantityReceived > 0 && i.quantityReceived < i.quantityOrdered)

      await db.purchaseOrder.update({
        where: { id },
        data: {
          status: allReceived ? 'received' : anyPartial ? 'partial' : po.status,
          receivedDate: allReceived ? new Date() : null,
        },
      })

      return NextResponse.json({ success: true, message: 'Blago prevzeto in zaloga posodobljena' })
    }

    // Navadna posodobitev
    const existing = await db.purchaseOrder.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'Naročilo ni najdeno' }, { status: 404 })

    const updateData: Record<string, unknown> = {}
    if (body.status) updateData.status = body.status
    if (body.expectedDate) updateData.expectedDate = new Date(body.expectedDate)
    if (body.notes !== undefined) updateData.notes = body.notes
    if (body.approvedBy) updateData.approvedBy = body.approvedBy
    if (body.deliveryAddress !== undefined) updateData.deliveryAddress = body.deliveryAddress
    if (body.deliveryNotes !== undefined) updateData.deliveryNotes = body.deliveryNotes

    const po = await db.purchaseOrder.update({
      where: { id },
      data: updateData,
      include: { supplier: true, items: { include: { inventoryItem: true } } },
    })

    return NextResponse.json(po)
  } catch (error) {
    console.error('Napaka pri posodabljanju naročila:', error)
    return NextResponse.json({ error: 'Napaka pri posodabljanju naročila' }, { status: 500 })
  }
}
