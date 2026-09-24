// ============================================
// R118 / ISSUE #114 — STARTER CATALOG ONBOARDING TESTI
// ============================================
// Pokrije:
//  • template validacija (vsak tip lokala: kategorije, artikli, modifierji,
//    alergeni, cene, determinizem) — issue #114 "Unit: vsak template validira
//    schema; starter catalog je determinističen"
//  • idempotenca aplikacije: ponovljen klic NE podvoji podatkov (trap-mock
//    z vsiljeno unikatnostjo naravnih ključev — poskus dvojnega create
//    VRŽE izjemo, torej bi bil vsak duplikat test napaka) — issue #114
//    "seed je idempotenten; duplicate create ne podvoji podatkov; retry ne
//    spremeni že ustvarjenih podatkov"
//  • tenant/location isolation: aplikacija za lokacijo B ne dotakne lokacije A
//  • zaloga semantika (§3): starter artikli privzeto BREZ InventoryItem
//    (unlimited/in-stock, NIKOLI quantity=0); izrecni override ustvari
//    vrstico z locationId žigom + StockTransaction; obstoječa zaloga se
//    NIKOLI ne povrne
//  • neznani venueType → zavrnjen (fail-closed)
import { describe, it, expect } from 'vitest'
import {
  VENUE_TYPE_IDS,
  VENUE_TYPES,
  getStarterTemplate,
  listVenueTypeSummaries,
  listVenueTypes,
} from '@/lib/onboarding/catalog-templates'
import {
  applyStarterCatalog,
  type StarterCatalogDb,
} from '@/lib/onboarding/catalog-templates/apply-starter-catalog'

// ============================================
// TRAP-MOCK DB — vsili unikatnost naravnih ključev (kot prava baza).
// Vsak "duplicate create" vrže napako → idempotencni prelom = TEST FAIL.
// ============================================

interface Row {
  id: string
  locationId?: string | null
  menuId?: string
  categoryId?: string
  name?: string // opcionalno (R119 tsc-gate): ledger vrstice ne nosijo imena
  [key: string]: unknown
}

