
// =====================================================================
// PUBLIC ORDER ENDPOINT - Brez avtentikacije (za QR naročanje)
// Stranka skenira QR kodo, naroči direktno iz telefona
// Podpira oba QR frontenda: /qr-menu (tableNumber) in /qr/[tableId] (tableId)
// FIX CRITICAL: Skupni rate limiter modul
// =====================================================================

// FIX: Check if restaurant is currently open before accepting orders
import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { checkRateLimit, getClientIp, PUBLIC_ORDER_LIMIT } from '@/lib/rate-limit'
import { toNum, calcVat } from '@/lib/decimal'
import { logger } from '@/lib/logger'
import { handleRouteError, validateRequest } from '@/lib/api-utils'
async function isRestaurantOpen(): Promise<boolean> {
  try {
    const hours = await db.openingHours.findMany({ where: {} })
    if (!hours || hours.length === 0) return false

    // FIX MEDIUM: Uporabi slovenski čas (CET/CEST), ne strežnikov lokalni čas
    const slovenianTime = new Date().toLocaleString('en-US', { timeZone: 'Europe/Ljubljana' })
    const now = new Date(slovenianTime)
    const dayOfWeek = now.getDay() // 0=Sun, 1=Mon, ...
    const todayHours = hours.find(h => h.dayOfWeek === dayOfWeek)
    if (!todayHours || todayHours.isClosed) return false

    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
    if (todayHours.openTime && currentTime < todayHours.openTime) return false
    if (todayHours.closeTime && currentTime > todayHours.closeTime) return false
    return true
  } catch {
    return false
  }
}

// Validacijska shema za QR naročilo
const publicOrderItemSchema = z.object({
  menuItemId: z.string().min(1, 'ID artikla je obvezen').max(100, 'ID artikla ne sme preseči 100 znakov'),
  quantity: z.number().int().min(1, 'Količina mora biti vsaj 1').max(20, 'Maksimalno 20 enot na artikel'),
  notes: z.string().max(500, 'Opombe ne smejo preseči 500 znakov').default(''),
  modifiersJson: z.string().max(2000, 'Modifikatorji ne smejo preseči 2000 znakov').default('[]'),
})

const publicOrderSchema = z.object({
  tableId: z.string().max(100, 'ID mize ne sme preseči 100 znakov').optional(),
  tableNumber: z.union([z.string().max(10, 'Številka mize ne sme preseči 10 znakov'), z.number().int().min(1, 'Številka mize mora biti vsaj 1').max(999, 'Številka mize ne sme preseči 999')]).optional(),
  customerName: z.string().max(100, 'Ime stranke ne sme preseči 100 znakov').default(''),
  customerPhone: z.string().max(30, 'Telefon ne sme preseči 30 znakov').default(''),
  notes: z.string().max(1000, 'Opombe ne smejo preseči 1000 znakov').default(''),
  items: z.array(publicOrderItemSchema).min(1, 'Naročilo mora vsebovati vsaj en artikel').max(30, 'Maksimalno 30 artiklov na naročilo').optional(),
  orderItems: z.array(publicOrderItemSchema).min(1, 'Naročilo mora vsebovati vsaj en artikel').max(30, 'Maksimalno 30 artiklov na naročilo').optional(),
}).refine(data => data.items?.length || data.orderItems?.length, {
  message: 'Naročilo mora vsebovati vsaj en artikel',
})

