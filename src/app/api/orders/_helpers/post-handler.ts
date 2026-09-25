// POST handler logika za orders API — ustvarjanje naročila

import { db } from '@/lib/db'
import { toNum, deepToNumbers } from '@/lib/decimal'
import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { getNextOrderNumber } from '@/lib/counters' // R88-3: resolveDefaultLocationId (globalni fallback) odstranjen
import { createOrderSchema } from '@/lib/validations'
import { checkStockAvailability } from '@/lib/stock-deduction'
import { validateRequest } from '@/lib/api-utils'
import { buildOrderItemsData, calculateOrderTotals, validateMenuItems, fetchModifierPriceMap, type MenuItemVatMap } from './order-items'
import { handleStockDeduction, handlePostCreationEffects } from './stock'
import { withLocationColumnFallback } from '@/lib/prisma-column-fallback'
// R128 (P0-5): best-effort offline ledger — zapis DeviceSyncOperation ob uspehu,
// kadar zahtevek prihaja iz offline vrste naprave (x-offline-sync headerji).
import { recordOfflineOrderLedger } from './offline-ledger'

// P1-6: session kontekst, ki ga POST pot potrebuje za resolucijo lokacije
// R88-3: + scope (rezultat resolveTenantLocationIdOrThrow v routi — obvezen
// za pisno pot) + searchParams (izrecni ?locationId super-admina).
export interface PostOrderAuthSession {
  session?: {
    employeeId?: string
    locationId?: string | null
    role?: string
  } | null
  /** R88-3: { locationId } iz resolveTenantLocationIdOrThrow (POST /api/orders). */
  scope?: { locationId: string | null }
  /** R88-3: query parametri requesta (eksplicitni ?locationId super-admina). */
  searchParams?: URLSearchParams | null
}

/**
 * P1-6: Resolviraj locationId za novo naročilo (server-side — body.locationId
 * se NE zaupa). R88-3: GLOBALNI fallback (resolveDefaultLocationId — prva
 * aktivna lokacija KATEREGA KOLI tenanta) je ODSTRANJEN; naročilo NIKOLI ne
 * dobi lokacije, do katere klicatelj ni upravičen:
 *   a. session.locationId vs. miza (tableId → Table.locationId) — mismatch
 *      → 400 (IDOR zaščita: natakar lokacije A ne more ustvariti naročila na
 *      mizi lokacije B; nespremenjeno).
 *   b. scope.locationId iz seje (regular / admin-with-location) = AVTORITATIVEN
 *      — miza je že preverjena v (a).
 *   c. super-admin (session.locationId === null): kandidat = miza ?? izrecni
 *      ?locationId — VEDNO validiran (obstaja + aktiven); brez kandidata → 400
 *      (fail-closed, ne globalno ugibanje).
 */
async function resolveOrderLocationId(
  tableId: string | null | undefined,
  sessionLocationId: string | null | undefined,
  scope?: { locationId: string | null },
  searchParams?: URLSearchParams | null,
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

  const scopeLoc = scope?.locationId ?? null

  // (b) Lokacija iz seje — regular user / admin-with-location (scope jo
  //     prevzame iz session.locationId; obstoječa IDOR zaščita (a) že pokriva mizo).
  if (scopeLoc && scopeLoc === sessionLoc) {
    return { ok: true, locationId: scopeLoc }
  }
  // Defensive: klicatelj brez scope-a, a z dodeljeno session lokacijo —
  // enakovredno (b) (skozr router ni dosegljivo; resolver vedno podaja scope).
  if (sessionLoc && !scopeLoc) {
    return { ok: true, locationId: sessionLoc }
  }

  // (c) Super-admin (session.locationId === null): miza ZMAGA nad izrecnim
  //     ?locationId (fizična realnost naročila). Kandidat je VEDNO validiran.
  const explicitQueryLoc = searchParams?.get('locationId') ?? searchParams?.get('branchId') ?? null
  const candidate = tableLocationId ?? scopeLoc ?? explicitQueryLoc
  if (candidate) {
    const location = await db.location.findFirst({
      where: { id: candidate, isActive: true },
      select: { id: true },
    })
    if (!location) {
      return { ok: false, error: 'Lokacija ni najdena' }
    }
    return { ok: true, locationId: candidate }
  }

  // R88-3: fail-closed — brez globalnega ugibanja (prej: resolveDefaultLocationId
  // = prva aktivna lokacija katerega koli tenanta). Super-admin MORA podati
  // mizo ali izrecen ?locationId.
  return {
    ok: false,
    error:
      'locationId je obvezen: seja nima dodeljene lokacije — podaj tableId ali izrecen ?locationId (super-admin).',
  }
}