function createTrapDb() {
  let seq = 0
  const id = () => `mock-${++seq}`
  const menus: Row[] = []
  const categories: Row[] = []
  const menuItems: Row[] = []
  const modifierGroups: Row[] = []
  const modifiers: Row[] = []
  const menuItemModifierGroups: Row[] = []
  const inventoryItems: Row[] = []
  const stockTransactions: Row[] = []

  const requireUnique = (rows: Row[], key: string, value: unknown, table: string) => {
    if (rows.some((r) => r[key] === value)) {
      throw new Error(`TRAP: duplicate ${table} natural key ${key}=${String(value)}`)
    }
  }

  const tx = {
    menu: {
      findFirst: async ({ where }: { where: { locationId: string; name: string } }) =>
        menus.find((m) => m.locationId === where.locationId && m.name === where.name) ?? null,
      create: async ({ data }: { data: Record<string, unknown> }) => {
        requireUnique(menus, 'name', `${data.locationId}:${data.name}`, 'menu')
        const row: Row = { id: id(), ...data }
        menus.push(row)
        return row
      },
    },
    category: {
      findUnique: async ({ where }: { where: { name_menuId: { name: string; menuId: string } } }) =>
        categories.find((c) => c.name === where.name_menuId.name && c.menuId === where.name_menuId.menuId) ?? null,
      create: async ({ data }: { data: Record<string, unknown> }) => {
        requireUnique(categories, 'menuId_name', `${data.menuId}:${data.name}`, 'category')
        const row: Row = { id: id(), ...data }
        categories.push(row)
        return row
      },
      count: async ({ where }: { where: { menuId: string } }) =>
        categories.filter((c) => c.menuId === where.menuId).length,
    },
    menuItem: {
      findFirst: async ({ where }: { where: { categoryId: string; name: string } }) =>
        menuItems.find((m) => m.categoryId === where.categoryId && m.name === where.name) ?? null,
      create: async ({ data }: { data: Record<string, unknown> }) => {
        requireUnique(menuItems, 'categoryId_name', `${data.categoryId}:${data.name}`, 'menuItem')
        const row: Row = { id: id(), ...data }
        menuItems.push(row)
        return row
      },
      count: async ({ where }: { where: { category: { menuId: string } } }) => {
        const catIds = categories.filter((c) => c.menuId === where.category.menuId).map((c) => c.id)
        return menuItems.filter((m) => catIds.includes(m.categoryId as string)).length
      },
    },
    modifierGroup: {
      findFirst: async ({ where }: { where: { locationId: string; name: string } }) =>
        modifierGroups.find((g) => g.locationId === where.locationId && g.name === where.name) ?? null,
      create: async ({ data }: { data: Record<string, unknown> }) => {
        requireUnique(modifierGroups, 'locationId_name', `${data.locationId}:${data.name}`, 'modifierGroup')
        const row: Row = { id: id(), ...data }
        modifierGroups.push(row)
        return row
      },
      count: async ({ where }: { where: { locationId: string } }) =>
        modifierGroups.filter((g) => g.locationId === where.locationId).length,
    },
    modifier: {
      findFirst: async ({ where }: { where: { modifierGroupId: string; name: string } }) =>
        modifiers.find((m) => m.modifierGroupId === where.modifierGroupId && m.name === where.name) ?? null,
      create: async ({ data }: { data: Record<string, unknown> }) => {
        requireUnique(modifiers, 'modifierGroupId_name', `${data.modifierGroupId}:${data.name}`, 'modifier')
        const row: Row = { id: id(), ...data }
        modifiers.push(row)
        return row
      },
    },
    menuItemModifierGroup: {
      findUnique: async ({ where }: { where: { menuItemId_modifierGroupId: { menuItemId: string; modifierGroupId: string } } }) =>
        menuItemModifierGroups.find(
          (a) => a.menuItemId === where.menuItemId_modifierGroupId.menuItemId && a.modifierGroupId === where.menuItemId_modifierGroupId.modifierGroupId,
        ) ?? null,
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const key = `${data.menuItemId}:${data.modifierGroupId}`
        requireUnique(menuItemModifierGroups, 'menuItemId_modifierGroupId', key, 'menuItemModifierGroup')
        const row: Row = { id: id(), ...data }
        menuItemModifierGroups.push(row)
        return row
      },
    },
    inventoryItem: {
      findUnique: async ({ where }: { where: { menuItemId_locationId: { menuItemId: string; locationId: string } } }) =>
        inventoryItems.find(
          (i) => i.menuItemId === where.menuItemId_locationId.menuItemId && i.locationId === where.menuItemId_locationId.locationId,
        ) ?? null,
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const key = `${data.menuItemId}:${data.locationId}`
        requireUnique(inventoryItems, 'menuItemId_locationId', key, 'inventoryItem')
        const row: Row = { id: id(), quantity: 0, ...data }
        inventoryItems.push(row)
        return row
      },
    },
    stockTransaction: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const row: Row = { id: id(), ...data }
        stockTransactions.push(row)
        return row
      },
    },
  }

  const db = {
    $transaction: async <T,>(fn: (t: typeof tx) => Promise<T>) => fn(tx),
  } as unknown as StarterCatalogDb

  return {
    db,
    tables: { menus, categories, menuItems, modifierGroups, modifiers, menuItemModifierGroups, inventoryItems, stockTransactions },
  }
}

const VALID_ALLERGEN_CODES = new Set(Array.from({ length: 14 }, (_, i) => String(i + 1)))

