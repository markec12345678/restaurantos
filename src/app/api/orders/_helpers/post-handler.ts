// POST handler logika za orders API — ustvarjanje naročila

import { db } from '@/lib/db'
import { toNum, deepToNumbers } from '@/lib/decimal'
import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { getNextOrderNumber, resolveDefaultLocationId } from '@/lib/counters'
import { createOrderSchema } from '@/lib/validations'
import { checkStockAvailability } from '@/lib/stock-deduction'
import { validateRequest } from '@/lib/api-utils'
import { buildOrderItemsData, calculateOrderTotals, validateMenuItems } from './order-items'
import { handleStockDeduction, handlePostCreationEffects } from './stock'

// P1-6: session kontekst, ki ga POST pot potrebuje za resolucijo lokacije
export interface PostOrderAuthSession {
  session?: {
    employeeId?: string
    locationId?: string | null
    role?: string
  } | null
}

/**
 * P1-6: Resolviraj locationId za novo naročilo (server-side — body.locationId
 * se NE zaupa, večnadstropni tenant rescue:
 *   1. session.locationId (Employee kontekst — avtoritativen za regular userja)
 *   2. miza (tableId → Table.locationId — fizična lokacija mize)
 *   3. fallback: edina aktivna lokacija (single-tenant / seed)
 *   4. null (super admin v multi-tenant brez lokacije → globalni zapis)
 * Če session in miza nakazujeta RAZLIČNI lokaciji → 400 (IDOR zaščita:
 * natakar lokacije A ne more ustvariti naročila na mizi lokacije B).
 */
async function resolveOrderLocationId(
  tableId: string | null | undefined,
  sessionLocationId: string | null | undefined,
): Promise<{ ok: true; locationId: string } | { ok: false; error: string }> {
  let tableLocationId: string | null = null
  if (tableId) {
    const table = await db.table.findUnique({
      where: { id: tableId },
      select: { locationId: true },
    })
    if (table) tableLocationId = table.locationId
  }

  const sessionLoc = sessionLocationId || null
  if (sessionLoc && tableLocationId && sessionLoc !== tableLocationId) {
    return { ok: false, error: 'Izbrana miza pripada drugi lokaciji' }
  }
  const locationId = sessionLoc || tableLocationId
  if (locationId) return { ok: true, locationId }

  // P1-6: lokacija je OBVEZNA — brez nje naročilo ne sme biti ustvarjeno
  // (setup čarovnik jo ustvari; drugače jasen 400 namesto tiho izgubljenega zapisa)
  const fallback = await resolveDefaultLocationId()
  if (!fallback) {
    return { ok: false, error: 'Ni nastavljene lokacije — najprej konfigurirajte lokacijo (setup)' }
  }
  return { ok: true, locationId: fallback }
}

// FIX CRITICAL (Test 3.2): Poišči obstoječe naročilo po idempotencyKey
// Če klient pošlje isti idempotencyKey 2× (double-click, React Query retry,
// network reconnect), vrni obstoječi rezultat namesto da ustvarimo duplikat.
async function findExistingOrderByIdempotencyKey(idempotencyKey: string) {
  return db.order.findFirst({
    where: { idempotencyKey },
    include: {
      table: true,
      orderItems: { include: { menuItem: true } },
    },
  })
}

function isUniqueConstraintViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002'
}

