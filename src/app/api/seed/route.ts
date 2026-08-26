import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { deepToNumbers } from '@/lib/decimal'
import { handleApiError } from '@/lib/api-utils'
import { checkRateLimit, getClientIp, SEED_LIMIT } from '@/lib/rate-limit'
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
    const rateLimit = checkRateLimit('seed', ip, SEED_LIMIT)
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

    // FIX AUDIT: Pravilno nastavi DDV stopnjo glede na kategorijo
    // Hrana in brezalkoholne pijače = 9.5%, alkohol = 22%
    const alcoholCategories = ['Vina', 'Bela vina', 'Rdeča vina', 'Rosé vina', 'Penine', 'Pivo', 'Točeno pivo',
      'Craft piva', 'Brezalk. pivo', 'Žgane pijače', 'Destilati', 'Likerji', 'Likersko vino', 'Gin', 'Viski',
      'Tuja vina', 'Penine']
    const nonAlcoholCategories = ['Tople napitke', 'Gazirane pijače', 'Sokovi', 'Vode']

    for (const item of menuItemsData) {
      if (item.vatRate === undefined) {
        const catName = cats[item.categoryId]?.name || ''
        if (alcoholCategories.some(c => catName.includes(c))) {
          item.vatRate = 22.0
        } else if (nonAlcoholCategories.some(c => catName.includes(c))) {
          item.vatRate = 9.5
        } else {
          // Hrana = 9.5%
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
