// ============================================
// /api/predictive-ordering — AI napovedi naročil
// ============================================
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { resolveTenantLocationIdOrThrow, resolveWriteLocationId } from '@/lib/tenant-scope'
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

    // FIX R86-4 (MEDIUM): tenant scope — prej so bila priporočila računana nad
    // zalogo/reorder pravili VSEH tenantov (tuja zaloga, tuji stroški naročil).
    const scope = resolveTenantLocationIdOrThrow(
      authResult.session,
      new URL(req.url).searchParams,
      { endpoint: 'GET /api/predictive-ordering' },
    )
    if ('error' in scope) return scope.error

    const result = await generateReorderRecommendations(scope.locationId)

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

    // FIX R86-4 (MEDIUM): tenant scope — client body.locationId ni več zaupan.
    const scope = resolveTenantLocationIdOrThrow(authResult.session, null, {
      endpoint: 'POST /api/predictive-ordering',
    })
    if ('error' in scope) return scope.error

    const body = await req.json().catch(() => ({}))
    const input = createPOSchema.parse(body)

    // R86-4: ciljna lokacija PO — session lokacija ZMAGA nad body.locationId
    // (regular/lokovani admin); super-admin lahko podа izrecno lokacijo, brez nje
    // → 400 fail-closed (prej je bil tuji žig PO prek poljubnega body.locationId).
    const writeRes = resolveWriteLocationId(scope.locationId, input.locationId)
    if (!writeRes.ok) return writeRes.response

    // Generiraj priporočila (scoped na session lokacijo)
    const { recommendations } = await generateReorderRecommendations(scope.locationId)

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
      writeRes.locationId,
      input.createdBy,
    )

    return NextResponse.json({ success: true, ...result }, { status: 201 })
  } catch (err) {
    return handleApiError(err, 'predictive-ordering POST')
  }
}
