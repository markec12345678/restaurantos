// POST /api/setup/init — Inicializiraj sistem
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { checkRateLimitAsync, getClientIp, SETUP_LIMIT } from '@/lib/rate-limit'
import { rateLimitedResponse } from '@/lib/rate-limit/response'
import { withLocationColumnFallback } from '@/lib/prisma-column-fallback'
import { handleApiError, parseJsonBody } from '@/lib/api-utils'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import { PIN_MIN_LENGTH, WEAK_PINS, BCRYPT_ROUNDS } from '@/lib/auth-middleware/constants'
import { requireEnvSecret } from '@/lib/crypto/secrets'
import { applyStarterCatalog } from '@/lib/onboarding/catalog-templates/apply-starter-catalog'
import { getStarterTemplate, VENUE_TYPE_IDS } from '@/lib/onboarding/catalog-templates'
import type { VenueType } from '@/lib/onboarding/catalog-templates'

export const dynamic = 'force-dynamic'

const setupSchema = z.object({
  mode: z.enum(['single', 'multi']).default('single'),
  adminName: z.string().min(2, 'Ime admina je obvezno').max(100),
  adminEmail: z.string().email('Veljaven e-poštni naslov je obvezen'),
  // P1-12: novi PIN-i 6+ mest + šibki PIN-i zavrnjeni spodaj v handler-ju
  adminPin: z.string().min(PIN_MIN_LENGTH, `PIN mora imeti vsaj ${PIN_MIN_LENGTH} števk`).max(20).regex(/^\d+$/, 'PIN mora vsebovati samo številke'),
  locationName: z.string().min(2, 'Ime lokacije je obvezno').max(100),
  locationCode: z.string().min(2, 'Koda lokacije je obvezna').max(10).toUpperCase(),
  locationAddress: z.string().max(200).default(''),
  locationCity: z.string().max(100).default(''),
  locationPostCode: z.string().max(20).default(''),
  locationPhone: z.string().max(30).default(''),
  locationEmail: z.string().email().optional().or(z.literal('')),
  businessId: z.string().max(20).default(''),
  taxId: z.string().max(20).default(''),
  registerNumber: z.string().max(20).default(''),
  fursEnvironment: z.enum(['test', 'production']).default('test'),
  restaurantName: z.string().min(2, 'Ime restavracije je obvezno').max(100),
  // NOVO (issue #114): first-run onboarding — tip lokala določi starter katalog.
  // Opcijsko: manjkajoč venueType = starejša privzeta ponudba (back-compat).
  venueType: z.enum(VENUE_TYPE_IDS).optional(),
  // 'starter' (default) = ustvari starter katalog; 'empty' = brez artiklov
  // (POS pokaže onboarding empty state s ponudbo starter kataloga).
  catalogMode: z.enum(['starter', 'empty']).default('starter'),
})