export async function handlePostOrder(
  req: Request,
  authSession: PostOrderAuthSession,
) {
  // FIX H-01: Validiraj vnos z Zod + omejitev velikosti bodyja (1 MB) + samodejna sanatizacija
  const { data, error: validationError } = await validateRequest(req, createOrderSchema, { maxBodySize: 1024 * 1024 })
  if (validationError) return validationError

  // FIX CRITICAL (Test 3.2): Idempotency — če idempotencyKey ni podan, ga avtomatsko generiraj.
  // To zagotavlja da VSA naročila imajo idempotencyKey za deduplikacijo.
  // Klient lahko pošlje svoj key (npr. cart-session-id + timestamp), ali pa ga mi generiramo.
  const idempotencyKey = data.idempotencyKey ||
    `auto-order-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`

  // FIX CRITICAL (Test 3.2): Fast path — če naročilo z tem idempotencyKey že obstaja, ga vrni
  const existing = await findExistingOrderByIdempotencyKey(idempotencyKey)
  if (existing) {
    return NextResponse.json(deepToNumbers(existing), { status: 200 })
  }

  // P1-6: Resolviraj lokacijo naročila (session → miza → single-tenant fallback).
  // Naročilo brez lokacije je izgubljeno za tenant-scoped poizvedbe (GET /api/orders
  // z where locationId ne bi videl NULL vrstic) — zato resolucija pred kreiranjem.
  const locationResolution = await resolveOrderLocationId(
    data.tableId || null,
    authSession.session?.locationId,
  )
  if (!locationResolution.ok) {
    return NextResponse.json({ error: locationResolution.error }, { status: 400 })
  }
  const orderLocationId = locationResolution.locationId

  // FIX 1: Atomna številka — P1-7: per-lokacijsko številčenje (self-init iz MAX)
  const orderNumber = await getNextOrderNumber(orderLocationId)

  // Multi-DDV: pridobi vatRate za vsak artiklov iz baze (edini vir resnice)
  // MODEL A (tenant scope audit 2026-09-09): artikli so LAHKO SAMO z menijev
  // lokacije naročila (veriga MenuItem → Category → Menu → locationId).
  // Prej: where { id: { in } } BREZ scopa = cross-tenant injekcija artiklov
  // (naročilo lokacije A je lahko vsebovalo artikle lokacije B!).
  const menuItemIds = data.orderItems.map(item => item.menuItemId)
  const menuItems = await db.menuItem.findMany({
    where: {
      id: { in: menuItemIds },
      ...(orderLocationId ? { category: { menu: { locationId: orderLocationId } } } : {}),
    },
    select: { id: true, vatRate: true, price: true },
  })
  const vatMap = new Map(menuItems.map(mi => [mi.id, mi]))

  // Preveri, da vsi artikli obstajajo (in so na pravi lokaciji)
  const missingItem = validateMenuItems(data.orderItems, vatMap)
  if (missingItem) {
    return NextResponse.json(
      { error: `Artikel ${missingItem} ni najden ali ni na voljo na tej lokaciji` },
      { status: 400 }
    )
  }

  // ─── PREVERI RAZPOLŽLJIVOST ZALOGE (opozorilo, ne blokada) ───
  const stockCheck = await checkStockAvailability(
    data.orderItems.map(item => ({
      menuItemId: item.menuItemId,
      quantity: item.quantity,
    }))
  )

  // Izračun z multi-DDV po stopnjah (strežniška stran — edini vir resnice)
  const { orderItemsData, subtotal } = buildOrderItemsData(data.orderItems, vatMap, data.discount || 0)
  const { totalTax, totalDiscountAmount, total } = calculateOrderTotals(orderItemsData, subtotal)

  // FIX BUG-02: Ustvari naročilo in posodobi mizo v eni transakciji
  // FIX CRITICAL (Test 3.2): Dodan idempotencyKey v create + try-catch za P2002 (unique violation)
  let order
  try {
    order = await db.$transaction(async (tx) => {
      const newOrder = await tx.order.create({
        data: {
          orderNumber,
          idempotencyKey, // FIX Test 3.2: unikatni ključ za deduplikacijo
          type: data.type,
          status: 'pending',
          tableId: data.tableId || null,
          diningOptionId: data.diningOptionId || null,
          revenueCenterId: data.revenueCenterId || null,
          customerName: data.customerName,
          customerPhone: data.customerPhone,
          customerEmail: data.customerEmail || '', // FIX MEDIUM: Shrani e-pošto stranke
          subtotal,
          tax: totalTax,
          discount: totalDiscountAmount,
          total,
          tip: toNum(data.tip),
          totalWithTip: total + toNum(data.tip),
          paymentStatus: 'unpaid',
          paymentMethod: '',
          notes: data.notes,
          employeeId: data.employeeId || authSession.session?.employeeId || null,
          inventoryDeducted: false,
          // P1-6: lokacija naročila — resolvirana server-side (session/miza/fallback),
          // nikoli iz bodyja (tenant isolation: body ni vir zaupanja)
          locationId: orderLocationId,
          orderItems: {
            // OrderItemData matches unchecked create input
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          create: orderItemsData as any,
          },
        },
        include: {
          table: true,
          orderItems: { include: { menuItem: true } },
        },
      })

    // Posodobi mizo znotraj transakcije
    if (data.tableId && data.type === 'dine-in') {
      // FIX 500: Preveri ali miza obstaja preden jo posodobi.
      // Prej: tx.table.update({ where: { id: data.tableId } }) je vrnil P2025
      // če miza ne obstaja (npr. izbrisan medtem ko je bila v košarici).
      const tableExists = await tx.table.findUnique({ where: { id: data.tableId }, select: { id: true } })
      if (tableExists) {
        await tx.table.updateMany({ where: { id: data.tableId, status: { in: ["available", "occupied"] } }, data: { status: "occupied" } })
      }
      // Če miza ne obstaja, ignoriramo — naročilo se ustvari brez mize
    }

      return newOrder
    })
  } catch (error: unknown) {
    // FIX CRITICAL (Test 3.2): Race path — če sta 2 vzporedna requesta z istim idempotencyKey
    // in oba preverita "existing" preden prvi commit-ne, bo drugi dobil P2002 (unique violation).
    // V tem primeru poiščemo obstoječi rezultat in ga vrnemo (200, ne 500).
    if (isUniqueConstraintViolation(error)) {
      const existing = await findExistingOrderByIdempotencyKey(idempotencyKey)
      if (existing) {
        return NextResponse.json(deepToNumbers(existing), { status: 200 })
      }
    }
    throw error
  }

  // ─── SAMODEJNO RAZKNJIŽEVANJE ZALOGE OB ODDAJI NAROČILA ───
  const { stockDeducted } = await handleStockDeduction(
    order.id, order.orderNumber,
    data.orderItems.map(item => ({ menuItemId: item.menuItemId, quantity: item.quantity })),
  )

  // Sproži stranske učinke (WS, tisk, webhook, revizija)
  await handlePostCreationEffects(order, authSession.session?.employeeId, stockDeducted)

  // Vrni naročilo z informacijami o zalogi
  return NextResponse.json(deepToNumbers({
    ...order,
    _stockInfo: {
      deducted: stockDeducted,
      lowStockWarnings: stockCheck.warnings,
      stockUnavailable: stockCheck.warnings,
    },
  }), { status: 201 })
}
