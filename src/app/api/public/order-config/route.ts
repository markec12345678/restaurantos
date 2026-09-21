
// =====================================================================
// PUBLIC ORDER CONFIG — Nastavitve za online naročanje
// Vrne: lokacijo, cone dostave, delovni čas, ali je odprto
// GET /api/public/order-config?locationId=<id>&t=<ordering-token>
// FIX CRITICAL: Rate limiting za preprečitev zlorabe
// FIX HIGH: Ne izpostavljaj internih ID-jev v javnem API-ju (R89 IZJEMA:
//           locationId gre v response — klicatelj ga že ima iz deep linka
//           (?loc=), /order frontend pa potrebuje id za POST body)
// R89: ENUMERACIJA ZAPRTA — config je na voljo SAMO za token-proven
//      lokacijo (R88/R89 HMAC ordering token, vezava locationId +
//      tokenVersion). Prej je ruta vračala VSE aktivne lokacije VSEH
//      tenantov (imena, kode, naslovi, isOpen) vsakemu anonimnemu
//      klicatelju — zadnja anonimna enumeracijska površina (R88 backlog).
//      Brez konteksta / neznana lokacija / slab token / zastarel token /
//      produkcija brez skrivnosti → ISTA prazna konfiguracija (200,
//      fail-closed, NI obstoja-oraklja; manjkajoč kontekst = ZERO db).
// =====================================================================

import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { checkRateLimitAsync, getClientIp, ORDER_CONFIG_LIMIT } from '@/lib/rate-limit'
import { rateLimitedResponse } from '@/lib/rate-limit/response'
import { toNum } from '@/lib/decimal'
import { handleApiError } from '@/lib/api-utils'
// R89: HMAC ordering token (R88 lib; R89 tokenVersion vezava — R89-1 kanon)
import { isOrderingSecretConfigured, verifyOrderingToken } from '@/lib/ordering-token'

export const dynamic = 'force-dynamic'

// R89: prazna konfiguracija — ISTA oblika za "manjkajoč kontekst",
// "neznana/neaktivna lokacija", "neveljaven/tuj/zastarel token" in
// "produkcija brez skrivnosti" (ni obstoja-oraklja, ni razlikovanja primerov).
const EMPTY_ORDER_CONFIG = {
  locations: [],
  selectedLocationCode: null,
  deliveryZones: [],
  isOpenNow: false,
  weeklyHours: [],
  settings: null,
  // R89: metapodatki za frontend state machine — true = klicatelj nima
  // token-provenega konteksta (UI pokaže "naročanje po povezavi" empty state)
  requiresToken: true,
  locationId: null,
} as const

// R89: prazna konfiguracija je VEDNO 200 (graceful empty, NE 503) — bralni
// GET config ne sme poknjičiti javnega UI-ja s 5xx; razlika do pisnih poti
// (online-order), kjer je produkcija-brez-skrivnosti 503 fail-closed kanon.
function emptyOrderConfigResponse() {
  return NextResponse.json(EMPTY_ORDER_CONFIG)
}

