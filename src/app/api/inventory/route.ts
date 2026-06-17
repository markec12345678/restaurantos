
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { createInventorySchema } from '@/lib/validations'
import { checkRateLimit, getClientIp, AUTHENTICATED_LIMIT } from '@/lib/rate-limit'
import { handleApiError, validateRequest } from '@/lib/api-utils'
import { buildFilterConditions, getDistinctValues, getItemsWithMeta, createInventoryItem } from './_helpers'


export async function GET(req: Request) {
  try {
    // Rate limiting — prepreči zlorabo API-ja
    const rl = checkRateLimit('inventory', getClientIp(req), AUTHENTICATED_LIMIT)
    if (!rl.allowed) return NextResponse.json({ error: 'Preveč zahtevkov' }, { status: 429, headers: { 'Retry-After': String(Math.ceil((rl.retryAfterMs || 60000) / 1000)) } })

    // FIX: Zahtevaj avtentikacijo za branje zaloge
    const authResult = await requireAuth(req, { permission: 'manage_inventory' })
    if (authResult.error) return authResult.error

    const { searchParams } = new URL(req.url)
    const distinctCategories = searchParams.get('distinctCategories')
    const distinctLocations = searchParams.get('distinctLocations')

    // ─── Poseben endpoint: vrni vse distinktne kategorije ───
    if (distinctCategories === 'true') {
      const cats = await getDistinctValues('category')
      return NextResponse.json(cats)
    }

    // ─── Poseben endpoint: vrni vse distinktne lokacije ───
    if (distinctLocations === 'true') {
      const locs = await getDistinctValues('location')
      return NextResponse.json(locs)
    }

    // Zgradi filtrirne pogoje in pridobi artikle
    const { where, fetchAll, limit, offset } = buildFilterConditions(searchParams)
    const lowStock = searchParams.get('lowStock')
    const response = await getItemsWithMeta(where, fetchAll, limit, offset, lowStock)

    return NextResponse.json(response)
  } catch (error: unknown) {
    return handleApiError(error, 'GET /api/inventory', 'Napaka pri pridobivanju zaloge')
  }
}

export async function POST(req: Request) {
  try {
    // Rate limiting — prepreči zlorabo API-ja
    const rl = checkRateLimit('inventory', getClientIp(req), AUTHENTICATED_LIMIT)
    if (!rl.allowed) return NextResponse.json({ error: 'Preveč zahtevkov' }, { status: 429, headers: { 'Retry-After': String(Math.ceil((rl.retryAfterMs || 60000) / 1000)) } })

    // FIX BUG 9: Zahtevaj avtentikacijo za ustvarjanje zaloge
    const authResult = await requireAuth(req, { permission: 'manage_inventory' })
    if (authResult.error) return authResult.error

    // FIX SECURITY: validateRequest() prepreči DoS z oversized payload
    const { data, error: validationError } = await validateRequest(req, createInventorySchema)
    if (validationError) return validationError

    const item = await createInventoryItem({ ...data, menuItemId: data.menuItemId ?? undefined }, authResult.session?.employeeId)

    return NextResponse.json(item, { status: 201 })
  } catch (error: unknown) {
    return handleApiError(error, 'POST /api/inventory', 'Napaka pri ustvarjanju zaloge')
  }
}
