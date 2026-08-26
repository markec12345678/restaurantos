// POST /api/setup/init — Inicializiraj sistem
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { handleApiError, parseJsonBody } from '@/lib/api-utils'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'

export const dynamic = 'force-dynamic'

const setupSchema = z.object({
  mode: z.enum(['single', 'multi']).default('single'),
  adminName: z.string().min(2, 'Ime admina je obvezno').max(100),
  adminEmail: z.string().email('Veljaven e-poštni naslov je obvezen'),
  adminPin: z.string().length(4, 'PIN mora biti 4 mesta').regex(/^\d{4}$/, 'PIN mora vsebovati samo številke'),
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
})

export async function POST(req: Request) {
  try {
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

    // 1. Admin
    const pinHash = await bcrypt.hash(data.adminPin, 10)
    const nextauthSecret = process.env.NEXTAUTH_SECRET || 'fallback-secret-change-me'
    const pinLookup = crypto.createHmac('sha256', nextauthSecret).update(data.adminPin).digest('hex')

    const admin = await db.employee.create({
      data: { name: data.adminName, email: data.adminEmail, role: 'admin', status: 'active', pin: pinHash, pinLookup },
    })

    const adminJob = await db.job.create({
      data: {
        name: 'Administrator', code: 'ADMIN', basePayRate: 0, overtimeRate: 0,
        permissions: JSON.stringify(['take_orders', 'void_item', 'apply_discounts', 'manage_cash', 'manage_inventory', 'manage_employees', 'view_reports', 'admin']),
        isActive: true, sortOrder: 0,
      },
    })
    await db.employeeJob.create({ data: { employeeId: admin.id, jobId: adminJob.id } })

    // 2. Lokacija
    const location = await db.location.create({
      data: {
        name: data.locationName, code: data.locationCode, type: 'restaurant',
        address: data.locationAddress, city: data.locationCity, postCode: data.locationPostCode,
        country: 'SI', phone: data.locationPhone, email: data.locationEmail || '',
        businessId: data.businessId, taxId: data.taxId, registerNumber: data.registerNumber,
        fursEnvironment: data.fursEnvironment, timezone: 'Europe/Ljubljana', currency: 'EUR', locale: 'sl-SI',
        isOpen: true, isActive: true,
      },
    })

    // 3. RestaurantSettings
    await db.restaurantSettings.create({
      data: {
        name: data.restaurantName, address: data.locationAddress, postCode: data.locationPostCode,
        city: data.locationCity, country: 'SI', phone: data.locationPhone, email: data.locationEmail || '',
        businessId: data.businessId, taxId: data.taxId, registerNumber: data.registerNumber,
        fursEnvironment: data.fursEnvironment, isActive: true,
      },
    })

    // 4. Seed core data
    await seedCoreData()

    return NextResponse.json({
      success: true,
      message: 'Sistem uspešno inicializiran',
      admin: { id: admin.id, name: admin.name, email: admin.email },
      location: { id: location.id, name: location.name, code: location.code },
      mode: data.mode,
      nextStep: 'Prijava s PIN ' + data.adminPin,
    }, { status: 201 })
  } catch (error: unknown) {
    return handleApiError(error, 'POST /api/setup/init', 'Napaka pri inicializaciji sistema')
  }
}

async function seedCoreData() {
  for (const [code, name, rate] of [
    ['S', 'Standard DDV 22%', 22.0],
    ['R', 'Znižana DDV 9.5%', 9.5],
    ['Z', 'Oproščeno 0%', 0.0],
  ] as const) {
    await db.taxRate.upsert({
      where: { code },
      create: { code, name, rate, isActive: true, sortOrder: code === 'S' ? 0 : code === 'R' ? 1 : 2 },
      update: { name, rate },
    })
  }

  for (const [type, name, prepTime] of [
    ['dine-in', 'Na mestu', 15],
    ['takeout', 'Vzemi s seboj', 10],
    ['delivery', 'Dostava', 30],
  ] as const) {
    await db.diningOption.upsert({
      where: { type },
      create: { type, name, prepTimeMinutes: prepTime, isActive: true, sortOrder: type === 'dine-in' ? 0 : type === 'takeout' ? 1 : 2 },
      update: { name },
    })
  }

  for (const [idx, name] of [
    'Napaka natakarja', 'Kuhinja zgrešila', 'Stranka zamenjala mnenje', 'Alergija', 'Ni na zalogi',
  ].entries()) {
    await db.voidReason.create({ data: { name, isActive: true, sortOrder: idx } }).catch(() => {})
  }

  for (const [idx, name] of [
    'Mali dvig', 'Vračilo dobavitelju', 'Izplačilo napitnine', 'Zamenjava',
  ].entries()) {
    await db.noSaleReason.create({ data: { name, isActive: true, sortOrder: idx } }).catch(() => {})
  }

  await db.prepStation.create({ data: { name: 'Vroča kuhinja', type: 'kitchen', avgPrepTime: 20, isActive: true, sortOrder: 0 } }).catch(() => {})
  await db.prepStation.create({ data: { name: 'Bar', type: 'bar', avgPrepTime: 5, isActive: true, sortOrder: 1 } }).catch(() => {})

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

  // Ustvari osnovne kategorije in artikle da je sistem takoj uporaben
  const menu = await db.menu.create({ data: { name: 'Glavni meni', icon: '🍽️', color: '#f59e0b', sortOrder: 0, isActive: true } })

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
