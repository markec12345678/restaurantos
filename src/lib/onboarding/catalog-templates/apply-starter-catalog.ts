// ============================================
// APPLY STARTER CATALOG (issue #114) — idempotentna aplikacija template-a
// ============================================
// Zaščite (issue #114 §6 idempotency + §7 tenant/location isolation):
//  • VSE vrstice se ustvarijo na EKSPPLICITNI locationId (MODEL A) — klic
//    prenaša locationId, ki ga je rešil tenant-scope helper na API sloju.
//  • Idempotenca po naravnih ključih:
//      Menu        → findFirst({ locationId, name })        (create samo če manjka)
//      Category    → upsert (name, menuId)                  (@@unique)
//      MenuItem    → findFirst({ categoryId, name })        (create samo če manjka)
//      ModifierGroup → findFirst({ locationId, name })      (create samo če manjka)
//      Modifier    → findFirst({ modifierGroupId, name })   (create samo če manjka)
//      MenuItemModifierGroup → upsert (menuItemId, modifierGroupId) (@@unique)
//      InventoryItem → upsert (menuItemId, locationId)      (@@unique; update = NO-OP,
//                     nikoli ne povrnemo obstoječe zaloge!)
//  • Ponovljen klic (refresh/retry/dvojni klik) NE PODVOJI podatkov.
//  • Zaloga (§3): starter artikli privzeto brez InventoryItem vrstice =
//    "Brez omejitve / In Stock". Samo izrecni stockOverrides ustvarijo vrstico
//    (quantity > 0, vedno z locationId žigom + StockTransaction sled).
import type { PrismaClient } from '@prisma/client'
import { getStarterTemplate } from './registry'
import type { VenueType } from './types'

/** Minimalni db kontrakt (omogoča unit testiranje s trap-mock-om). */
export type StarterCatalogDb = Pick<PrismaClient, '$transaction'>

export interface StarterStockOverride {
  /** Imena artiklov iz template-a, ki imajo OMEJENO zalogo. */
  itemName: string
  quantity: number
  minQuantity?: number
  unit?: string
}

export interface ApplyStarterCatalogParams {
  locationId: string
  venueType: VenueType
  db: StarterCatalogDb
  /** Izbirno: artikli z omejeno začetno zalogo (default = unlimited). */
  stockOverrides?: StarterStockOverride[]
}

export interface ApplyStarterCatalogResult {
  template: VenueType
  menuName: string
  created: {
    menus: number
    categories: number
    items: number
    modifierGroups: number
    modifiers: number
    attachments: number
    inventoryItems: number
  }
  /** Skupno število (obstoječih + novih) po uspešni aplikaciji. */
  totals: {
    categories: number
    items: number
    modifierGroups: number
  }
  /** attachToItems imena, ki se niso ujela z nobenim starter artiklom (defenzivno). */
  skippedAttachments: string[]
}

