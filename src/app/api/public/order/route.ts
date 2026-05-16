import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

// =====================================================================
// PUBLIC ORDER ENDPOINT - Brez avtentikacije (za QR naročanje)
// Stranka skenira QR kodo, naroči direktno iz telefona
// Podpira oba QR frontenda: /qr-menu (tableNumber) in /qr/[tableId] (tableId)
// =====================================================================

export async function POST(req: Request) {
  try {
    const body = await req.json()
    // Sprejmi obe obliki: tableNumber (iz /qr-menu) in tableId (iz /qr/[tableId])
    // Sprejmi items ali orderItems (različna frontenda pošiljata različno)
    const { tableNumber: rawTableNumber, tableId: rawTableId, customerName, notes } = body
    const items = body.items || body.orderItems || []

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'Naročilo mora vsebovati vsaj en artikel' }, { status: 400 })
    }

    // Poišči ali ustvari dining option za QR naročanje
    let diningOption = await db.diningOption.findFirst({ where: { type: 'dine-in' } })
    if (!diningOption) {
      diningOption = await db.diningOption.create({
        data: { name: 'Na mestu', type: 'dine-in', isActive: true, sortOrder: 0, prepTimeMinutes: 15 }
      })
    }

    // Poišči mizo - podprto prek tableNumber (int) ali tableId (UUID)
    let tableId: string | undefined
    let resolvedTableNumber: number | undefined

    if (rawTableId) {
      // QR /qr/[tableId] pošilja UUID tableId
      const table = await db.table.findUnique({ where: { id: rawTableId } })
      if (table) {
        tableId = table.id
        resolvedTableNumber = table.number
      }
    } else if (rawTableNumber) {
      // QR /qr-menu pošilja tableNumber (int ali string)
      const tableNum = parseInt(String(rawTableNumber), 10) || 1
      let table = await db.table.findFirst({ where: { number: tableNum } })
      if (!table) {
        table = await db.table.create({
          data: {
            number: tableNum,
            capacity: 4,
            status: 'occupied',
          }
        })
      } else {
        await db.table.update({ where: { id: table.id }, data: { status: 'occupied' } })
      }
      tableId = table.id
      resolvedTableNumber = tableNum
    }

    // Pridobi podatke o menu itemih za izračun
    const menuItemIds = items.map((i: any) => i.menuItemId)
    const menuItems = await db.menuItem.findMany({
      where: { id: { in: menuItemIds } },
      include: { recipeItems: { include: { inventoryItem: true } } }
    })
    const menuItemMap = new Map(menuItems.map(mi => [mi.id, mi]))

    // Generiraj številko naročila z atomskim counterjem
    let nextOrderNumber: number
    try {
      const counter = await db.counter.upsert({
        where: { name: 'orderNumber' },
        update: { value: { increment: 1 } },
        create: { name: 'orderNumber', value: 1 }
      })
      nextOrderNumber = counter.value
    } catch {
      // Fallback če Counter tabela še ni na voljo
      const maxOrder = await db.order.findFirst({
        orderBy: { orderNumber: 'desc' },
        select: { orderNumber: true }
      })
      nextOrderNumber = (maxOrder?.orderNumber || 0) + 1
    }

    // Izračunaj zneske
    let subtotal = 0
    let totalVat = 0
    const orderItemsData: Array<{
      menuItemId: string;
      quantity: number;
      price: number;
      vatRate: number;
      vatAmount: number;
      notes: string;
      modifiersJson: string;
    }> = []

    for (const item of items) {
      const menuItem = menuItemMap.get(item.menuItemId)
      if (!menuItem) continue

      const qty = item.quantity || 1
      const itemBase = menuItem.price * qty
      const itemVat = itemBase * (menuItem.vatRate / 100)
      subtotal += itemBase
      totalVat += itemVat

      orderItemsData.push({
        menuItemId: menuItem.id,
        quantity: qty,
        price: menuItem.price,
        vatRate: menuItem.vatRate,
        vatAmount: itemVat,
        notes: item.notes || '',
        modifiersJson: item.modifiersJson || '[]',
      })
    }

    const total = subtotal + totalVat
    const displayTableNum = resolvedTableNumber || rawTableNumber || '?'

    // Ustvari naročilo
    const order = await db.order.create({
      data: {
        orderNumber: nextOrderNumber,
        type: 'dine-in',
        status: 'pending',
        subtotal,
        tax: totalVat,
        total,
        totalWithTip: total,
        customerName: customerName || `QR Miza ${displayTableNum}`,
        notes: notes || `QR naročilo - Miza ${displayTableNum}`,
        tableId,
        diningOptionId: diningOption.id,
        inventoryDeducted: false,
        orderItems: {
          create: orderItemsData,
        },
      },
      include: { orderItems: true, table: true }
    })

    // Zmanjšaj zalogo PO ustvarjanju naročila (ločeno za konsistentnost)
    for (const item of items) {
      const menuItem = menuItemMap.get(item.menuItemId)
      if (!menuItem) continue
      const qty = item.quantity || 1

      for (const recipe of menuItem.recipeItems) {
        if (recipe.inventoryItem && recipe.inventoryItem.quantity >= recipe.quantityPerServing * qty) {
          const deductQty = recipe.quantityPerServing * qty
          const prevQty = recipe.inventoryItem.quantity
          await db.inventoryItem.update({
            where: { id: recipe.inventoryItem.id },
            data: { quantity: { decrement: deductQty } }
          })
          await db.stockTransaction.create({
            data: {
              inventoryItemId: recipe.inventoryItem.id,
              type: 'sale',
              quantity: -deductQty,
              previousQty: prevQty,
              newQty: prevQty - deductQty,
              costPerUnit: recipe.inventoryItem.costPerUnit,
              totalCost: deductQty * recipe.inventoryItem.costPerUnit,
              reason: `QR naročilo #${nextOrderNumber}`,
            }
          })
        }
      }
    }

    // Označi, da je zaloga zmanjšana
    await db.order.update({
      where: { id: order.id },
      data: { inventoryDeducted: true }
    })

    return NextResponse.json({
      success: true,
      order: {
        id: order.id,
        orderNumber: String(order.orderNumber),
        status: order.status,
        total: order.total,
        estimatedTime: '15-20 min',
        tableNumber: resolvedTableNumber || rawTableNumber || null,
      }
    }, { status: 201 })

  } catch (error: any) {
    console.error('QR Order error:', error)
    return NextResponse.json({
      error: 'Napaka pri ustvarjanju naročila',
      details: error.message
    }, { status: 500 })
  }
}