export async function POST(req: Request) {
  try {
    // R83 fix: rate limit — prej je bil anonimen klic BREZ omejitve (bcrypt
    // cost 12 = CPU DoS vektor + first-caller-wins bootstrap race)
    const rl = await checkRateLimitAsync('setup-init', getClientIp(req), SETUP_LIMIT)
    if (!rl.allowed) {
      return rateLimitedResponse(rl.retryAfterMs, 'Preveč zahtevkov. Poskusite znova čez nekaj minut.')
    }

    const bodyResult = await parseJsonBody(req)
    if (bodyResult.error) return bodyResult.error

    const { data, error } = setupSchema.safeParse(bodyResult.data)
    if (error) {
      return NextResponse.json(
        { error: 'Neveljavni podatki', validationErrors: error.issues },
        { status: 400 }
      )
    }

    const existingEmployees = await db.employee.count()
    if (existingEmployees > 0) {
      return NextResponse.json(
        { error: 'Sistem je že inicializiran. Uporabite admin prijavo.' },
        { status: 409 }
      )
    }

    // P1-12: šibki PIN-i (sekvence/ponovitve) se zavrnejo tudi pri setup-u
    if (WEAK_PINS.has(data.adminPin)) {
      return NextResponse.json(
        { error: 'PIN je preveč predvidljiv (šibek). Izberite naključnejši PIN.' },
        { status: 400 }
      )
    }

    // 1. Admin
    // P1-12: BCRYPT_ROUNDS (12) namesto 10
    const pinHash = await bcrypt.hash(data.adminPin, BCRYPT_ROUNDS)
    // P1 (seed & konfig): brez 'fallback-secret' konstante — v produkciji
    // OBVEZNO NEXTAUTH_SECRET (sicer napadalec izračuna pinLookup offline)
    let nextauthSecret: string
    try {
      nextauthSecret = requireEnvSecret('NEXTAUTH_SECRET', 'setup/init pinLookup')
    } catch (_secretErr) {
      return NextResponse.json(
        { error: 'NEXTAUTH_SECRET ni nastavljen — inicializacija v produkciji zahteva skrivnost (brez fallback-a).' },
        { status: 500 }
      )
    }
    const pinLookup = crypto.createHmac('sha256', nextauthSecret).update(data.adminPin).digest('hex')

    const admin = await db.employee.create({
      data: { name: data.adminName, email: data.adminEmail, role: 'admin', status: 'active', pin: pinHash, pinLookup },
    })

    const adminJob = await db.job.create({
      data: {
        name: 'Administrator', code: 'ADMIN', basePayRate: 0, overtimeRate: 0,
        // P1-13: 'void_items' (množina — usklajeno s centralno matriko) + manage_accounting
        permissions: JSON.stringify(['take_orders', 'void_items', 'apply_discounts', 'manage_cash', 'manage_inventory', 'manage_employees', 'manage_accounting', 'view_reports', 'admin']),
        isActive: true, sortOrder: 0,
      },
    })
    await db.employeeJob.create({ data: { employeeId: admin.id, jobId: adminJob.id } })

    // 2. Lokacija (issue #114 §1: tip lokala vpliva na Location.type —
    //    obstoječe polje, brez spremembe sheme)
    const venueTemplate = data.venueType ? getStarterTemplate(data.venueType) : null
    const location = await db.location.create({
      data: {
        name: data.locationName, code: data.locationCode, type: venueTemplate?.locationType ?? 'restaurant',
        address: data.locationAddress, city: data.locationCity, postCode: data.locationPostCode,
        country: 'SI', phone: data.locationPhone, email: data.locationEmail || '',
        businessId: data.businessId, taxId: data.taxId, registerNumber: data.registerNumber,
        fursEnvironment: data.fursEnvironment, timezone: 'Europe/Ljubljana', currency: 'EUR', locale: 'sl-SI',
        isOpen: true, isActive: true,
      },
    })

    // NOVO (issue #114 §10 "POS mora biti takoj pripravljen"): admin je vezan
    // na lokacijo, ki jo je pravkar ustvaril. Prej je admin ostal BREZ
    // locationId → R88-3 fail-closed tenant-scope je oddajo naročila brez mize
    // ZAVRNIL ("locationId je obvezen") — svež first-run POS ni mogel oddati
    // naročila. (E2E tega ni ulovilo, ker test-fixture admin IMA locationId.)
    // Multi-lokacijski super-admini (brez lokacije) ostanejo možni prek
    // EmployeeManagerja — to tu ni blokirano.
    await db.employee.update({ where: { id: admin.id }, data: { locationId: location.id } })

    // 3. RestaurantSettings
    await db.restaurantSettings.create({
      data: {
        name: data.restaurantName, address: data.locationAddress, postCode: data.locationPostCode,
        city: data.locationCity, country: 'SI', phone: data.locationPhone, email: data.locationEmail || '',
        businessId: data.businessId, taxId: data.taxId, registerNumber: data.registerNumber,
        // R125 (issue #37): fursEnvironment se NE piše več na Settings (MRTVA polja,
        // Location-only fiskalizacija) — nastavi se na lokaciji zgoraj.
        isActive: true,
      },
    })

    // 4. Seed core data — MODEL A: vsa konfiguracija pade NA LOKACIJO, ki je
    //    bila pravkar ustvarjena (nič več globalnih vrstic)
    //    + issue #114: starter katalog po izbranem tipu lokala
    await seedCoreData(location.id, {
      venueType: data.venueType as VenueType | undefined,
      catalogMode: data.catalogMode,
    })

    return NextResponse.json({
      success: true,
      message: 'Sistem uspešno inicializiran',
      admin: { id: admin.id, name: admin.name, email: admin.email },
      location: { id: location.id, name: location.name, code: location.code },
      mode: data.mode,
      venueType: data.venueType ?? null,
      catalogMode: data.catalogMode,
      nextStep: 'Prijava s PIN ' + data.adminPin,
    }, { status: 201 })
  } catch (error: unknown) {
    return handleApiError(error, 'POST /api/setup/init', 'Napaka pri inicializaciji sistema')
  }
}