export async function GET(req: Request) {
  // FIX CRITICAL: Rate limiting (nespremenjeno)
  const clientIp = getClientIp(req)
  const rateCheck = await checkRateLimitAsync('order-config', clientIp, ORDER_CONFIG_LIMIT)
  if (!rateCheck.allowed) {
    return rateLimitedResponse(rateCheck.retryAfterMs, 'Preveč zahtevkov. Poskusite znova čez nekaj sekund.')
  }

  try {
    // R89: kontekst — ciljna lokacija (?locationId=, legacy ?locationCode=)
    // + ordering token (?t=, deep link iz GET /api/locations/[id]/ordering-token)
    const url = new URL(req.url)
    const paramLocationId = url.searchParams.get('locationId')?.trim() || ''
    const paramLocationCode = url.searchParams.get('locationCode')?.trim() || ''
    const token = url.searchParams.get('t')?.trim() || ''

    // R89: manjkajoč kontekst → prazna konfiguracija, ZERO db klicev
    // (anonimen klicatelj ne sproži nobene poizvedbe — konec enumeracije)
    if ((!paramLocationId && !paramLocationCode) || !token) {
      return emptyOrderConfigResponse()
    }

    // R89 (R82-D kanon): produkcija brez ORDERING_TOKEN_SECRET /
    // QR_PAY_SECRET / ENCRYPTION_KEY / NEXTAUTH_SECRET → prazna
    // konfiguracija (graceful empty — verify bi sicer vrgel izjemo; GET
    // ne vrača 503, da javni UI ne pride do 5xx). Ni razlike do ostalih
    // praznih primerov (ni oraklja o stanju produkcije).
    if (process.env.NODE_ENV === 'production' && !isOrderingSecretConfigured()) {
      return emptyOrderConfigResponse()
    }

    // R89: ciljna lokacija — izrecna iskalna poizvedba (findFirst) namesto
    // prejšnjega findMany vseh aktivnih lokacij. Neznana / neaktivna → ISTA
    // prazna konfiguracija (ni obstoja-oraklja). tokenVersion gre v select
    // za R89 verzjsko vezavo tokena (?? 0 varovalka — R89-1 route kanon).
    const locationSelect = {
      id: true,
      name: true,
      code: true,
      address: true,
      city: true,
      phone: true,
      isOpen: true,
      latitude: true,
      longitude: true,
      tokenVersion: true,
    } as const
    const location = paramLocationId
      ? await db.location.findFirst({ where: { id: paramLocationId, isActive: true }, select: locationSelect })
      : await db.location.findFirst({ where: { code: paramLocationCode, isActive: true }, select: locationSelect })
    if (!location) {
      return emptyOrderConfigResponse()
    }

    // R89: token je OBVEZEN in vezan na TOČNO TO lokacijo + njeno TRENUTNO
    // tokenVersion (revokacija = rotate verzije, R89-1). Manjkajoč /
    // napačen format / tuj / zastarel token → ISTA prazna konfiguracija
    // (ni razlike "manjka" vs "tuj" — ni oraklja). cone/urniki/nastavitve
    // se pri zavrnitvi NE poizvedo.
    if (!verifyOrderingToken(token, location.id, location.tokenVersion ?? 0)) {
      return emptyOrderConfigResponse()
    }

    // === Token-proveno: config scoped na TOČNO TO lokacijo ===

    // Cone dostave — scoped na ciljno lokacijo (R83 vedenje, zdaj vedno izrecno)
    const deliveryZones = await db.deliveryZone.findMany({
      where: { isActive: true, locationId: location.id },
      orderBy: { sortOrder: 'asc' },
    })

    // Delovni čas — scoped na ciljno lokacijo
    const openingHours = await db.openingHours.findMany({
      where: { locationId: location.id },
      orderBy: { dayOfWeek: 'asc' },
    })

    // Nastavitve restavracije (globalne nastavitve prikaza — nespremenjeno)
    const settings = await db.restaurantSettings.findFirst({
      where: { isActive: true },
      select: {
        name: true,
        address: true,
        city: true,
        phone: true,
        currency: true,
      },
    })

    // Izračunaj ali je trenutno odprto (nespremenjena logika iz R83)
    const now = new Date()
    const dayOfWeek = now.getDay() // 0=nedelja
    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`

    const todayHours = openingHours.find(h => h.dayOfWeek === dayOfWeek)
    let isOpenNow = false

    if (todayHours) {
      if (todayHours.isClosed) {
        isOpenNow = false
      } else {
        isOpenNow = currentTime >= todayHours.openTime && currentTime <= todayHours.closeTime
        if (todayHours.breakStart && todayHours.breakEnd) {
          if (currentTime >= todayHours.breakStart && currentTime <= todayHours.breakEnd) {
            isOpenNow = false
          }
        }
      }
    } else {
      isOpenNow = true // Privzeto odprto če ni definiranega urnika
    }

    // Delovni čas po dnevih za prikaz
    const dayNames = ['Nedelja', 'Ponedeljek', 'Torek', 'Sreda', 'Četrtek', 'Petek', 'Sobota']
    const weeklyHours = dayNames.map((day, idx) => {
      const hours = openingHours.find(h => h.dayOfWeek === idx)
      if (!hours || hours.isClosed) {
        return { day, isClosed: true, openTime: '', closeTime: '' }
      }
      return {
        day,
        isClosed: false,
        openTime: hours.openTime,
        closeTime: hours.closeTime,
        breakStart: hours.breakStart || '',
        breakEnd: hours.breakEnd || '',
      }
    })

    return NextResponse.json({
      // FIX HIGH + R89: ena sama lokacija (token-provena). IZJEMA od "brez
      // internih ID-jev": locationId gre v entry — klicatelj ga že ima iz
      // deep linka (?loc=) in /order frontend potrebuje id za POST body
      // locationId. Telefon, koordinate, zone.id, zone.locationId in raw
      // Decimal polja ostanejo odstranjeni (kot doslej).
      locations: [{
        locationId: location.id,
        code: location.code,
        name: location.name,
        address: location.address,
        city: location.city,
        isOpen: location.isOpen,
      }],
      // R83: katera lokacija je bila uporabljena za urnik/cone (zdaj vedno ciljna)
      selectedLocationCode: location.code,
      // FIX HIGH + R83: Ne izpostavljaj zone.id, locationId, raw Decimal polj
      deliveryZones: deliveryZones.map(z => ({
        name: z.name,
        deliveryFee: toNum(z.deliveryFee),
        minOrderAmount: toNum(z.minOrderAmount),
        freeDeliveryAbove: toNum(z.freeDeliveryAbove),
        estimatedMinutes: z.estimatedMinutes,
        // R89: cone so scoped na ciljno lokacijo → koda je vedno ciljna
        locationCode: location.code,
      })),
      isOpenNow,
      weeklyHours,
      settings: settings ? {
        name: settings.name,
        address: settings.address,
        city: settings.city,
        currency: settings.currency,
      } : null,
      // R89: token-gating metapodatki (frontend state machine + klicatelj)
      requiresToken: false,
      locationId: location.id,
    })
  } catch (error: unknown) {
    return handleApiError(error, 'GET /api/public/order-config', 'Napaka pri pridobivanju nastavitev')
  }
}
