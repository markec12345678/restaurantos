// Pomožne funkcije za /api/orders route
// Helpers: broadcast, print, order item calculations

import { db, createAuditLog } from '@/lib/db'
import { toNum, round2 } from '@/lib/decimal'
import { getAppUrl } from '@/lib/utils'
import { deductStockForOrder, broadcastLowStockAlert } from '@/lib/stock-deduction'
import { emitOrderCreated } from '@/lib/event-emitter'
import { logger } from '@/lib/logger'

// Helper za WebSocket broadcast (varen klic — deluje tudi brez WS strežnika)
export async function broadcastWS(type: string, payload: unknown) {
  try {
    await fetch(`${getAppUrl()}/api/ws-broadcast`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, payload }),
    })
  } catch {
    // WS strežnik ni na voljo — tiho prezri
  }
}

// Helper za samodejni tisk kuhinjskega naročila
export async function autoPrintKitchenOrder(order: Record<string, unknown>) {
  try {
    await fetch(`${getAppUrl()}/api/print`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'order', orderId: order.id }),
    })
  } catch {
    // Tiskanje ni na voljo — tiho prezri
  }
}

// Tip za vhodne podatke artiklov naročila
export interface OrderItemInput {
  menuItemId: string
  quantity: number
  notes?: string
  modifiersJson?: unknown
}

// Tip za mapiranje artiklov iz baze
export interface MenuItemVatMap {
  id: string
  vatRate: { toNumber: () => number } | number
  price: { toNumber: () => number } | number
}

// Tip za izračunane podatke artikla naročila
export interface OrderItemData {
  menuItemId: string
  quantity: number
  price: number
  vatRate: number
  vatAmount: number
  discountAmount: number
  notes?: string
  modifiersJson?: unknown
  status: 'pending'
}

// Izračunaj podatke artiklov naročila z multi-DDV in porazdelitvijo popusta
export function buildOrderItemsData(
  orderItems: OrderItemInput[],
  vatMap: Map<string, MenuItemVatMap>,
  discount: number,
): { orderItemsData: OrderItemData[]; subtotal: number } {
  let subtotal = 0
  const rawItemsData = orderItems.map(item => {
    const mi = vatMap.get(item.menuItemId)!
    const vatRate = toNum(mi.vatRate as Parameters<typeof toNum>[0])
    const price = toNum(mi.price as Parameters<typeof toNum>[0]) // FIX C-02: Strežniška cena iz baze — edini vir resnice
    const itemBase = price * item.quantity
    subtotal += itemBase
    return { menuItemId: item.menuItemId, quantity: item.quantity, price, vatRate, itemBase }
  })

  // FIX H-03: Popust ne more preseči vmesne vsote
  const cappedDiscount = Math.min(discount || 0, subtotal)

  // Porazdeli popust proporcionalno po artiklih
  let discountDistributed = 0
  const orderItemsData: OrderItemData[] = rawItemsData.map((item, idx) => {
    let itemDiscount = 0
    if (cappedDiscount > 0 && subtotal > 0) {
      const remainingDiscount = cappedDiscount - discountDistributed
      if (idx === rawItemsData.length - 1) {
        // FIX M-02: Prepreči negativen popust — Math.max(0, ...) prepreči, da zaokroževanje
        // ustvari negativen preostali popust, kar bi povečalo ceno zadnjega artikla
        itemDiscount = Math.max(0, remainingDiscount)
      } else {
        itemDiscount = Math.round((item.itemBase / subtotal) * cappedDiscount * 100) / 100
      }
      discountDistributed += itemDiscount
    }

    const adjustedBase = item.itemBase - itemDiscount
    // FIX BUG: Zaokroži vatAmount na 2 decimalni mesti — prepreči float napake v valuti
    const adjustedVat = Math.round(adjustedBase * (item.vatRate / 100) * 100) / 100

    return {
      menuItemId: item.menuItemId,
      quantity: item.quantity,
      price: item.price,
      vatRate: item.vatRate,
      vatAmount: adjustedVat,
      discountAmount: itemDiscount,
      notes: orderItems[idx].notes,
      modifiersJson: orderItems[idx].modifiersJson,
      status: 'pending' as const,
    }
  })

  return { orderItemsData, subtotal }
}

// Izračunaj skupne zneske naročila
export function calculateOrderTotals(orderItemsData: OrderItemData[], _subtotal: number) {
  // Ponovno izračunaj subtotale in davke z upoštevanjem popustov
  // FIX MEDIUM: Zaokroži vse zneske na 2 decimalni mesti — prepreči floating-point napake pri valuti
  const recalculatedSubtotal = orderItemsData.reduce((sum, item) => sum + toNum(item.price) * item.quantity, 0)
  const totalTax = round2(orderItemsData.reduce((sum, item) => sum + toNum(item.vatAmount), 0))
  const totalDiscountAmount = round2(orderItemsData.reduce((sum, item) => sum + toNum(item.discountAmount), 0))
  const total = round2(recalculatedSubtotal + totalTax - totalDiscountAmount)

  return { subtotal: recalculatedSubtotal, totalTax, totalDiscountAmount, total }
}

// Samodejno razknjiževanje zaloge ob oddaji naročila
export async function handleStockDeduction(
  orderId: string,
  orderNumber: number,
  orderItems: Array<{ menuItemId: string; quantity: number }>,
): Promise<{ stockDeducted: boolean }> {
  let stockDeducted = false
  try {
    const stockResult = await deductStockForOrder(orderId, orderNumber, orderItems)
    stockDeducted = true

    await db.order.update({
      where: { id: orderId },
      data: { inventoryDeducted: true },
    })

    if (stockResult.lowStockAlerts.length > 0) {
      broadcastLowStockAlert(stockResult.lowStockAlerts)
    }
  } catch (stockError: unknown) {
    logger.error('API', `[STOCK] Napaka pri razknjiževanju zaloge za naročilo ${orderNumber}`, stockError)
  }
  return { stockDeducted }
}

// Tip za podatke naročila za post-creation efekti
export interface PostCreationOrderData {
  id: string
  orderNumber: number
  type: string
  tableId: string | null
  // Prisma Decimal
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  total: any
}

// Obdelaj stranske učinke po ustvarjanju naročila (WS, tisk, webhook, revizija)
export async function handlePostCreationEffects(
  order: PostCreationOrderData,
  employeeId: string | null | undefined,
  stockDeducted: boolean,
): Promise<void> {
  broadcastWS('NEW_ORDER', {
    orderId: order.id,
    orderNumber: order.orderNumber,
    type: order.type,
    tableId: order.tableId,
    total: toNum(order.total),
  })

  autoPrintKitchenOrder(order as unknown as Record<string, unknown>)

  emitOrderCreated({
    orderId: order.id,
    orderNumber: order.orderNumber,
    type: order.type,
    tableId: order.tableId || undefined,
    total: toNum(order.total),
  }).catch(err => logger.error('API', '[Webhook] order.created napaka:', err))

  await createAuditLog({
    userId: employeeId || undefined,
    action: 'CREATE_ORDER',
    entityType: 'Order',
    entityId: order.id,
    details: { orderNumber: order.orderNumber, total: toNum(order.total), type: order.type, tableId: order.tableId, inventoryDeducted: stockDeducted },
  })
}

// Preveri, da vsi artikli obstajajo v vatMap
export function validateMenuItems(
  orderItems: OrderItemInput[],
  vatMap: Map<string, MenuItemVatMap>,
): string | null {
  for (const item of orderItems) {
    if (!vatMap.has(item.menuItemId)) {
      return item.menuItemId
    }
  }
  return null
}