export async function POST(req: Request) {
  // FIX CRITICAL: Rate limiting — uporabi skupni modul
  const clientIp = getClientIp(req)
  const rateCheck = checkRateLimit('public-order', clientIp, PUBLIC_ORDER_LIMIT)
  if (!rateCheck.allowed) {
    return NextResponse.json(
      { error: 'Preveč naročil. Poskusite znova čez nekaj minut.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil((rateCheck.retryAfterMs || 60000) / 1000)) } }
    )
  }

  try {
    // FIX: Check if restaurant is open before accepting QR orders
    const isOpen = await isRestaurantOpen()
    if (!isOpen) {
      return NextResponse.json({ error: 'Restavracija je trenutno zaprta. Naročila niso mogoča.' }, { status: 403 })
    }

    const { data, error: validationError } = await validateRequest(req, publicOrderSchema)
    if (validationError) return validationError

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
      // FIX BUG-15: Preveri stanje mize pred oznako 'occupied'
      if (table.status === 'available' || table.status === 'occupied') {
        await db.table.update({ where: { id: table.id }, data: { status: 'occupied' } })
      }
      // 'reserved' in 'cleaning' mize NE postanejo 'occupied' prek QR naročila
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
      // FIX BUG-15: Preveri stanje mize pred oznako 'occupied'
      if (table.status === 'available' || table.status === 'occupied') {
        await db.table.update({ where: { id: table.id }, data: { status: 'occupied' } })
      }
      // 'reserved' in 'cleaning' mize NE postanejo 'occupied' prek QR naročila
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
    // FIX Q04 MEDIUM: Če counter ne deluje, VRNI NAPAKO namesto neatomskega fallbacka
    // Prejšnji fallback z findFirst(orderBy desc) je bil neatomska — dva sočasna zahtevka bi dobila isto številko
    let nextOrderNumber: number
    try {
      const counter = await db.counter.upsert({
        where: { name: 'orderNumber' },
        update: { value: { increment: 1 } },
        create: { name: 'orderNumber', value: 1 }
      })
      nextOrderNumber = counter.value
    } catch (counterErr: unknown) {
      logger.error('API', '[QR ORDER] Counter upsert failed — ZAVRNI naročilo (neatomska operacija):', counterErr)
      return NextResponse.json({ error: 'Napaka pri generiranju številke naročila. Poskusite znova.' }, { status: 503 })
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
      // FIX QR-04 MEDIUM: Dodaj ceno modifikatorjev k ceni artikla
      // Prejšnja koda je ignorirala modifier cene — stranka plača manj kot se prikaže
      let modifierTotal = 0
      const parsedModifiers: Array<{ id?: string; name?: string; price?: number }> = (() => {
        try { return JSON.parse(item.modifiersJson || '[]') } catch { return [] }
      })()
      // FIX CRITICAL: Fetch modifier prices from DB — do NOT trust client prices (price tampering)
      const modifierIds = parsedModifiers.filter(m => m.id).map(m => m.id as string)
      const dbModifiers = modifierIds.length > 0
        ? await db.modifier.findMany({ where: { id: { in: modifierIds } } })
        : []
      const modifierPriceMap = new Map(dbModifiers.map(m => [m.id, m.price]))
      for (const mod of parsedModifiers) {
        const dbPrice = mod.id ? modifierPriceMap.get(mod.id as string) : null
        if (dbPrice !== undefined && dbPrice !== null) {
          modifierTotal += toNum(dbPrice) * qty // Use DB price (trusted)
        } else {
          // FIX CRITICAL: REJECT modifiers without DB price match — ne zaupaj klientu!
          logger.warn('API', `[QR ORDER] Modifier "${mod.name}" rejected — no DB price match (possible price tampering)`)
        }
      }

      const itemBase = toNum(menuItem.price) * qty + modifierTotal
      const itemVat = calcVat(itemBase, menuItem.vatRate)
      subtotal += itemBase
      totalVat += itemVat

      orderItemsData.push({
        menuItemId: menuItem.id,
        quantity: qty,
        price: toNum(menuItem.price), // Osnovna cena artikla (brez modifikatorjev)
        vatRate: toNum(menuItem.vatRate),
        vatAmount: itemVat,
        notes: item.notes,
        modifiersJson: item.modifiersJson,
      })
    }

    if (orderItemsData.length === 0) {
      return NextResponse.json({ error: 'Noben veljaven artikel v naročilu' }, { status: 400 })
    }

    const total = subtotal + totalVat

    // FIX QR-02 HIGH: Maksimalni skupni znesek naročila — prepreči zlorabo (30 artiklov * max cena = potencialno 30k+ EUR)
    const MAX_ORDER_TOTAL = 2000 // €2000 max za QR naročilo
    if (total > MAX_ORDER_TOTAL) {
      return NextResponse.json({ error: `Naročilo presega maksimalni znesek €${MAX_ORDER_TOTAL}. Zmanjšajte količino.` }, { status: 400 })
    }

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
      // FIX QR-03 HIGH: Če zmanjšanje zalove NE uspe (insufficient stock), OZNAČI artikel na naročilu
      for (const item of items) {
        const menuItem = menuItemMap.get(item.menuItemId)
        if (!menuItem) continue
        const qty = item.quantity

        for (const recipe of menuItem.recipeItems) {
          if (!recipe.inventoryItem) continue
          const deductQty = toNum(recipe.quantityPerServing) * qty
          // FIX MEDIUM: Preberi trenutno količino ZNOTRAJ transakcije — prepreči stale previousQty
          const currentInvItem = await tx.inventoryItem.findUnique({ where: { id: recipe.inventoryItem.id } })
          if (!currentInvItem) continue
          // Atomarna preverba in decrement
          const updated = await tx.inventoryItem.updateMany({
            where: {
              id: recipe.inventoryItem.id,
              quantity: { gte: deductQty },
            },
            data: { quantity: { decrement: deductQty } }
          })
          if (updated.count > 0) {
            const prevQty = toNum(currentInvItem.quantity)
            await tx.stockTransaction.create({
              data: {
                inventoryItemId: recipe.inventoryItem.id,
                type: 'sale',
                quantity: -deductQty,
                previousQty: prevQty,
                newQty: prevQty - deductQty,
                costPerUnit: toNum(currentInvItem.costPerUnit),
                totalCost: deductQty * toNum(currentInvItem.costPerUnit),
                reason: `QR naročilo #${nextOrderNumber}`,
              }
            })
          } else {
            // FIX QR-03 HIGH: Zaloga ni zadostna — ne sprejmi naročila tiho!
            // Označi da zaloga ni na voljo in vrni napako
            throw new Error(`INSUFFICIENT_STOCK:${menuItem.name}:potrebno ${deductQty.toFixed(2)} ${recipe.inventoryItem.unit || 'enot'}, na zalogi ${toNum(currentInvItem.quantity).toFixed(2)}`)
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

    // FIX: Broadcast NEW_ORDER to KDS/POS via WebSocket — kitchen needs to know about QR orders!
    try {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || `http://localhost:${process.env.PORT || 3000}`
      await fetch(`${appUrl}/api/ws-broadcast`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'NEW_ORDER',
          payload: {
            orderId: order.id,
            orderNumber: order.orderNumber,
            type: 'dine-in',
            source: 'qr',
            tableNumber: resolvedTableNumber || data.tableNumber || null,
          },
        }),
      })
    } catch {
      // WS ni na voljo — ni kritično
    }

    return NextResponse.json({
      success: true,
      order: {
        id: order.id,
        orderNumber: String(order.orderNumber),
        status: order.status,
        total: toNum(order.total),
        estimatedTime: '15-20 min',
        tableNumber: resolvedTableNumber || data.tableNumber || null,
      }
    }, { status: 201 })

  } catch (error: unknown) {
    return handleRouteError(error, 'POST /api/public/order', [
      { match: 'INSUFFICIENT_STOCK', message: 'Artikel ni na zalogi', status: 409, extra: (parts) => ({ error: `Na žalost ${parts[1] || 'Artikel'} ni več na zalogi (${parts[2] || ''}). Prosimo, izberite drug artikel.` }) },
    ], 'Napaka pri oddaji naročila. Prosimo, poskusite znova.')
  }
}
