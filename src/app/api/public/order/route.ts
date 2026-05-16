import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { z } from 'zod'

// =====================================================================
// PUBLIC ORDER ENDPOINT - Brez avtentikacije (za QR naročanje)
// Stranka skenira QR kodo, naroči direktno iz telefona
// Podpira oba QR frontenda: /qr-menu (tableNumber) in /qr/[tableId] (tableId)
// =====================================================================

// Rate limiting - preprost IP bazen (v produkciji bi bil Redis)
const orderRateLimit = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT_MAX = 5       // Maksimalno 5 naročil
const RATE_LIMIT_WINDOW = 60000 // V 1 minuti

// Cleanup: odstrani stare vnose, ki so izven okna — prepreči memory leak
function cleanupRateLimitEntries() {
  const now = Date.now()
  for (const [ip, entry] of orderRateLimit.entries()) {
    if (entry.resetAt <= now) {
      orderRateLimit.delete(ip)
    }
  }
}

// Validacijska shema za QR naročilo
const publicOrderItemSchema = z.object({
  menuItemId: z.string().min(1, 'ID artikla je obvezen'),
  quantity: z.number().int().min(1, 'Količina mora biti vsaj 1').max(20, 'Maksimalno 20 enot na artikel'),
  notes: z.string().max(500, 'Opombe ne smejo preseči 500 znakov').default(''),
  modifiersJson: z.string().max(2000).default('[]'),
})

const publicOrderSchema = z.object({
  tableId: z.string().optional(),
  tableNumber: z.union([z.string(), z.number()]).optional(),
  customerName: z.string().max(100).default(''),
  customerPhone: z.string().max(30).default(''),
  notes: z.string().max(1000).default(''),
  items: z.array(publicOrderItemSchema).min(1, 'Naročilo mora vsebovati vsaj en artikel').max(30, 'Maksimalno 30 artiklov na naročilo').optional(),
  orderItems: z.array(publicOrderItemSchema).min(1, 'Naročilo mora vsebovati vsaj en artikel').max(30, 'Maksimalno 30 artiklov na naročilo').optional(),
}).refine(data => data.items?.length || data.orderItems?.length, {
  message: 'Naročilo mora vsebovati vsaj en artikel',
})

