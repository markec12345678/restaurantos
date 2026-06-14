
// Helper za WebSocket broadcast
import { db, createAuditLog } from '@/lib/db'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { updateOrderItemSchema } from '@/lib/validations'
import { parseJsonBody, handleApiError, validateBody } from '@/lib/api-utils'
import { broadcastLowStockAlert } from '@/lib/stock-deduction'
import { toNum, round2, isPositive, greaterThan, multiply, deepToNumbers } from '@/lib/decimal'
import { getAppUrl } from '@/lib/utils'
async function broadcastWS(type: string, payload: unknown) {
  try {
    await fetch(`${getAppUrl()}/api/ws-broadcast`, {
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
    const authResult = await requireAuth(req, { permission: 'void_item' })
    if (authResult.error) return authResult.error

    const bodyResult = await parseJsonBody(req)
    if (bodyResult.error) return bodyResult.error

    // FIX CRITICAL: Uporabi Zod validacijo namesto ročnega preverjanja
    const { data, error: validationError } = validateBody(updateOrderItemSchema, bodyResult.data)
    if (validationError) return validationError

    const updateData: Record<string, unknown> = {}
    if (data.status) updateData.status = data.status
    if (data.notes !== undefined) updateData.notes = data.notes

    // === VOID OPERACIJA ===
    // Void pomeni, da se artikel poniči (ne zaračuna stranki)
    // Zahteva razlog (voidReasonId ali voidReasonText)
    // FIX CRITICAL: Void idempotency guard — prepreči dvojni void in dvojni povrat zaloge
    if (data.voided === true) {
      // Preveri, da artikel še ni bil voidan — prepreči double void + double stock return
      const existingItem = await db.orderItem.findUnique({ where: { id } })
      if (existingItem?.voided) {
        return NextResponse.json({ error: 'Artikel je že bil voidan' }, { status: 409 })
      }
      updateData.voided = true
      if (data.voidReasonId) updateData.voidReasonId = data.voidReasonId
      updateData.status = 'voided'
    }

    const orderItem = await db.orderItem.update({
      where: { id },
      data: updateData,
      include: { menuItem: true, order: { include: { table: true } } },
    })

    // Če je void, preračunaj zneske naročila
    if (data.voided === true) {
      const allItems = await db.orderItem.findMany({
        where: { orderId: orderItem.orderId },
      })

      // Preračun brez voidanih artiklov
      let newSubtotal = 0
      let newTax = 0
      for (const item of allItems) {
        if (!item.voided) {
          // FIX: Decimal→number za aritmetiko; uporabi vatAmount če je na voljo (upošteva popust)
          const itemBase = toNum(item.price) * item.quantity
          const itemVat = toNum(item.vatAmount) > 0 ? toNum(item.vatAmount) : (itemBase * toNum(item.vatRate) / 100)
          newSubtotal += itemBase
          newTax += itemVat
        }
      }

      const order = await db.order.findUnique({ where: { id: orderItem.orderId } })
      const discount = toNum(order?.discount) // FIX: Decimal(0) je truthy — || 0 nikoli ne sproži
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
          totalWithTip: Math.max(0, Math.round(newTotal * 100) / 100) + toNum(order?.tip), // FIX: Decimal truthy
        },
      })

      // FIX BUG-05: Preračunaj totale čeka, ki mu pripada voidani artikel
      if (orderItem.checkId) {
        const linkedCheck = await db.check.findUnique({
          where: { id: orderItem.checkId },
          include: { orderItems: true },
        })
        if (linkedCheck) {
          let checkSubtotal = 0
          let checkTax = 0
          for (const oi of linkedCheck.orderItems) {
            if (oi.voided) continue
            const itemBase = toNum(oi.price) * oi.quantity // FIX: Decimal→number
            const itemVat = toNum(oi.vatAmount) > 0 ? toNum(oi.vatAmount) : (itemBase * (toNum(oi.vatRate) / 100)) // FIX: Decimal truthy — toNum() > 0 instead of ||
            checkSubtotal += itemBase
            checkTax += itemVat
          }
          const checkDiscount = toNum(linkedCheck.discount) // FIX: Decimal truthy — toNum() instead of || 0
          const checkTotal = round2(checkSubtotal + checkTax + toNum(linkedCheck.serviceCharge) - checkDiscount) // FIX: Decimal truthy + round2
          const checkTotalWithTip = round2(checkTotal + toNum(linkedCheck.tip)) // FIX: Decimal truthy + round2

          await db.check.update({
            where: { id: linkedCheck.id },
            data: {
              subtotal: round2(checkSubtotal), // FIX: round2 on currency fields
              tax: round2(checkTax),
              total: checkTotal,
              totalWithTip: checkTotalWithTip,
            },
          })
        }
      }

      // FIX BUG-13: Revizijski dnevnik za void operacijo
      await createAuditLog({
        userId: authResult.session?.employeeId,
        action: 'VOID_ORDER_ITEM',
        entityType: 'OrderItem',
        entityId: id,
        details: {
          orderItemId: id,
          orderId: orderItem.orderId,
          menuItemId: orderItem.menuItemId,
          quantity: orderItem.quantity,
          price: toNum(orderItem.price),
          voidReason: data.voidReasonText || data.voidReasonId || 'Ni razloga',
          voidedBy: authResult.session?.employeeId,
        },
      })

      // ─── VRNI ZALOGO ZA VOIDAN ARTIKEL ───
      const voidReason = data.voidReasonText || data.voidReasonId || 'Razlog ni naveden'

      // 1. Preveri RecipeItem (večsastavni recepti) — PREDNOST
      const recipeItems = await db.recipeItem.findMany({
        where: { menuItemId: orderItem.menuItemId },
      })

      if (recipeItems.length > 0) {
        // FIX: Vrni zalogo za VSE sestavine v eni transakciji — prepreči delno vračanje
        // FIX: Uporabi atomic increment namesto read-then-write — prepreči race condition
        const lowStockAlerts: Array<{ inventoryItemId: string; name: string; currentQty: number; minQty: number }> = []

        await db.$transaction(async (tx) => {
          for (const recipe of recipeItems) {
            const qtyToReturn = toNum(multiply(recipe.quantityPerServing, orderItem.quantity))

            // Atomic increment — prepreči race condition
            const updated = await tx.inventoryItem.update({
              where: { id: recipe.inventoryItemId },
              data: { quantity: { increment: qtyToReturn } },
            })
            const previousQty = toNum(updated.quantity) - qtyToReturn
            const newQty = updated.quantity

            await tx.stockTransaction.create({
              data: {
                inventoryItemId: updated.id,
                type: 'return',
                quantity: qtyToReturn,
                previousQty,
                newQty,
                costPerUnit: updated.costPerUnit,
                totalCost: -(qtyToReturn * toNum(updated.costPerUnit)),
                reason: `VOID: ${orderItem.menuItem.name} - ${voidReason}`,
                orderId: orderItem.orderId,
                employeeName: authResult.session?.employeeId || '',
              },
            })

            if (!greaterThan(newQty, updated.minQuantity)) {
              lowStockAlerts.push({
                inventoryItemId: updated.id,
                name: updated.name,
                currentQty: toNum(newQty),
                minQty: toNum(updated.minQuantity),
              })
            }
          }
        })

        // Pošlji low-stock opozorila po transakciji
        if (lowStockAlerts.length > 0) {
          broadcastLowStockAlert(lowStockAlerts)
        }
      } else {
        // 2. Fallback: direktna 1:1 povezava InventoryItem ↔ MenuItem
        // FIX: Uporabi atomic increment namesto read-then-write — prepreči race condition
        const inventoryItem = await db.inventoryItem.findFirst({
          where: { menuItemId: orderItem.menuItemId },
        })

        if (inventoryItem) {
          const unitsPerServing = isPositive(inventoryItem.servingsPerUnit) ? 1 / toNum(inventoryItem.servingsPerUnit) : 1
          const qtyToReturn = Math.round(orderItem.quantity * unitsPerServing * 10000) / 10000

          await db.$transaction(async (tx) => {
            const updated = await tx.inventoryItem.update({
              where: { id: inventoryItem.id },
              data: { quantity: { increment: qtyToReturn } },
            })
            const previousQty = toNum(updated.quantity) - qtyToReturn
            const newQty = updated.quantity

            await tx.stockTransaction.create({
              data: {
                inventoryItemId: inventoryItem.id,
                type: 'return',
                quantity: qtyToReturn,
                previousQty,
                newQty,
                costPerUnit: inventoryItem.costPerUnit,
                totalCost: -(qtyToReturn * toNum(inventoryItem.costPerUnit)),
                reason: `VOID: ${orderItem.menuItem.name} - ${voidReason}`,
                orderId: orderItem.orderId,
                employeeName: authResult.session?.employeeId || '',
              },
            })

            // Preveri če je zaloga še vedno nizka
            if (!greaterThan(newQty, inventoryItem.minQuantity)) {
              broadcastLowStockAlert([{
                inventoryItemId: inventoryItem.id,
                name: inventoryItem.name,
                currentQty: toNum(newQty),
                minQty: toNum(inventoryItem.minQuantity),
              }])
            }
          })
        }
      }
    }

    // Check if all items in the order are ready — auto-update order status
    if (data.status === 'ready' || data.status === 'served') {
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
    if (data.status) {
      broadcastWS('ITEM_STATUS_CHANGED', {
        orderItemId: orderItem.id,
        orderId: orderItem.orderId,
        newStatus: data.status,
        menuItemName: orderItem.menuItem.name,
      })
    }

    // Re-fetch za posodobljene podatke
    const updatedItem = await db.orderItem.findUnique({
      where: { id },
      include: { menuItem: true, order: { include: { table: true } } },
    })

    return NextResponse.json(deepToNumbers(updatedItem || orderItem))
  } catch (error: unknown) {
    return handleApiError(error, 'PUT /api/order-items/[id]', 'Napaka pri posodobitvi artikla naročila')
  }
}