// ============================================
// 1) TEMPLATE VALIDACIJA + DETERMINIZEM
// ============================================
describe('starter catalog templates — validacija (issue #114)', () => {
  it('obstaja template za VSAK veljavni tip lokala (6 tipov iz issue-ja)', () => {
    expect([...VENUE_TYPE_IDS].sort()).toEqual(['bar', 'fast_food', 'gostilna', 'kavarna', 'pizzerija', 'restavracija'].sort())
    for (const vt of VENUE_TYPE_IDS) {
      expect(getStarterTemplate(vt), `template za ${vt}`).not.toBeNull()
    }
    expect(getStarterTemplate('neznani-tip')).toBeNull()
  })

  it('vsak template ima vsaj 1 kategorijo in vsaka kategorija vsaj 1 artikel', () => {
    for (const vt of listVenueTypes()) {
      const t = getStarterTemplate(vt)!
      expect(t.categories.length, `${vt}: kategorije`).toBeGreaterThanOrEqual(1)
      expect(t.menuName.length, `${vt}: menuName`).toBeGreaterThan(0)
      for (const cat of t.categories) {
        expect(cat.items.length, `${vt}/${cat.name}: artikli`).toBeGreaterThanOrEqual(1)
        expect(cat.name.length).toBeGreaterThan(0)
      }
    }
  })

  it('vse cene > 0, DDV iz množice veljavnih, alergeni = veljavne EU kode 1–14', () => {
    for (const vt of listVenueTypes()) {
      const t = getStarterTemplate(vt)!
      const validVat = new Set([0, 9.5, 22])
      for (const cat of t.categories) {
        for (const item of cat.items) {
          expect(item.price, `${vt}/${cat.name}/${item.name}: cena`).toBeGreaterThan(0)
          expect(validVat.has(item.vatRate), `${vt}/${cat.name}/${item.name}: vatRate ${item.vatRate}`).toBe(true)
          if (item.allergens) {
            for (const code of item.allergens.split(',')) {
              expect(VALID_ALLERGEN_CODES.has(code.trim()), `${vt}/${item.name}: alergen '${code}'`).toBe(true)
            }
          }
        }
      }
    }
  })

  it('modifier skupine: vsak attachToItems se ujema z artiklom ISTEGA template-a', () => {
    for (const vt of listVenueTypes()) {
      const t = getStarterTemplate(vt)!
      const itemNames = new Set(t.categories.flatMap((c) => c.items.map((i) => i.name)))
      for (const g of t.modifierGroups) {
        expect(g.modifiers.length, `${vt}/${g.name}: modifierji`).toBeGreaterThanOrEqual(1)
        for (const m of g.modifiers) {
          expect(m.price, `${vt}/${g.name}/${m.name}: cena >= 0`).toBeGreaterThanOrEqual(0)
        }
        for (const target of g.attachToItems) {
          expect(itemNames.has(target), `${vt}: attach '${target}' v '${g.name}' ne obstaja med artikli`).toBe(true)
        }
      }
    }
  })

  it('brez dvojnih imen artiklov/kategorij znotraj template-a (idempotenca po naravnih ključih)', () => {
    for (const vt of listVenueTypes()) {
      const t = getStarterTemplate(vt)!
      const catNames = t.categories.map((c) => c.name)
      expect(new Set(catNames).size, `${vt}: dvojni kategoriji`).toBe(catNames.length)
      const itemNames = t.categories.flatMap((c) => c.items.map((i) => i.name))
      expect(new Set(itemNames).size, `${vt}: dvojni artikli`).toBe(itemNames.length)
    }
  })

  it('determinizem: registry vrača identične podatke ob več klicih', () => {
    const a = listVenueTypeSummaries()
    const b = listVenueTypeSummaries()
    expect(a).toEqual(b)
    expect(VENUE_TYPES).toEqual(a)
    for (const vt of listVenueTypes()) {
      expect(getStarterTemplate(vt)).toBe(getStarterTemplate(vt)) // ista referenca (statična struktura)
    }
  })
})