// FIX CRITICAL (Test 3.2): Poišči obstoječe naročilo po idempotencyKey
// Če klient pošlje isti idempotencyKey 2× (double-click, React Query retry,
// network reconnect), vrni obstoječi rezultat namesto da ustvarimo duplikat.
// R116 (P0 tenant boundary): replay je VEDNO vezan na lokacijo naročila.
// Prej je bil lookup GLOBALNI ({ idempotencyKey } brez lokacije) in je tekel
// PRED resolucijo lokacije: uporabnik lokacije B s ključem naročila lokacije A
// je prejel CELOTEN tuj order (orderNumber/total/PII/table/orderItems) —
// fast-path leak. P2002 race path je imel isti problem (globalni @unique na
// Order.idempotencyKey → cross-location create dobi P2002 → unscoped lookup
// → tuj order). Kanon je enak kot R82-C (mobile/order) in R83 (kiosk):
// scoped replay + generičen 409 za ključ tuje lokacije (nikoli podatkov).
async function findExistingOrderByIdempotencyKey(idempotencyKey: string, locationId: string) {
  return db.order.findFirst({
    where: { idempotencyKey, locationId },
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

  // R116 (P0 tenant boundary): lokacija se resolvira PRED idempotency
  // fast-pathom (read-only) — replay NIKOLI ne more obiti tenant/location
  // scope preverjanja. Prej je bil fast-path PRVI: globalni lookup s tujim
  // ključem je vrnil naročilo druge lokacije, še pred IDOR preverjanjem mize.
  // P1-6/R88-3: Resolviraj lokacijo naročila (scope iz seje → miza → izrecni
  // ?locationId super-admina, vse validirano). Naročilo brez lokacije je
  // izgubljeno za tenant-scoped poizvedbe (GET /api/orders z where locationId
  // ne bi videl NULL vrstic) — zato resolucija pred kreiranjem. Globalni
  // resolveDefaultLocationId fallback je odstranjen (R88-3).
  const locationResolution = await resolveOrderLocationId(
    data.tableId || null,
    authSession.session?.locationId,
    authSession.scope,
    authSession.searchParams ?? null,
  )
  if (!locationResolution.ok) {
    return NextResponse.json({ error: locationResolution.error }, { status: 400 })
  }
  const orderLocationId = locationResolution.locationId

  // FIX CRITICAL (Test 3.2): Fast path — če naročilo z tem idempotencyKey že
  // obstaja NA TEJ LOKACIJI, ga vrni (R116: scoped — tuj ključ = ni replay-a).
  const existing = await findExistingOrderByIdempotencyKey(idempotencyKey, orderLocationId)
  if (existing) {
    // R128 (P0-5): offline replay — 200 z istim body-jem + ledger 'duplicate'
    await recordOfflineOrderLedger(req, {
      orderId: existing.id, idempotencyKey, status: 'duplicate',
      locationId: orderLocationId,
      employeeId: authSession.session?.employeeId, payload: data,
    })
    return NextResponse.json(deepToNumbers(existing), { status: 200 })
  }

  // MODEL A (#8 tenant scope audit 2026-09-09): DiningOption in RevenueCenter
  // iz bodyja sta FK referenci — preverita se proti lokaciji naročila.
  // DiningOption nosi taxRateId/serviceChargeId (DDV override + servisna
  // postavka!): cross-tenant referenca = napačen DDV na fiskalnem računu.
  // Prej:šel je skrivaj skozi brez preverjanja (samo FK obstoj).
  if (data.diningOptionId) {
    const diningOptionId = data.diningOptionId // closure narrowing
    // FIX QA runda 39: DiningOption tabela nima locationId stolpca v Neonu (P1054) —
    // most: pri P1054 ponovi brez lokacijskega filtra (sicer VSAKO naročilo z
    // diningOptionId → 500!). Trajna rešitev: prisma db push.
    const diningOptionInScope = await withLocationColumnFallback('order:diningOption-scope', (withLoc) =>
      db.diningOption.findFirst({
        where: withLoc ? { id: diningOptionId, locationId: orderLocationId } : { id: diningOptionId },
        select: { id: true },
      }))
    if (!diningOptionInScope) {
      return NextResponse.json(
        { error: 'Dining option ni na voljo na tej lokaciji' },
        { status: 400 }
      )
    }
  }
  if (data.revenueCenterId) {
    const revenueCenterId = data.revenueCenterId // closure narrowing
    const revenueCenterInScope = await withLocationColumnFallback('order:revenueCenter-scope', (withLoc) =>
      db.revenueCenter.findFirst({
        where: withLoc ? { id: revenueCenterId, locationId: orderLocationId } : { id: revenueCenterId },
        select: { id: true },
      }))
    if (!revenueCenterInScope) {
      return NextResponse.json(
        { error: 'Revenue center ni na voljo na tej lokaciji' },
        { status: 400 }
      )
    }
  }

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
  const vatMap = new Map<string, MenuItemVatMap>(menuItems.map(mi => [mi.id, mi]))

  // FIX BUG-13: DB cene modifierjev (server-authoritative) — sicer bi bila postavka
  // zaračunana po osnovni ceni brez dodatkov (npr. "Srednja (30cm) +3,00 €").
  const modifierPriceMap = await fetchModifierPriceMap(menuItemIds, orderLocationId, db)
  for (const [miId, modPrices] of modifierPriceMap) {
    const entry = vatMap.get(miId)
    if (entry) entry.modifierPrices = modPrices
  }

  // Preveri, da vsi artikli obstajajo (in so na pravi lokaciji)
  const missingItem = validateMenuItems(data.orderItems, vatMap)
  if (missingItem) {
    return NextResponse.json(
      { error: `Artikel ${missingItem} ni najden ali ni na voljo na tej lokaciji` },
      { status: 400 }
    )
  }

  // ─── PREVERI RAZPOLŽLJIVOST ZALOGE ───
  // R124 (P0-03, kanon): STREŽNIŠKA BLOKADA izprodanih artiklov.
  // Prej: "opozorilo, ne blokada" — naročilo je STALO tudi brez zaloge
  // (oversell: POS je prikazoval NI ZALOGE, order pa je bil vseeno ustvarjen
  // in poslan v kuhinjo). Kanon P0-03: "brez prodaje artikla, ki je
  // globalno označen kot nedobavljiv, RAZEN če je eksplicitno dovoljeno".
  // Eksplicitno dovoljenje = data.allowOutOfStock (fail-closed default false).
  // Race zaščita: zadnji kosi pokrije zelo isto preverjanje kot dedukcija
  // (RAW semantika R123: needed == deducted); atomna dedukcija ostane
  // avtoritativna pri konkurenci.
  const stockCheck = await checkStockAvailability(
    data.orderItems.map(item => ({
      menuItemId: item.menuItemId,
      quantity: item.quantity,
    }))
  )

  if (stockCheck.warnings.length > 0 && !data.allowOutOfStock) {
    // Deduplikacija po artikel (več sestavin istega artikla = en vnos)
    const soldOutMap = new Map<string, {
      menuItemId: string
      itemName: string
      ingredientName: string
      needed: number
      available: number
      unit: string
    }>()
    for (const w of stockCheck.warnings) {
      const prev = soldOutMap.get(w.menuItemId)
      if (!prev || w.available < prev.available) soldOutMap.set(w.menuItemId, w)
    }
    const soldOutItems = Array.from(soldOutMap.values())
    const names = soldOutItems.map(i => i.itemName).join(', ')
    return NextResponse.json(
      {
        error: `Artikli brez zadostne zaloge: ${names}. Zaloga se je spremenila — odstranite izprodane artikle ali uporabite odobritev prodaje.`,
        soldOutItems: soldOutItems.map(i => ({
          menuItemId: i.menuItemId,
          itemName: i.itemName,
          ingredientName: i.ingredientName,
          needed: i.needed,
          available: i.available,
          unit: i.unit,
        })),
      },
      { status: 409 }
    )
  }

  // Izračun z multi-DDV po stopnjah (strežniška stran — edini vir resnice)
  const { orderItemsData, subtotal } = buildOrderItemsData(data.orderItems, vatMap, data.discount || 0)
  const { totalTax, totalDiscountAmount, total } = calculateOrderTotals(orderItemsData, subtotal)

  // FIX BUG-02: Ustvari naročilo in posodobi mizo v eni transakciji
  // FIX CRITICAL (Test 3.2): Dodan idempotencyKey v create + try-catch za P2002 (unique violation)
  let order
  try {
    order = await db.$transaction(async (tx) => {
      // R115 (P0 firedAt source-of-truth): Sales "Oddaj naročilo" JE trenutek
      // pošiljanja v kuhinjo za ta endpoint — kuhinja je obveščena TIK PO tej
      // kreaciji (handlePostCreationEffects → autoPrintKitchenOrder tisk kuhinjskega
      // lista + WS NEW_ORDER + push notifyNewOrder), KDS pa prikazuje 'pending'
      // naročila. Prej je firedAt ostal null → KDS časovnik "--:--" (R114 display
      // fallback), waiter elapsed=0 in operational-alerts "zakasnela naročila"
      // NIKOLI niso zajela Sales naročil. Semantika firedAt (schema FIX WORKFLOW-2:
      // "čas, kdaj je naročilo poslano v kuhinjo") je ohranjena — nastavimo istega
      // trenutka kot ob fire akciji. Idempotency replay (P2002) vrne obstoječo
      // vrstico s PVODNO vrednostjo — dvopisem ne nastane. Eksplicitni fire
      // (re-fire) firedAt kasneje prezapiše (obstoječa semantika re-fire-a).
      const firedAt = new Date()

      // R134 (P1-10, kanon 3): TOKI (courses) — opt-in aditivno. ČE ima vsaj 1
      // artikel courseNumber → v ISTI transakciji: itemi BREZ courseNumber dobijo
      // default 3 ('Glavna jed'), za vsako distinktno številko nastane Course
      // vrstica (status 'pending', kanonsko ime) + orderItem.courseId wiring.
      // Itemi so v course poti ustvarjeni EKSPPLICITNO (ne nested), da je wiring
      // determinističen (nested create ne garantira vrstnega reda vrstic v
      // odgovoru). ČE nihče nima courseNumber → nested create BIT-FOR-BIT legacy
      // (0 Course vrstic, 0 sprememb v odgovoru).
      const hasCourses = data.orderItems.some(it => it.courseNumber !== undefined)

      // Unchecked variant: scalar FK (tableId/diningOptionId/revenueCenterId/
      // employeeId/locationId) namesto nested relation connect-ov
      const orderCreateData: Prisma.OrderUncheckedCreateInput = {
        orderNumber,
        idempotencyKey, // FIX Test 3.2: unikatni ključ za deduplikacijo
        type: data.type,
        status: 'pending',
        firedAt,
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
        // R134: nested create SAMO v legacy poti (nihče nima courseNumber);
        // course pot ustvari iteme eksplicitno spodaj (determinističen courseId
        // wiring). undefined = Prisma polje tretira kot nepodano.
        orderItems: hasCourses ? undefined : {
          // OrderItemData matches unchecked create input
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          create: orderItemsData as any,
        },
      }

      const newOrder = await tx.order.create({
        data: orderCreateData,
        include: {
          table: true,
          orderItems: { include: { menuItem: true } },
        },
      })

      let txOrder = newOrder

      // R134: course wiring — V ISTI transakciji kot order + itemi (atomarnost).
      if (hasCourses) {
        // Kanonska imena tokov (kontrakt R134): 1='Predjed', 2='Juha',
        // 3='Glavna jed', 4='Sladica', >=5='Tok {n}'.
        const canonicalCourseNames: Record<number, string> = {
          1: 'Predjed',
          2: 'Juha',
          3: 'Glavna jed',
          4: 'Sladica',
        }
        // Itemi brez explicitnega courseNumber dobijo default 3 ('Glavna jed').
        const itemCourseNumbers = data.orderItems.map(it => it.courseNumber ?? 3)
        const distinctNumbers = Array.from(new Set(itemCourseNumbers)).sort((a, b) => a - b)
        const courseIds = new Map<number, string>()
        for (const n of distinctNumbers) {
          const course = await tx.course.create({
            data: {
              orderId: newOrder.id,
              courseNumber: n,
              name: canonicalCourseNames[n] ?? `Tok ${n}`,
              status: 'pending',
            },
          })
          courseIds.set(n, course.id)
        }
        for (let i = 0; i < orderItemsData.length; i++) {
          await tx.orderItem.create({
            // OrderItemData matches unchecked create input (isti cast kot legacy)
            data: {
              ...orderItemsData[i],
              orderId: newOrder.id,
              courseId: courseIds.get(itemCourseNumbers[i]) ?? null,
            } as any, // eslint-disable-line @typescript-eslint/no-explicit-any
          })
        }
        // Osveži odgovor: itemi zdaj nosijo courseId (+ aditivno `courses`).
        // Enaka vključenost kot legacy pot (table + orderItems.menuItem).
        const fresh = await tx.order.findUnique({
          where: { id: newOrder.id },
          include: {
            table: true,
            orderItems: { include: { menuItem: true } },
            courses: true,
          },
        })
        if (fresh) txOrder = fresh
      }

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

      return txOrder
    })
  } catch (error: unknown) {
    // FIX CRITICAL (Test 3.2): Race path — če sta 2 vzporedna requesta z istim idempotencyKey
    // in oba preverita "existing" preden prvi commit-ne, bo drugi dobil P2002 (unique violation).
    // V tem primeru poiščemo obstoječi rezultat in ga vrnemo (200, ne 500).
    if (isUniqueConstraintViolation(error)) {
      // R116 (P0 tenant boundary): replay lookup je SCOPED na lokacijo —
      // P2002 + scoped miss pomeni, da je ključ vezan na DRUGO lokacijo
      // (globalni @unique na Order.idempotencyKey; (locationId, orderNumber)
      // trk je nemogoč — getNextOrderNumber je ena atomarna SQL izjava).
      // NIKOLI ne vrnemo tujega naročila — generičen 409 (isti kanon kot
      // R82-C mobile/order in R83 kiosk; brez podatkov o tujem orderju).
      const existing = await findExistingOrderByIdempotencyKey(idempotencyKey, orderLocationId)
      if (existing) {
        // R128 (P0-5): tudi P2002 race replay nosi offline ledger 'duplicate'
        await recordOfflineOrderLedger(req, {
          orderId: existing.id, idempotencyKey, status: 'duplicate',
          locationId: orderLocationId,
          employeeId: authSession.session?.employeeId, payload: data,
        })
        return NextResponse.json(deepToNumbers(existing), { status: 200 })
      }
      return NextResponse.json(
        { error: 'Naročilo s tem ključem že obstaja' },
        { status: 409 },
      )
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

  // R128 (P0-5): offline uspeh — 201 + ledger 'applied' (best-effort)
  await recordOfflineOrderLedger(req, {
    orderId: order.id, idempotencyKey, status: 'applied',
    locationId: orderLocationId,
    employeeId: authSession.session?.employeeId, payload: data,
  })

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
