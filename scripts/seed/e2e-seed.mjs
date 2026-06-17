// E2E seed — creates minimal data compatible with current schema (status fields, bcrypt PIN, pinLookup)
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'

const prisma = new PrismaClient()
const SECRET = process.env.NEXTAUTH_SECRET || ''
const hashPinLookup = (pin) => SECRET ? crypto.createHmac('sha256', SECRET).update(pin).digest('hex') : ''

async function main() {
  console.log('Seeding minimal E2E data...')

  // 1. Tax rates
  const tax22 = await prisma.taxRate.create({ data: { name: 'DDV 22%', rate: 22, code: 'S', isActive: true, sortOrder: 0 } })
  const tax95 = await prisma.taxRate.create({ data: { name: 'DDV 9.5%', rate: 9.5, code: 'R', isActive: true, sortOrder: 1 } })
  console.log('✓ 2 tax rates')

  // 2. Jobs with permissions
  const adminJob = await prisma.job.create({ data: { name: 'Administrator', code: 'ADM', permissions: JSON.stringify(['admin']), isActive: true, sortOrder: 0 } })
  const serverJob = await prisma.job.create({ data: { name: 'Natakar', code: 'NAT', permissions: JSON.stringify(['take_orders', 'view_reports']), isActive: true, sortOrder: 1 } })
  console.log('✓ 2 jobs')

  // 3. Employees (admin 1234, staff 0000) — bcrypt hashed PIN + pinLookup
  const adminPin = await bcrypt.hash('1234', 10)
  const staffPin = await bcrypt.hash('0000', 10)
  const admin = await prisma.employee.create({
    data: { name: 'Ana Novak', email: 'ana@restaurant.com', phone: '+38641123456', role: 'admin', status: 'active', pin: adminPin, pinLookup: hashPinLookup('1234') || null }
  })
  const staff = await prisma.employee.create({
    data: { name: 'Marko Horvat', email: 'marko@restaurant.com', phone: '+38641654321', role: 'staff', status: 'active', pin: staffPin, pinLookup: hashPinLookup('0000') || null }
  })
  await prisma.employeeJob.create({ data: { employeeId: admin.id, jobId: adminJob.id, payRate: 25, isPrimary: true } })
  await prisma.employeeJob.create({ data: { employeeId: staff.id, jobId: serverJob.id, payRate: 12, isPrimary: true } })
  console.log('✓ 2 employees (admin PIN 1234, staff PIN 0000)')

  // 4. Location
  const loc = await prisma.location.create({ data: { name: 'RestaurantOS Ljubljana', code: 'LJU01', type: 'restaurant', address: 'Slovenska cesta 1', city: 'Ljubljana', postCode: '1000', country: 'SI', timezone: 'Europe/Ljubljana', currency: 'EUR', locale: 'sl-SI', isActive: true, isOpen: true } })
  console.log('✓ 1 location')

  // 5. Tables
  for (let i = 1; i <= 12; i++) {
    await prisma.table.create({ data: { number: i, capacity: i <= 4 ? 2 : i <= 8 ? 4 : 6, area: i <= 6 ? 'notranji' : 'terasa', status: 'available', locationId: loc.id, posX: (i % 4) * 200, posY: Math.floor(i / 4) * 200, width: 120, height: 120 } })
  }
  console.log('✓ 12 tables')

  // 6. Menu + Categories + Items
  const menu = await prisma.menu.create({ data: { name: 'Glavni meni', icon: '📋', color: '#f59e0b', sortOrder: 0, isActive: true, locationId: loc.id } })
  const catFood = await prisma.category.create({ data: { name: 'Glavne jedi', icon: '🍽️', color: '#ef4444', sortOrder: 0, menuId: menu.id } })
  const catDrinks = await prisma.category.create({ data: { name: 'Pijača', icon: '🍷', color: '#3b82f6', sortOrder: 1, menuId: menu.id } })

  const items = [
    { name: 'Beefsteak', desc: 'Goveji zrezek s prilogo', price: 24.50, cat: catFood.id, vat: 22, img: '/images/beefsteak.webp' },
    { name: 'Lignji na žaru', desc: 'Sveži lignji z limono', price: 18.90, cat: catFood.id, vat: 22, img: '/images/lignji.webp' },
    { name: 'Pizza Margherita', desc: 'Klasična italijanska pizza', price: 9.50, cat: catFood.id, vat: 22, img: '/images/pizza.webp' },
    { name: 'Špaghetti Carbonara', desc: 'Italijanska klasika', price: 11.50, cat: catFood.id, vat: 22, img: '' },
    { name: 'Laški Teran', desc: 'Rdeče vino, 0.2l', price: 3.50, cat: catDrinks.id, vat: 22, img: '' },
    { name: 'Pivo Laško', desc: 'Točeno, 0.5l', price: 3.20, cat: catDrinks.id, vat: 22, img: '' },
    { name: 'Coca-Cola', desc: '0.33l', price: 2.50, cat: catDrinks.id, vat: 22, img: '' },
    { name: 'Kava', desc: 'Espresso', price: 1.80, cat: catDrinks.id, vat: 22, img: '' },
  ]
  for (const it of items) {
    await prisma.menuItem.create({ data: { name: it.name, description: it.desc, price: it.price, image: it.img, isAvailable: true, sortOrder: 0, vatRate: it.vat, categoryId: it.cat } })
  }
  console.log('✓ 1 menu, 2 categories, 8 menu items')

  // 7. Void + no-sale reasons
  for (const r of ['Naročilnica napaka', 'Stranka spremenila mnenje', 'Izdelek ni na zalogi', 'Kuhinja napaka']) {
    await prisma.voidReason.create({ data: { name: r, isActive: true } })
  }
  for (const r of ['Odmor', 'Zamenjava smene', 'Sestanek']) {
    await prisma.noSaleReason.create({ data: { name: r, isActive: true } })
  }
  console.log('✓ void/no-sale reasons')

  // 8. Dining option + service charge
  const sc = await prisma.serviceCharge.create({ data: { name: 'Brez servisne postavke', type: 'fixed', amount: 0, isActive: true } })
  await prisma.diningOption.create({ data: { name: 'Na mestu', type: 'dine-in', serviceChargeId: sc.id, prepTimeMinutes: 15, isActive: true, sortOrder: 0 } })
  await prisma.diningOption.create({ data: { name: 'Vzemi s seboj', type: 'takeout', prepTimeMinutes: 10, isActive: true, sortOrder: 1 } })
  console.log('✓ dining options')

  console.log('\n✅ E2E seed complete! Login: admin PIN 1234, staff PIN 0000')
}

main().catch((e) => { console.error('SEED ERROR:', e); process.exit(1) }).finally(() => prisma.$disconnect())
