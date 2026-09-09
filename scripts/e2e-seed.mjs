// E2E seed za CI (PostgreSQL) — izvlečeno iz .github/workflows/ci.yml
// Zakaj datoteka: inline `node -e "..."` v YAML run bloku je padel, ker so
// komentarji vsebovali DVOJNE narekovaje ("dve lokaciji", "verify inventory")
// — bash je zaključil niz pri prvem " in skripta se obrezala
// (SyntaxError: Unexpected end of input, run 539).
//
// Uporaba: DATABASE_URL=... NEXTAUTH_SECRET=... node scripts/e2e-seed.mjs
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'

const db = new PrismaClient()

const NEXTAUTH_SECRET = process.env.NEXTAUTH_SECRET
if (!NEXTAUTH_SECRET) {
  console.error('[e2e-seed] NEXTAUTH_SECRET ni nastavljen — PIN lookup bi bil napačen')
  process.exit(1)
}

async function main() {
  const pin = '1111'
  const pinHash = await bcrypt.hash(pin, 10)
  const pinLookup = crypto.createHmac('sha256', NEXTAUTH_SECRET).update(pin).digest('hex')

  await db.employee.upsert({
    where: { email: 'admin@e2e.test' },
    update: { pin: pinHash, pinLookup },
    create: { id: 'test-admin', name: 'Test Admin', email: 'admin@e2e.test', role: 'admin', status: 'active', pin: pinHash, pinLookup, hireDate: new Date() },
  })

  await db.location.upsert({
    where: { code: 'HQ' },
    update: {},
    create: { id: 'loc-1', name: 'Test Restavracija', code: 'HQ', type: 'restaurant', address: 'Testna 1', city: 'Ljubljana', postCode: '1000', country: 'SI', businessId: '12345678', taxId: 'SI12345678', registerNumber: 'TEST01', fursEnvironment: 'test', isActive: true },
  })

  // E2E varianta "dve lokaciji": druga lokacija + meni + miza
  // (premisesId je UNIQUE s privzetim '' — loc-2 MORA imeti svojega)
  await db.location.upsert({
    where: { code: 'FIL2' },
    update: {},
    create: { id: 'loc-2', name: 'Test Filiala', code: 'FIL2', type: 'restaurant', address: 'Filialna 2', city: 'Maribor', postCode: '2000', country: 'SI', businessId: '87654321', taxId: 'SI87654321', registerNumber: 'TEST02', premisesId: 'PREM-TEST02', fursEnvironment: 'test', isActive: true },
  })

  await db.restaurantSettings.upsert({
    where: { id: 'rs-1' },
    update: {},
    create: { id: 'rs-1', name: 'Test Restaurant', address: 'Testna 1', postCode: '1000', city: 'Ljubljana', businessId: '12345678', taxId: 'SI12345678', registerNumber: 'TEST01', fursEnvironment: 'test', isActive: true },
  })

  await db.menu.upsert({ where: { id: 'menu-1' }, update: {}, create: { id: 'menu-1', name: 'Test Menu', locationId: 'loc-1', isActive: true } })
  await db.category.upsert({ where: { id: 'cat-1' }, update: {}, create: { id: 'cat-1', name: 'Test Kategorija', menuId: 'menu-1' } })

  for (const [id, name, price, vat] of [['mi-1', 'Test Kava', 1.50, 22.0], ['mi-2', 'Test Pizza', 8.90, 9.5], ['mi-3', 'Test Solata', 5.50, 9.5]]) {
    await db.menuItem.upsert({ where: { id }, update: {}, create: { id, name, description: '', price, image: '', isAvailable: true, sortOrder: 0, vatRate: vat, categoryId: 'cat-1' } })
  }

  // Meni artikli lokacije 2
  await db.menu.upsert({ where: { id: 'menu-2' }, update: {}, create: { id: 'menu-2', name: 'Test Menu Filiala', locationId: 'loc-2', isActive: true } })
  await db.category.upsert({ where: { id: 'cat-2' }, update: {}, create: { id: 'cat-2', name: 'Test Kategorija Filiala', menuId: 'menu-2' } })
  for (const [id, name, price, vat] of [['mi-4', 'Test Kava Filiala', 1.70, 22.0], ['mi-5', 'Test Burger Filiala', 9.90, 9.5]]) {
    await db.menuItem.upsert({ where: { id }, update: {}, create: { id, name, description: '', price, image: '', isAvailable: true, sortOrder: 0, vatRate: vat, categoryId: 'cat-2' } })
  }

  await db.table.upsert({ where: { id: 'table-1' }, update: {}, create: { id: 'table-1', number: 1, capacity: 4, status: 'available', area: 'main', posX: 10, posY: 10, width: 8, height: 10, shape: 'round', rotation: 0, locationId: 'loc-1' } })
  await db.table.upsert({ where: { id: 'table-2' }, update: {}, create: { id: 'table-2', number: 1, capacity: 4, status: 'available', area: 'main', posX: 20, posY: 10, width: 8, height: 10, shape: 'square', rotation: 0, locationId: 'loc-2' } })

  // MODEL A (tenant scope): zaposleni VEZAN na loc-2 — za cross-tenant teste
  // (PIN 2222). Admin brez lokacije = cross-lokacijski nadzor. USTVARJEN PO
  // lokacijah (FK Employee_locationId_fkey zahteva obstoječo loc-2).
  const pin2 = '2222'
  const pinHash2 = await bcrypt.hash(pin2, 10)
  const pinLookup2 = crypto.createHmac('sha256', NEXTAUTH_SECRET).update(pin2).digest('hex')
  await db.employee.upsert({
    where: { email: 'filiala@e2e.test' },
    update: { pin: pinHash2, pinLookup: pinLookup2, locationId: 'loc-2', status: 'active' },
    create: { id: 'filiala-admin', name: 'Filiala Admin', email: 'filiala@e2e.test', role: 'admin', status: 'active', pin: pinHash2, pinLookup: pinLookup2, locationId: 'loc-2', hireDate: new Date() },
  })

  // MODEL A: konfiguracija PO LOKACIJI (vsaka lokacija svoje DDV stopnje,
  // dining options in razloga — cross-tenant testni podatki)
  for (const loc of ['loc-1', 'loc-2']) {
    for (const [id, code, name, rate] of [
      [`tr-${loc}-S`, 'S', 'Standard DDV 22%', 22.0],
      [`tr-${loc}-R`, 'R', 'Znižana DDV 9.5%', 9.5],
      [`tr-${loc}-Z`, 'Z', 'Oproščeno 0%', 0.0],
    ]) {
      await db.taxRate.upsert({
        where: { id },
        update: { locationId: loc, rate },
        create: { id, code, name, rate, isActive: true, locationId: loc },
      })
    }
    await db.diningOption.upsert({
      where: { id: `do-${loc}-dinein` },
      update: { locationId: loc },
      create: { id: `do-${loc}-dinein`, name: 'Na mestu', type: 'dine-in', isActive: true, sortOrder: 0, prepTimeMinutes: 15, locationId: loc },
    })
    await db.voidReason.upsert({
      where: { id: `vr-${loc}-1` },
      update: { locationId: loc },
      create: { id: `vr-${loc}-1`, name: `Napaka natakarja (${loc})`, isActive: true, sortOrder: 0, locationId: loc },
    })
    // MODEL A #8: servisna postavka + dining option s SKUPNO referenco (za
    // cross-scope validacijo: serviceChargeId iz TUJE lokacije = 400)
    await db.serviceCharge.upsert({
      where: { id: `sc-${loc}-1` },
      update: { locationId: loc },
      create: { id: `sc-${loc}-1`, name: `Servisna 10% (${loc})`, type: 'percentage', amount: 10, isActive: true, sortOrder: 0, locationId: loc },
    })
    await db.diningOption.upsert({
      where: { id: `do-${loc}-takeout` },
      update: { locationId: loc },
      create: { id: `do-${loc}-takeout`, name: 'Vzemi s seboj', type: 'takeout', isActive: true, sortOrder: 1, prepTimeMinutes: 10, locationId: loc },
    })
    // MODEL A #9: modifier group PO LOKACIJI (GET isolation test)
    await db.modifierGroup.upsert({
      where: { id: `mg-${loc}-1` },
      update: { locationId: loc },
      create: {
        id: `mg-${loc}-1`, name: `Priloge (${loc})`, required: false, minSelect: 0, maxSelect: 2,
        sortOrder: 0, locationId: loc,
        modifiers: { create: [{ name: 'Ekstra sir', price: 1.5, sortOrder: 0 }] },
      },
    })
  }

  // E2E "verify inventory": inventar + recepte (mi-1/mi-4 → inv-kava, mi-5 → inv-burger)
  await db.inventoryItem.upsert({ where: { id: 'inv-kava' }, update: {}, create: { id: 'inv-kava', name: 'E2E Kava zrnje', description: 'E2E testna zaloga', unit: 'kos', quantity: 100, minQuantity: 10, costPerUnit: 5.0, supplier: 'E2E dobavitelj', category: 'general', location: 'main', servingsPerUnit: 1, costPerServing: 5.0 } })
  await db.inventoryItem.upsert({ where: { id: 'inv-burger' }, update: {}, create: { id: 'inv-burger', name: 'E2E Burger meso', description: 'E2E testna zaloga', unit: 'kos', quantity: 50, minQuantity: 5, costPerUnit: 3.0, supplier: 'E2E dobavitelj', category: 'general', location: 'main', servingsPerUnit: 1, costPerServing: 3.0 } })

  const recipes = [['recipe-kava-1', 'mi-1', 'inv-kava'], ['recipe-kava-4', 'mi-4', 'inv-kava'], ['recipe-burger-5', 'mi-5', 'inv-burger']]
  for (const [id, mi, inv] of recipes) {
    await db.recipeItem.upsert({ where: { menuItemId_inventoryItemId: { menuItemId: mi, inventoryItemId: inv } }, update: {}, create: { id, menuItemId: mi, inventoryItemId: inv, quantityPerServing: 1, unit: 'kos' } })
  }

  console.log('[e2e-seed] Seed complete')
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => db.$disconnect())