export async function POST(req: Request) {
  // RATE LIMITING: Prepreči zlorabo
  const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'unknown'

  // Počisti stare vnose pred preverjanjem — prepreči memory leak
  cleanupRateLimitEntries()

  const rateEntry = orderRateLimit.get(clientIp)
  const now = Date.now()
  if (rateEntry && rateEntry.resetAt > now && rateEntry.count >= RATE_LIMIT_MAX) {
    return NextResponse.json({ error: 'Preveč naročil. Poskusite znova čez nekaj minut.' }, { status: 429 })
  }
  if (!rateEntry || rateEntry.resetAt <= now) {
    orderRateLimit.set(clientIp, { count: 1, resetAt: now + RATE_LIMIT_WINDOW })
  } else {
    rateEntry.count++
  }

  try {
    const body = await req.json()

    // VALIDACIJA: Preveri vse vnose
    const parsed = publicOrderSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({
        error: 'Neveljavni podatki',
        validationErrors: parsed.error.issues.map(e => ({
          field: e.path.join('.'),
          message: e.message,
        })),
      }, { status: 400 })
    }
    const data = parsed.data

    const items = data.items || data.orderItems || []

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

    if (data.tableId) {
      // QR /qr/[tableId] pošilja UUID tableId
      const table = await db.table.findUnique({ where: { id: data.tableId } })
      if (!table) {
        return NextResponse.json({ error: 'Miza ni najdena. Skennirajte QR kodo na mizi.' }, { status: 400 })
      }
      tableId = table.id
      resolvedTableNumber = table.number
    } else if (data.tableNumber) {
      // QR /qr-menu pošilja tableNumber (int ali string)
      const tableNum = parseInt(String(data.tableNumber), 10)
      if (isNaN(tableNum) || tableNum < 1 || tableNum > 999) {
        return NextResponse.json({ error: 'Neveljavna številka mize' }, { status: 400 })
      }
      const table = await db.table.findFirst({ where: { number: tableNum } })
      if (!table) {
        // NE USTVARJAJ avtomatsko mize - vrni napako
        return NextResponse.json({ error: 'Miza ni najdena. Obvestite natakarja.' }, { status: 400 })
      }
      tableId = table.id
      resolvedTableNumber = tableNum
      // Označi mizo kot zasedeno
      await db.table.update({ where: { id: table.id }, data: { status: 'occupied' } })
    }

    // Pridobi podatke o menu itemih za izračun
    const menuItemIds = items.map(i => i.menuItemId)
    const menuItems = await db.menuItem.findMany({
      where: { id: { in: menuItemIds }, isAvailable: true },
      include: { recipeItems: { include: { inventoryItem: true } } }
    })
    const menuItemMap = new Map(menuItems.map(mi => [mi.id, mi]))

    // Preveri, da vsi artikli obstajajo in so na voljo
    if (menuItems.length !== menuItemIds.length) {
      const foundIds = new Set(menuItems.map(m => m.id))
      const missing = menuItemIds.filter(id => !foundIds.has(id))
      return NextResponse.json({ error: 'Nekateri artikli niso na voljo', unavailableItems: missing }, { status: 400 })
    }

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

    // Izračunaj zneske iz strežniških podatkov (NE zaupaj klientu!)
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

      const qty = item.quantity
      const itemBase = menuItem.price * qty
      const itemVat = itemBase * (menuItem.vatRate / 100)
      subtotal += itemBase
      totalVat += itemVat

      orderItemsData.push({
        menuItemId: menuItem.id,
        quantity: qty,
        price: menuItem.price, // Strežniška cena, ne klientova
        vatRate: menuItem.vatRate,
        vatAmount: itemVat,
        notes: item.notes,
        modifiersJson: item.modifiersJson,
      })
    }

    if (orderItemsData.length === 0) {
      return NextResponse.json({ error: 'Noben veljaven artikel v naročilu' }, { status: 400 })
    }

    const total = subtotal + totalVat
    const displayTableNum = resolvedTableNumber || data.tableNumber || '?'

    // Ustvari naročilo IN zmanjšaj zalogo v transakciji (atomarno)
    const order = await db.$transaction(async (tx) => {
      const newOrder = await tx.order.create({
        data: {
          orderNumber: nextOrderNumber,
          type: 'dine-in',
          status: 'pending',
          subtotal,
          tax: totalVat,
          total,
          totalWithTip: total,
          customerName: data.customerName || `QR Miza ${displayTableNum}`,
          notes: data.notes || `QR naročilo - Miza ${displayTableNum}`,
          tableId,
          diningOptionId: diningOption!.id,
          inventoryDeducted: false,
          orderItems: {
            create: orderItemsData,
          },
        },
        include: { orderItems: true, table: true }
      })

      // Zmanjšaj zalogo znotraj transakcije (atomarno - prepreči race condition)
      for (const item of items) {
        const menuItem = menuItemMap.get(item.menuItemId)
        if (!menuItem) continue
        const qty = item.quantity

        for (const recipe of menuItem.recipeItems) {
          if (!recipe.inventoryItem) continue
          const deductQty = recipe.quantityPerServing * qty
          // Atomarna preverba in decrement
          const updated = await tx.inventoryItem.updateMany({
            where: {
              id: recipe.inventoryItem.id,
              quantity: { gte: deductQty },
            },
            data: { quantity: { decrement: deductQty } }
          })
          if (updated.count > 0) {
            const prevQty = recipe.inventoryItem.quantity
            await tx.stockTransaction.create({
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
      await tx.order.update({
        where: { id: newOrder.id },
        data: { inventoryDeducted: true }
      })

      return newOrder
    })

    return NextResponse.json({
      success: true,
      order: {
        id: order.id,
        orderNumber: String(order.orderNumber),
        status: order.status,
        total: order.total,
        estimatedTime: '15-20 min',
        tableNumber: resolvedTableNumber || data.tableNumber || null,
      }
    }, { status: 201 })

  } catch (error: any) {
    console.error('QR Order error:', error)
    return NextResponse.json({
      error: 'Napaka pri ustvarjanju naročila',
    }, { status: 500 })
  }
}
