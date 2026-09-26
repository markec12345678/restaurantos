// =====================================================================
// R136 (epic #115, P1-12): CUSTOMER-FACING DISPLAY — javna statusna tabla
// =====================================================================
// GET /api/public/display?locationId=... — READ-only seznam AKTIVNIH
// naročil za goste (tabla nad pulti / ob kiosku): številka naročila,
// status (pending/in-progress/ready), tip prevzema, številka mize.
//
// Varnostne lastnosti (GET-kiosk + availability R124b kanon):
//  - BREZ avtentikacije/tokena: READ-only pot z gost-VARNIM select
//    whitelistom (isti kanon kot GET /api/public/kiosk — pisna POST pot
//    kioska je token-bound, GET ostane anonimen). Token je vezava pisne
//    poverilnice; branje zbirke aktivnih čekov ne rabi poverilnice,
//    zaščita je whitelist + rate limit + fail-closed scope.
//  - PII kanon — select WHITELIST (R136-a audit Q7): samo orderNumber,
//    status, type, createdAt, table.number. IZKLJUČENO (nikoli v select):
//    customerName/customerPhone/customerEmail, guestId, notes (prosto
//    besedilo osebja — morebitna PII; 'miza N' marker je odveč, ker
//    tableNumber prihaja iz relacije), total/subtotal/tax/tip,
//    paymentStatus/paymentMethod, deliveryInfo, employeeId,
//    idempotencyKey, cancelledBy/cancelReason.
//  - Fail-closed lokacija: manjkajoč / neveljavna oblika / neznana /
//    tuja / neaktivna lokacija → IZKLJUČNO notInScopeResponse('Lokacija')
//    404 (zero-oracle — isti odgovor za vse rake, kiosk kanon :110-114;
//    manjkajoč parameter → 404 PRED vsakim db klicem, ZERO db).
//  - Anti-enumeracija: NIKOLI ?orderNumber= filtra ali lookupa po
//    posameznem naročilu — SAMO seznam aktivnih naročil lokacije
//    (per-order lookup bi javni poti razkril obstoj tujih čekov).
//  - DoS: rate limit PUBLIC_MENU_LIMIT 30/min/IP (bucket 'public-display')
//    + take cap 50 + 2h časovno okno (tabla kaže samo žive čeke).
//  - Cache-Control: no-store (R124b kanon — statusi so realno-časovni;
//    zastarela tabla bi goste zavajala pri prevzemu).
// =====================================================================

import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { checkRateLimitAsync, getClientIp, PUBLIC_MENU_LIMIT } from '@/lib/rate-limit'
import { rateLimitedResponse } from '@/lib/rate-limit/response'
import { handleApiError } from '@/lib/api-utils'
import { notInScopeResponse } from '@/lib/tenant-scope'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  // Rate limit — isti razred kot public menu/availability (javna anonimna
  // READ pot); bucket 'public-display' (ločeno vedro od 'kiosk-menu').
  const rl = await checkRateLimitAsync('public-display', getClientIp(req), PUBLIC_MENU_LIMIT)
  if (!rl.allowed) {
    return rateLimitedResponse(rl.retryAfterMs, 'Preveč zahtevkov. Poskusite znova čez nekaj sekund.')
  }

  try {
    const url = new URL(req.url)
    const locationId = url.searchParams.get('locationId')?.trim() || ''

    // Kiosk kanon :110-114: manjkajoč locationId → 404 PRED vsakim db
    // klicem (ZERO db — prej je kiosk klical resolveDefaultLocationId()
    // = prva aktivna lokacija KATEREGA KOLI tenanta).
    if (!locationId) {
      return notInScopeResponse('Lokacija')
    }
    // Ista oblika-validacija kot resolveKioskLocation (regex ni orakelj —
    // neujemajoča oblika dobi ISTI 404 kot neznana lokacija).
    if (!/^[a-z0-9]{5,50}$/i.test(locationId)) {
      return notInScopeResponse('Lokacija')
    }

    // Fail-closed lokacija (vzorec resolveKioskLocation :76-88):
    // obstaja + AKTIVEN; neznana/tuja/neaktivna → isti 404 (ni oraklja).
    const location = await db.location.findFirst({
      where: { id: locationId, isActive: true },
      select: { id: true },
    })
    if (!location) {
      return notInScopeResponse('Lokacija')
    }

    // PRISMA SELECT WHITELIST (PII kanon — glej glavo): samo guest-safe
    // polja. Anti-enumeracija: brez ?orderNumber= filtra. Zajem:
    //  - status in ['pending','in-progress','ready'] — realne vrednosti
    //    Order.status (R136-a audit Q1); completed/cancelled se na tabli
    //    NIKOLI ne prikažejo (isti razdelek kot KDS active/ready).
    //  - createdAt ≥ now-2h — zastareli čeki ne smetijo table.
    //  - take 50 + orderBy createdAt asc — stabilen FIFO prikaz.
    const orders = await db.order.findMany({
      where: {
        locationId,
        status: { in: ['pending', 'in-progress', 'ready'] },
        createdAt: { gte: new Date(Date.now() - 2 * 60 * 60 * 1000) },
      },
      orderBy: [{ createdAt: 'asc' }],
      take: 50,
      select: {
        orderNumber: true,
        status: true,
        type: true,
        createdAt: true,
        table: { select: { number: true } },
      },
    })

    // Mapiranje: tableNumber izvlečen (Table.number Int), table objekt
    // NE uhaja v payload — odgovor nosi flat guest-safe vrstice.
    const payload = orders.map(o => ({
      orderNumber: o.orderNumber,
      status: o.status,
      type: o.type,
      tableNumber: o.table?.number ?? null,
      createdAt: o.createdAt,
    }))

    // R124b kanon: no-store — tabla polla realno-časovne statuse.
    return NextResponse.json(
      { orders: payload, timestamp: new Date().toISOString() },
      { headers: { 'Cache-Control': 'no-store' } },
    )
  } catch (error: unknown) {
    return handleApiError(error, 'GET /api/public/display', 'Napaka pri pridobivanju statusov naročil')
  }
}
