// ============================================
// /api/predictive-ordering — AI napovedi naročil
// ============================================
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { handleApiError } from '@/lib/api-utils'
import { z } from 'zod'
import {
  generateReorderRecommendations,
  createPurchaseOrderFromRecommendations,
} from '@/lib/predictive-ordering'

export const dynamic = 'force-dynamic'

// GET — priporočila za naročila
export async function GET(req: Request) {
  try {
    const authResult = await requireAuth(req, { permission: 'view_reports' })
    if (authResult.error) return authResult.error

    const result = await generateReorderRecommendations()

    return NextResponse.json(result)
  } catch (err) {
    return handleApiError(err, 'predictive-ordering GET')
  }
}

// POST — kreiraj PO iz priporočil
const createPOSchema = z.object({
  supplierId: z.string().min(1),
  inventoryItemIds: z.array(z.string()).optional(), // če ni podano, vzemi vsa priporočila
  locationId: z.string().optional(),
  createdBy: z.string().optional(),
})

export async function POST(req: Request) {
  try {
    const authResult = await requireAuth(req, { permission: 'manage_inventory' })
    if (authResult.error) return authResult.error

    const body = await req.json().catch(() => ({}))
    const input = createPOSchema.parse(body)

    // Generiraj priporočila
    const { recommendations } = await generateReorderRecommendations()

    // Filtriraj po izbiri
    const filtered = input.inventoryItemIds
      ? recommendations.filter((r) => input.inventoryItemIds!.includes(r.inventoryItemId))
      : recommendations

    if (filtered.length === 0) {
      return NextResponse.json({ error: 'Ni priporočil za kreiranje PO' }, { status: 400 })
    }

    const result = await createPurchaseOrderFromRecommendations(
      filtered,
      input.supplierId,
      input.locationId,
      input.createdBy,
    )

    return NextResponse.json({ success: true, ...result }, { status: 201 })
  } catch (err) {
    return handleApiError(err, 'predictive-ordering POST')
  }
}