export async function applyStarterCatalog(
  params: ApplyStarterCatalogParams,
): Promise<ApplyStarterCatalogResult> {
  const template = getStarterTemplate(params.venueType)
  if (!template) {
    throw new Error(`Neznan tip lokala za starter katalog: ${String(params.venueType)}`)
  }
  const locationId = params.locationId

  return params.db.$transaction(async (tx) => {
    const created = {
      menus: 0,
      categories: 0,
      items: 0,
      modifierGroups: 0,
      modifiers: 0,
      attachments: 0,
      inventoryItems: 0,
    }
    const skippedAttachments: string[] = []

    // --- 1. MENU (idempotentno po locationId + name; Menu nima @@unique imena) ---
    let menu = await tx.menu.findFirst({ where: { locationId, name: template.menuName } })
    if (!menu) {
      menu = await tx.menu.create({
        data: {
          name: template.menuName,
          icon: template.icon,
          color: '#f59e0b',
          sortOrder: 0,
          isActive: true,
          locationId,
        },
      })
      created.menus += 1
    }

    // --- 2. KATEGORIJE (upsert po @@unique [name, menuId]) + 3. ARTIKLI ---
    // ime kategorije → id (za debug/poročanje); ime artikla → id (za attach + zalogo)
    const itemIdsByName = new Map<string, string>()

    for (const cat of template.categories) {
      // Idempotenca: @@unique [name, menuId] — obstoj = no-op, manjkajoča = create
      const existingCat = await tx.category.findUnique({
        where: { name_menuId: { name: cat.name, menuId: menu.id } },
      })
      const category = existingCat ?? (await tx.category.create({
        data: {
          name: cat.name,
          icon: cat.icon,
          color: cat.color,
          sortOrder: cat.sortOrder ?? 0,
          menuId: menu.id,
        },
      }))
      if (!existingCat) created.categories += 1

      for (const item of cat.items) {
        let menuItem = await tx.menuItem.findFirst({
          where: { categoryId: category.id, name: item.name },
        })
        if (!menuItem) {
          menuItem = await tx.menuItem.create({
            data: {
              name: item.name,
              description: item.description ?? '',
              price: item.price,
              vatRate: item.vatRate,
              allergens: item.allergens ?? '',
              image: '',
              isAvailable: true,
              sortOrder: item.sortOrder ?? 0,
              categoryId: category.id,
            },
          })
          created.items += 1
        }
        itemIdsByName.set(item.name, menuItem.id)
      }
    }

    // --- 4. MODIFIER SKUPINE + MODIFIERJI + PRIKLJUČKI ---
    for (const group of template.modifierGroups) {
      let modifierGroup = await tx.modifierGroup.findFirst({
        where: { locationId, name: group.name },
      })
      if (!modifierGroup) {
        modifierGroup = await tx.modifierGroup.create({
          data: {
            name: group.name,
            required: group.required ?? false,
            minSelect: group.minSelect ?? 0,
            maxSelect: group.maxSelect ?? null,
            sortOrder: group.sortOrder ?? 0,
            locationId,
          },
        })
        created.modifierGroups += 1
      }

      for (const mod of group.modifiers) {
        let modifier = await tx.modifier.findFirst({
          where: { modifierGroupId: modifierGroup.id, name: mod.name },
        })
        if (!modifier) {
          modifier = await tx.modifier.create({
            data: {
              name: mod.name,
              price: mod.price,
              isAvailable: true,
              sortOrder: mod.sortOrder ?? 0,
              modifierGroupId: modifierGroup.id,
            },
          })
          created.modifiers += 1
        }
      }

      // Priključki na starter artikla (@@unique [menuItemId, modifierGroupId])
      for (const itemName of group.attachToItems) {
        const menuItemId = itemIdsByName.get(itemName)
        if (!menuItemId) {
          // Defenzivno: template napaka — ne odpri transakcije, samo zabeleži.
          skippedAttachments.push(`${group.name} → ${itemName}`)
          continue
        }
        const existing = await tx.menuItemModifierGroup.findUnique({
          where: { menuItemId_modifierGroupId: { menuItemId, modifierGroupId: modifierGroup.id } },
        })
        if (!existing) {
          await tx.menuItemModifierGroup.create({
            data: { menuItemId, modifierGroupId: modifierGroup.id, sortOrder: group.sortOrder ?? 0 },
          })
          created.attachments += 1
        }
      }
    }

    // --- 5. ZALOGA (samo izrecni overrides; default = UNLIMITED, brez vrstice) ---
    for (const override of params.stockOverrides ?? []) {
      const menuItemId = itemIdsByName.get(override.itemName)
      if (!menuItemId) {
        skippedAttachments.push(`stockOverride → ${override.itemName}`)
        continue
      }
      const existing = await tx.inventoryItem.findUnique({
        where: { menuItemId_locationId: { menuItemId, locationId } },
      })
      if (existing) continue // NIKOLI ne povrnemo obstoječe zaloge (idempotenca)
      const quantity = Number(override.quantity)
      if (!Number.isFinite(quantity) || quantity <= 0) continue // 0 → izrecno razprodano = unlimited vrstica ni smiselna
      const invItem = await tx.inventoryItem.create({
        data: {
          name: override.itemName,
          unit: override.unit ?? 'kos',
          quantity,
          minQuantity: override.minQuantity ?? 0,
          costPerUnit: 0,
          servingsPerUnit: 1,
          menuItemId,
          // MODEL A: vedno žig lokacije (R85-4c konvencija — nikoli NULL write)
          locationId,
        },
      })
      created.inventoryItems += 1
      await tx.stockTransaction.create({
        data: {
          inventoryItemId: invItem.id,
          type: 'procurement',
          quantity,
          previousQty: 0,
          newQty: quantity,
          costPerUnit: 0,
          totalCost: 0,
          reason: 'Začetna zaloga (onboarding)',
        },
      })
    }

    // --- 6. TOTALS (poročanje UI) ---
    const [totalCategories, totalItems, totalModifierGroups] = await Promise.all([
      tx.category.count({ where: { menuId: menu.id } }),
      tx.menuItem.count({ where: { category: { menuId: menu.id } } }),
      tx.modifierGroup.count({ where: { locationId } }),
    ])

    return {
      template: params.venueType,
      menuName: template.menuName,
      created,
      totals: {
        categories: totalCategories,
        items: totalItems,
        modifierGroups: totalModifierGroups,
      },
      skippedAttachments,
    }
  })
}
