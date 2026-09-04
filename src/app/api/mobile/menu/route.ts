// ============================================
// /api/mobile/menu — Mobile-friendly menu
// ============================================
// Optimiziran za mobilne naprave (manj podatkov, hitrejši response).
// Uporablja API key auth (ne session).
// ============================================
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { handleApiError } from '@/lib/api-utils'
import { verifyApiKey } from '@/lib/api-security'
import { toNum } from '@/lib/decimal'

export const dynamic = 'force-dynamic'

// GET — mobile menu (kompakten format)
export async function GET(req: Request) {
  try {
    // API key auth (za mobile app)
    const authHeader = req.headers.get('authorization')
    const apiKeyResult = await verifyApiKey(authHeader)

    if (!apiKeyResult.valid) {
      return NextResponse.json({ error: apiKeyResult.error }, { status: 401 })
    }

    // Preveri scope
    if (!apiKeyResult.apiKey?.scopes.includes('read:menu') && !apiKeyResult.apiKey?.scopes.includes('admin')) {
      return NextResponse.json({ error: 'Nimaš dovoljenja za menu' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const locationId = searchParams.get('locationId')

    // Pridobi meni (samo aktivni artikli)
    const menuItems = await db.menuItem.findMany({
      where: {
        isAvailable: true,
        ...(locationId ? { locationId } : {}),
      },
      select: {
        id: true,
        name: true,
        description: true,
        price: true,
        image: true,
        categoryId: true,
        allergens: true,
      },
      orderBy: { name: 'asc' },
    })

    // Pridobi kategorije posebej
    const categoryIds = [...new Set(menuItems.map((i) => i.categoryId).filter(Boolean))]
    const categories = await db.category.findMany({
      where: { id: { in: categoryIds as string[] } },
      select: { id: true, name: true, sortOrder: true },
    })

    // Grupiraj po kategorijah za mobilni prikaz
    const grouped: Record<string, {
      categoryId: string
      categoryName: string
      items: Array<{
        id: string
        name: string
        description: string
        price: number
        image: string
        allergens: string[]
      }>
    }> = {}

    for (const item of menuItems) {
      const catId = item.categoryId || 'uncategorized'
      if (!grouped[catId]) {
        const cat = categories.find((c) => c.id === catId)
        grouped[catId] = {
          categoryId: catId,
          categoryName: cat?.name || 'Ostalo',
          items: [],
        }
      }
      grouped[catId].items.push({
        id: item.id,
        name: item.name,
        description: item.description,
        price: toNum(item.price),
        image: item.image,
        allergens: JSON.parse(item.allergens || '[]'),
      })
    }

    return NextResponse.json({
      categories: Object.values(grouped),
      totalCount: menuItems.length,
      currency: 'EUR',
      lastUpdated: new Date().toISOString(),
    })
  } catch (err) {
    return handleApiError(err, 'mobile/menu GET')
  }
}
