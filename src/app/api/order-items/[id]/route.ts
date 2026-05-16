import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { broadcastLowStockAlert } from '@/lib/stock-deduction'

// Helper za WebSocket broadcast
async function broadcastWS(type: string, payload: unknown) {
  try {
    await fetch('http://localhost:3000/api/ws-broadcast', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, payload }),
    })
  } catch {
    // WS strežnik ni na voljo
  }
}

// PUT /api/order-items/[id] — Update individual order item (status, void, etc.)
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params

    // FIX BUG 8: Zahtevaj avtentikacijo za posodobitev order item-ov
    const authResult = await requireAuth(req, { permission: 'void_items' })
    if (authResult.error) return authResult.error

    const body = await req.json()

    // Validiraj osnovna polja
    const allowedStatuses = ['pending', 'preparing', 'ready', 'served', 'voided', 'cancelled']
    if (body.status && !allowedStatuses.includes(body.status)) {
      return NextResponse.json({ error: `Neveljaven status: ${body.status}` }, { status: 400 })
    }

    const updateData: Record<string, unknown> = {}
    if (body.status) updateData.status = body.status
    if (body.notes !== undefined) updateData.notes = body.notes

    // === VOID OPERACIJA ===
    // Void pomeni, da se artikel poniči (ne zaračuna stranki)
    // Zahteva razlog (voidReasonId ali voidReasonText)
    if (body.voided === true) {
      updateData.voided = true
      if (body.voidReasonId) updateData.voidReasonId = body.voidReasonId
      updateData.status = 'voided'
    }

    const orderItem = await db.orderItem.update({
      where: { id },
      data: updateData,
      include: { menuItem: true, order: { include: { table: true } } },
    })

    // Če je void, preračunaj zneske naročila
    if (body.voided === true) {
      const allItems = await db.orderItem.findMany({
        where: { orderId: orderItem.orderId },
      })

      // Preračun brez voidanih artiklov
      let newSubtotal = 0
      let newTax = 0
      for (const item of allItems) {
        if (!item.voided) {
          const itemBase = item.price * item.quantity
          const itemVat = itemBase * (item.vatRate / 100)
          newSubtotal += itemBase
          newTax += itemVat
        }
      }

      const order = await db.order.findUnique({ where: { id: orderItem.orderId } })
      const discount = order?.discount || 0
      // FIX H-03: Popust ne more preseči vmesne vsote
      const cappedDiscount = Math.min(discount, newSubtotal)
      const newTotal = newSubtotal + newTax - cappedDiscount

      await db.order.update({
        where: { id: orderItem.orderId },
        data: {
          subtotal: Math.round(newSubtotal * 100) / 100,
          tax: Math.round(newTax * 100) / 100,
          discount: cappedDiscount,
          total: Math.max(0, Math.round(newTotal * 100) / 100),
          totalWithTip: Math.max(0, Math.round(newTotal * 100) / 100) + (order?.tip || 0),
        },
      })

      // ─── VRNI ZALOGO ZA VOIDAN ARTIKEL ───
      const voidReason = body.voidReasonText || body.voidReasonId || 'Razlog ni naveden'

      // 1. Preveri RecipeItem (večsastavni recepti) — PREDNOST
      const recipeItems = await db.recipeItem.findMany({
        where: { menuItemId: orderItem.menuItemId },
      })

      if (recipeItems.length > 0) {
        // Vrni zalogo za vsako sestavino v receptu
        for (const recipe of recipeItems) {
          const invItem = await db.inventoryItem.findUnique({ where: { id: recipe.inventoryItemId } })
          if (!invItem) continue

          const qtyToReturn = recipe.quantityPerServing * orderItem.quantity
          const previousQty = invItem.quantity
          const newQty = Math.round((previousQty + qtyToReturn) * 10000) / 10000

          await db.$transaction(async (tx) => {
            await tx.inventoryItem.update({
              where: { id: invItem.id },
              data: { quantity: newQty },
            })
            await tx.stockTransaction.create({
              data: {
                inventoryItemId: invItem.id,
                type: 'return',
                quantity: qtyToReturn,
                previousQty,
                newQty,
                costPerUnit: invItem.costPerUnit,
                totalCost: -(qtyToReturn * invItem.costPerUnit),
                reason: `VOID: ${orderItem.menuItem.name} - ${voidReason}`,
                orderId: orderItem.orderId,
                employeeName: authResult.session?.employeeId || '',
              },
            })
          })

          // Preveri če je zaloga še vedno nizka
          if (newQty <= invItem.minQuantity) {
            broadcastLowStockAlert([{
              inventoryItemId: invItem.id,
              name: invItem.name,
              currentQty: newQty,
              minQty: invItem.minQuantity,
            }])
          }
        }
      } else {
        // 2. Fallback: direktna 1:1 povezava InventoryItem ↔ MenuItem
        const inventoryItem = await db.inventoryItem.findFirst({
          where: { menuItemId: orderItem.menuItemId },
        })

        if (inventoryItem) {
          const previousQty = inventoryItem.quantity
          const unitsPerServing = inventoryItem.servingsPerUnit > 0 ? 1 / inventoryItem.servingsPerUnit : 1
          const qtyToReturn = Math.round(orderItem.quantity * unitsPerServing * 10000) / 10000
          const newQty = Math.round((previousQty + qtyToReturn) * 10000) / 10000

          await db.$transaction(async (tx) => {
            await tx.inventoryItem.update({
              where: { id: inventoryItem.id },
              data: { quantity: newQty },
            })
            await tx.stockTransaction.create({
              data: {
                inventoryItemId: inventoryItem.id,
                type: 'return',
                quantity: qtyToReturn,
                previousQty,
                newQty,
                costPerUnit: inventoryItem.costPerUnit,
                totalCost: -(qtyToReturn * inventoryItem.costPerUnit),
                reason: `VOID: ${orderItem.menuItem.name} - ${voidReason}`,
                orderId: orderItem.orderId,
                employeeName: authResult.session?.employeeId || '',
              },
            })
          })

          // Preveri če je zaloga še vedno nizka
          if (newQty <= inventoryItem.minQuantity) {
            broadcastLowStockAlert([{
              inventoryItemId: inventoryItem.id,
              name: inventoryItem.name,
              currentQty: newQty,
              minQty: inventoryItem.minQuantity,
            }])
          }
        }
      }
    }

    // Check if all items in the order are ready — auto-update order status
    if (body.status === 'ready' || body.status === 'served') {
      const allItems = await db.orderItem.findMany({
        where: { orderId: orderItem.orderId },
        select: { status: true },
      })

      const allReady = allItems.every(item =>
        item.status === 'ready' || item.status === 'served'
      )

      if (allReady && orderItem.order.status !== 'ready') {
        await db.order.update({
          where: { id: orderItem.orderId },
          data: { status: 'ready' },
        })
      }
    }

    // WebSocket: obvesti KDS o spremembi statusa artikla
    if (body.status) {
      broadcastWS('ITEM_STATUS_CHANGED', {
        orderItemId: orderItem.id,
        orderId: orderItem.orderId,
        newStatus: body.status,
        menuItemName: orderItem.menuItem.name,
      })
    }

    // Re-fetch za posodobljene podatke
    const updatedItem = await db.orderItem.findUnique({
      where: { id },
      include: { menuItem: true, order: { include: { table: true } } },
    })

    return NextResponse.json(updatedItem || orderItem)
  } catch (error) {
    console.error('Napaka pri posodobitvi artikla naročila:', error)
    return NextResponse.json({ error: 'Napaka pri posodobitvi artikla naročila' }, { status: 500 })
  }
}