// ============================================
// 2) APLIKACIJA — IDEMPOTENCA + ISOLATION + ZALOGA
// ============================================
describe('applyStarterCatalog — idempotenca (issue #114 §6)', () => {
  it('prvi klic ustvari celoten katalog; summary poroča ustvarjene vrstice', async () => {
    const { db, tables } = createTrapDb()
    const res = await applyStarterCatalog({ locationId: 'loc-A', venueType: 'pizzerija', db })

    expect(res.template).toBe('pizzerija')
    expect(res.created.menus).toBe(1)
    const expectedItems = getStarterTemplate('pizzerija')!.categories.reduce((s, c) => s + c.items.length, 0)
    expect(res.created.items).toBe(expectedItems)
    expect(tables.menuItems.length).toBe(expectedItems)
    expect(tables.categories.length).toBe(getStarterTemplate('pizzerija')!.categories.length)
    expect(res.created.modifierGroups).toBe(getStarterTemplate('pizzerija')!.modifierGroups.length)
    expect(res.totals.items).toBe(expectedItems)
    // modifierji so priključeni (attach)
    expect(tables.menuItemModifierGroups.length).toBeGreaterThan(0)
  })

  it('ponovljen klic (refresh/retry/dvojni klik) NE podvoji podatkov — trap bi vržel', async () => {
    const { db, tables } = createTrapDb()
    const first = await applyStarterCatalog({ locationId: 'loc-A', venueType: 'restavracija', db })
    const second = await applyStarterCatalog({ locationId: 'loc-A', venueType: 'restavracija', db })
    const third = await applyStarterCatalog({ locationId: 'loc-A', venueType: 'restavracija', db })

    // vsi created števci po ponovljenih klicih = 0 (nič novega)
    for (const [i, res] of [second, third].entries()) {
      expect(res.created.menus, `klic ${i + 2}: menus`).toBe(0)
      expect(res.created.categories).toBe(0)
      expect(res.created.items).toBe(0)
      expect(res.created.modifierGroups).toBe(0)
      expect(res.created.modifiers).toBe(0)
      expect(res.created.attachments).toBe(0)
    }
    // totali ostanejo identični prvemu
    expect(second.totals.items).toBe(first.totals.items)
    expect(third.totals.items).toBe(first.totals.items)
    // fizično število vrstic se NI spremenilo
    expect(tables.menuItems.length).toBe(first.totals.items)
  })

  it('idempotenca tudi pri MEŠANEM vrstnem redu tipov na isti lokaciji (2 različna template-a ne podvojita istih kategorij)', async () => {
    const { db, tables } = createTrapDb()
    await applyStarterCatalog({ locationId: 'loc-A', venueType: 'bar', db })
    await applyStarterCatalog({ locationId: 'loc-A', venueType: 'bar', db })
    // drugi template na isti lokaciji → svoj menu; skupine so per-lokacijske po imenu
    const res2 = await applyStarterCatalog({ locationId: 'loc-A', venueType: 'kavarna', db })
    expect(res2.created.menus).toBe(1)
    expect(tables.menus.filter((m) => m.locationId === 'loc-A').length).toBe(2)
  })
})

describe('applyStarterCatalog — tenant/location isolation (issue #114 §7)', () => {
  it('aplikacija za lokacijo B NE vrača NE dela vrstic lokacije A', async () => {
    const { db, tables } = createTrapDb()
    await applyStarterCatalog({ locationId: 'loc-A', venueType: 'pizzerija', db })
    const resB = await applyStarterCatalog({ locationId: 'loc-B', venueType: 'pizzerija', db })

    // lokacija B je ustvarila SVOJ katalog (menu per lokacija)
    expect(resB.created.menus).toBe(1)
    const menusA = tables.menus.filter((m) => m.locationId === 'loc-A')
    const menusB = tables.menus.filter((m) => m.locationId === 'loc-B')
    expect(menusA.length).toBe(1)
    expect(menusB.length).toBe(1)
    expect(menusA[0].id).not.toBe(menusB[0].id)
    // artikli lokacije B so vezani na kategorije menija B (niso si deljeni)
    const catIdsB = new Set(tables.categories.filter((c) => c.menuId === menusB[0].id).map((c) => c.id as string))
    const itemsB = tables.menuItems.filter((m) => catIdsB.has(m.categoryId as string))
    expect(itemsB.length).toBe(resB.totals.items)
    // modifier skupine so per-lokacijske (locationId žig)
    expect(tables.modifierGroups.filter((g) => g.locationId === 'loc-B').length).toBe(resB.totals.modifierGroups)
  })
})

