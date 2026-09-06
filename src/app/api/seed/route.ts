import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { deepToNumbers } from '@/lib/decimal'
import { handleApiError } from '@/lib/api-utils'
import { checkRateLimitAsync, getClientIp, SEED_LIMIT } from '@/lib/rate-limit'
import { requireAuth } from '@/lib/auth-middleware'
import { getMenuItemsData } from './helpers/menu-items'
import { seedAllConfig } from './helpers/config-data'
import { seedDemoData } from './helpers/demo-data'
import { cleanupExistingData } from './_helpers'
import { seedMenusAndCategories } from './helpers/seed-structure'
import { seedModifierGroups } from './helpers/seed-modifiers'


export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  try {
    const authResult = await requireAuth(req, { permission: 'admin' })
    if (authResult.error) return authResult.error

    const ip = getClientIp(req)
    const rateLimit = await checkRateLimitAsync('seed', ip, SEED_LIMIT)
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Preveč zahtevkov. Seed je omejen na 3 zahtevke na uro.' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil((rateLimit.retryAfterMs || 3600000) / 1000)) } }
      )
    }

    await cleanupExistingData()

    const { cats } = await seedMenusAndCategories()
    const mods = await seedModifierGroups()

    const menuItemsData = getMenuItemsData(cats, mods)

    // FIX AUD-01: Pravilno nastavi DDV stopnjo glede na kategorijo
    // FIX: Uporabljamo exact match (case-insensitive) namesto includes() —
    // includes() je krhko: "Bela vina" bi se ujemalo z "Ne-bela vina" če bi obstajala.
    const alcoholCategoryNames = ['Bela vina', 'Rdeča vina', 'Rosé vina', 'Penine', 'Točeno pivo',
      'Pivo', 'Craft piva', 'Brezalk. pivo', 'Žgane pijače', 'Destilati', 'Likerji',
      'Likersko vino', 'Gin', 'Viski', 'Tuja vina', 'Mešane pijače']
    const nonAlcoholCategoryNames = ['Topli napitki', 'Gazirane pijače', 'Sokovi', 'Vode', 'Naravni sokovi']

    // Zgradi lookup: categoryId → categoryName (en poizvedba, ne N)
    const allCategories = await db.category.findMany({ select: { id: true, name: true } })
    const categoryIdToName = new Map(allCategories.map(c => [c.id, c.name.toLowerCase()]))

    // Normaliziraj sezname za hitro iskanje (Set za O(1) lookup)
    const alcoholSet = new Set(alcoholCategoryNames.map(n => n.toLowerCase()))
    const nonAlcoholSet = new Set(nonAlcoholCategoryNames.map(n => n.toLowerCase()))

    for (const item of menuItemsData) {
      if (item.vatRate === undefined) {
        const catName = categoryIdToName.get(item.categoryId) || ''
        // FIX: Exact match (case-insensitive) namesto fragile includes()
        if (alcoholSet.has(catName)) {
          item.vatRate = 22.0  // Alkohol = 22% DDV (SI)
        } else if (nonAlcoholSet.has(catName)) {
          item.vatRate = 9.5   // Brezalkoholne pijače = 9.5% DDV (SI)
        } else {
          // Hrana = 9.5% DDV (SI) — default za vse nepijačne kategorije
          // Opomba: embalaža in storitve bi morale imeti 22%, a se v seedu
          // ne uporabljajo kot menu item-i (so konfiguracijski podatki)
          item.vatRate = 9.5
        }
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Prisma MenuItem return type with dynamic fields
    const menuItems: any[] = []
    for (const itemData of menuItemsData) {
      const { modifierGroupIds, ...itemFields } = itemData
      const item = await db.menuItem.create({ data: itemFields })
      for (let i = 0; i < modifierGroupIds.length; i++) {
        await db.menuItemModifierGroup.create({
          data: { menuItemId: item.id, modifierGroupId: modifierGroupIds[i], sortOrder: i }
        })
      }
      menuItems.push(item)
    }

    await seedDemoData(menuItems)
    await seedAllConfig()

    return NextResponse.json({ success: true, message: 'Podatki so bili uspešno naloženi s slovensko ponudbo, vinsko kartico in konfiguracijo' })
  } catch (error: unknown) {
    return handleApiError(error, 'POST /api/seed', 'Napaka pri nalaganju podatkov')
  }
}