async function seedCoreData(locationId: string, onboarding?: {
  venueType?: VenueType
  catalogMode?: 'starter' | 'empty'
}) {
  // MODEL A: stopnje DDV so PO LOKACIJI — setup vedno kreira za PRAVkar
  // ustvarjeno lokacijo (nič globalnih vrstic, prej findFirst({code}) brez scopa).
  for (const [code, name, rate] of [
    ['S', 'Standard DDV 22%', 22.0],
    ['R', 'Znižana DDV 9.5%', 9.5],
    ['Z', 'Oproščeno 0%', 0.0],
  ] as const) {
    const existingRate = await db.taxRate.findFirst({ where: { code, locationId } })
    if (existingRate) {
      await db.taxRate.update({
        where: { id: existingRate.id },
        data: { name, rate },
      })
    } else {
      await db.taxRate.create({
        data: { code, name, rate, isActive: true, sortOrder: code === 'S' ? 0 : code === 'R' ? 1 : 2, locationId },
      })
    }
  }

  for (const [type, name, prepTime] of [
    ['dine-in', 'Na mestu', 15],
    ['takeout', 'Vzemi s seboj', 10],
    ['delivery', 'Dostava', 30],
  ] as const) {
    // MODEL A: unique(type, locationId) — upsert po sestavljenem ključu
    // FIX QA runda 39: P1054 most — tabela še nima locationId stolpca →
    // fallback: findFirst(type) + update/create brez lokacije
    await withLocationColumnFallback('setup:diningOption', async (withLoc) => {
      if (withLoc) {
        return db.diningOption.upsert({
          where: { type_locationId: { type, locationId } },
          create: { type, name, prepTimeMinutes: prepTime, isActive: true, sortOrder: type === 'dine-in' ? 0 : type === 'takeout' ? 1 : 2, locationId },
          update: { name },
        })
      }
      const existing = await db.diningOption.findFirst({ where: { type } })
      if (existing) return db.diningOption.update({ where: { id: existing.id }, data: { name } })
      return db.diningOption.create({ data: { type, name, prepTimeMinutes: prepTime, isActive: true, sortOrder: type === 'dine-in' ? 0 : type === 'takeout' ? 1 : 2 } as any }) // eslint-disable-line @typescript-eslint/no-explicit-any
    }).catch(() => {})
  }

  for (const [idx, name] of [
    'Napaka natakarja', 'Kuhinja zgrešila', 'Stranka zamenjala mnenje', 'Alergija', 'Ni na zalogi',
  ].entries()) {
    await withLocationColumnFallback('setup:voidReason', (withLoc) =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      db.voidReason.create({ data: { name, isActive: true, sortOrder: idx, locationId: withLoc ? locationId : undefined } as any }),
    ).catch(() => {})
  }

  for (const [idx, name] of [
    'Mali dvig', 'Vračilo dobavitelju', 'Izplačilo napitnine', 'Zamenjava',
  ].entries()) {
    await withLocationColumnFallback('setup:noSaleReason', (withLoc) =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      db.noSaleReason.create({ data: { name, isActive: true, sortOrder: idx, locationId: withLoc ? locationId : undefined } as any }),
    ).catch(() => {})
  }

  await withLocationColumnFallback('setup:prepStation1', (withLoc) =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    db.prepStation.create({ data: { name: 'Vroča kuhinja', type: 'kitchen', avgPrepTime: 20, isActive: true, sortOrder: 0, locationId: withLoc ? locationId : undefined } as any }),
  ).catch(() => {})
  await withLocationColumnFallback('setup:prepStation2', (withLoc) =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    db.prepStation.create({ data: { name: 'Bar', type: 'bar', avgPrepTime: 5, isActive: true, sortOrder: 1, locationId: withLoc ? locationId : undefined } as any }),
  ).catch(() => {})

  await db.counter.upsert({ where: { name: 'orderNumber' }, create: { id: 'counter-order', name: 'orderNumber', value: 0 }, update: {} })
  await db.counter.upsert({ where: { name: 'receiptNumber' }, create: { id: 'counter-receipt', name: 'receiptNumber', value: 0 }, update: {} })
  await db.counter.upsert({ where: { name: 'checkNumber' }, create: { id: 'counter-check', name: 'checkNumber', value: 0 }, update: {} })
  await db.counter.upsert({ where: { name: 'kotNumber' }, create: { id: 'counter-kot', name: 'kotNumber', value: 0 }, update: {} })

  for (const [code, name, type] of [
    ['1010', 'Blagajna', 'asset'],
    ['1000', 'Banka', 'asset'],
    ['2600', 'DDV izhodni', 'liability'],
    ['7000', 'Promet — na mestu', 'revenue'],
    ['7010', 'Promet — s seboj', 'revenue'],
    ['7020', 'Promet — dostava', 'revenue'],
    ['7600', 'Stroški materiala', 'expense'],
  ] as const) {
    await db.chartOfAccount.upsert({
      where: { code },
      create: { id: `coa-${code}`, code, name, accountType: type, isActive: true, sortOrder: parseInt(code) },
      update: { name, accountType: type },
    })
  }

  // Ustvari katalog za prvi zagon (issue #114):
  //  • catalogMode 'empty' → BREZ menija/artiklov (POS pokaže onboarding
  //    empty state s ponudbo starter kataloga; uporabnik lahko začne čisto)
  //  • venueType podan → starter template po tipu lokala (idempotentna
  //    aplikacija: kategorije @@unique [name, menuId], artikli po
  //    (categoryId, name); zaloga = UNLIMITED — brez InventoryItem vrstice,
  //    torej artikli NE nastanejo kot quantity=0/razprodani)
  //  • venueType manjka → starejša privzeta ponudba (back-compat: obstoječi
  //    klici/testi brez venueType obdržijo enako vedenje)
  // MODEL A: meni pripada lokaciji, ki je bila ustvarjena v tem setupu
  if (onboarding?.catalogMode === 'empty') {
    return
  }

  if (onboarding?.venueType) {
    const template = getStarterTemplate(onboarding.venueType)
    if (template) {
      await applyStarterCatalog({ locationId, venueType: onboarding.venueType, db })
      return
    }
  }

  const menu = await db.menu.create({ data: { name: 'Glavni meni', icon: '🍽️', color: '#f59e0b', sortOrder: 0, isActive: true, locationId } })

  const catFood = await db.category.create({ data: { name: 'Topli napitki', icon: '☕', color: '#8B4513', sortOrder: 0, menuId: menu.id } })
  const catDrinks = await db.category.create({ data: { name: 'Brezalkoholne pijače', icon: '🥤', color: '#3b82f6', sortOrder: 1, menuId: menu.id } })
  const catMain = await db.category.create({ data: { name: 'Glavne jedi', icon: '🍽️', color: '#ef4444', sortOrder: 2, menuId: menu.id } })
  const catDesserts = await db.category.create({ data: { name: 'Sladice', icon: '🍰', color: '#ec4899', sortOrder: 3, menuId: menu.id } })

  // Osnovni artikli z pravilnimi DDV stopnjami in slikami
  const sampleItems = [
    { name: 'Espresso', price: 1.50, vat: 22, cat: catFood, img: '/menu-images/topli-napitki/kava-espresso.png', allergens: '' },
    { name: 'Cappuccino', price: 2.00, vat: 22, cat: catFood, img: '/menu-images/topli-napitki/cappuccino.png', allergens: '7' },
    { name: 'Bela kava', price: 2.20, vat: 22, cat: catFood, img: '/menu-images/topli-napitki/bela-kava.png', allergens: '7' },
    { name: 'Coca-Cola', price: 2.50, vat: 22, cat: catDrinks, img: '/menu-images/gazirane-pijace/coca-cola.png', allergens: '' },
    { name: 'Coca-Cola Zero', price: 2.50, vat: 22, cat: catDrinks, img: '/menu-images/gazirane-pijace/coca-cola-zero.png', allergens: '' },
    { name: 'Fanta', price: 2.50, vat: 22, cat: catDrinks, img: '/menu-images/gazirane-pijace/fanta.png', allergens: '' },
    { name: 'Sprite', price: 2.50, vat: 22, cat: catDrinks, img: '/menu-images/gazirane-pijace/sprite.png', allergens: '' },
    { name: 'Jabolčni sok', price: 2.80, vat: 9.5, cat: catDrinks, img: '/menu-images/sokovi/jabolcni-sok.png', allergens: '' },
    { name: 'Dunajski zrezek', price: 13.90, vat: 9.5, cat: catMain, img: '/menu-images/glavne-jedi/dunajski-zrezek.png', allergens: '1,3,7' },
    { name: 'Ljubljanski zrezek', price: 14.90, vat: 9.5, cat: catMain, img: '/menu-images/glavne-jedi/ljubljanski-zrezek.png', allergens: '1,3,7' },
    { name: 'Goveji golaž', price: 12.90, vat: 9.5, cat: catMain, img: '/menu-images/glavne-jedi/goveji-golaz.png', allergens: '1,7' },
    { name: 'Pizza Margherita', price: 8.90, vat: 9.5, cat: catMain, img: '/menu-images/pizze/margerita.png', allergens: '1,7' },
    { name: 'Špageti Bolognese', price: 10.90, vat: 9.5, cat: catMain, img: '/menu-images/testenine-njoki/bolognese.png', allergens: '1' },
    { name: 'Cezarjeva solata', price: 9.90, vat: 9.5, cat: catMain, img: '/menu-images/solate/cezarjeva.png', allergens: '7,10' },
    { name: 'Panna cotta', price: 4.50, vat: 9.5, cat: catDesserts, img: '/menu-images/sladice/panna-cotta.png', allergens: '7' },
    { name: 'Tiramisu', price: 5.00, vat: 9.5, cat: catDesserts, img: '/menu-images/sladice/tiramisu.png', allergens: '1,3,7' },
    { name: 'Sladoled (porcija)', price: 3.50, vat: 9.5, cat: catDesserts, img: '/menu-images/sladice/sladoled-porcija.png', allergens: '7' },
  ]

  for (let i = 0; i < sampleItems.length; i++) {
    const item = sampleItems[i]
    await db.menuItem.create({
      data: {
        name: item.name,
        description: '',
        price: item.price,
        vatRate: item.vat,
        categoryId: item.cat.id,
        image: item.img,
        allergens: item.allergens,
        isAvailable: true,
        sortOrder: i,
      },
    }).catch(() => {}) // ignore duplicates
  }
}