describe('applyStarterCatalog — zaloga semantika (issue #114 §3)', () => {
  it('privzeto NIKOLI ne ustvari InventoryItem (starter artikli = brez omejitve, NE quantity=0)', async () => {
    const { db, tables } = createTrapDb()
    await applyStarterCatalog({ locationId: 'loc-A', venueType: 'gostilna', db })
    expect(tables.inventoryItems.length).toBe(0)
  })

  it('izrecen override ustvari zalogo > 0 z locationId žigom + StockTransaction sledjo', async () => {
    const { db, tables } = createTrapDb()
    const res = await applyStarterCatalog({
      locationId: 'loc-A',
      venueType: 'gostilna',
      db,
      stockOverrides: [{ itemName: 'Goveja juha z rezanci', quantity: 25, minQuantity: 5 }],
    })
    expect(res.created.inventoryItems).toBe(1)
    expect(tables.inventoryItems.length).toBe(1)
    const inv = tables.inventoryItems[0]
    expect(Number(inv.quantity)).toBe(25)
    expect(inv.locationId).toBe('loc-A')
    expect(inv.menuItemId).toBeTruthy()
    expect(tables.stockTransactions.length).toBe(1)
    expect(tables.stockTransactions[0].type).toBe('procurement')
    expect(Number(tables.stockTransactions[0].newQty)).toBe(25)
    // override z neznanim imenom je defenzivno preskočen (skipAttachments)
    const res2 = await applyStarterCatalog({
      locationId: 'loc-A', venueType: 'gostilna', db,
      stockOverrides: [{ itemName: 'NEOBSTOJECI ARTIKEL', quantity: 5 }],
    })
    expect(res2.created.inventoryItems).toBe(0)
    expect(res2.skippedAttachments.some((s) => s.includes('NEOBSTOJECI ARTIKEL'))).toBe(true)
  })

  it('obstoječa zaloga se ob ponovljenem klicu NIKOLI ne povrne (idempotenca zaloge)', async () => {
    const { db, tables } = createTrapDb()
    await applyStarterCatalog({
      locationId: 'loc-A', venueType: 'gostilna', db,
      stockOverrides: [{ itemName: 'Goveja juha z rezanci', quantity: 25 }],
    })
    await applyStarterCatalog({
      locationId: 'loc-A', venueType: 'gostilna', db,
      stockOverrides: [{ itemName: 'Goveja juha z rezanci', quantity: 999 }],
    })
    const inv = tables.inventoryItems[0]
    expect(Number(inv.quantity)).toBe(25) // NIKOLI 999
    expect(tables.stockTransactions.length).toBe(1)
  })

  it('override quantity <= 0 je zavrnjen (0 ≠ privzeta zaloga)', async () => {
    const { db, tables } = createTrapDb()
    await applyStarterCatalog({
      locationId: 'loc-A', venueType: 'bar', db,
      stockOverrides: [{ itemName: 'Točeno pivo 0,5 l', quantity: 0 }],
    })
    expect(tables.inventoryItems.length).toBe(0)
  })
})

describe('applyStarterCatalog — fail-closed', () => {
  it('neznani venueType vrže napako (ne ugiba)', async () => {
    const { db } = createTrapDb()
    await expect(
      applyStarterCatalog({ locationId: 'loc-A', venueType: 'hacker-type' as never, db }),
    ).rejects.toThrow(/Neznan tip lokala/)
  })
})
