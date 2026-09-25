// ============================================
// PAMETNO NAROČANJE ZALOGE (Smart Reorder)
// Samodejno predlaga naročila glede na napovedi,
// dobavitelje in zgodovino dobav
// ============================================

import { NextResponse } from 'next/server'
import { requireAuth, resolveTenantLocationIdOrThrow } from '@/lib/auth-middleware'
import { createReorderSchema } from '@/lib/validations'
import { handleApiError, parseJsonBody, validateBody } from '@/lib/api-utils'
import { getReorderSuggestions, createReorderOrder } from './_helpers'


export const dynamic = 'force-dynamic'

// R129 (P1-07): legacy ?urgency= mapiranje na canon status filter.
// Paritetne opombe: 'critical' → kritični; 'high'/'medium' → status 'low'
// (pod točko naročila); 'low' → 'ok' (stari tok je bil za to vrednost
// v praksi prazen — zdaj pokaže zdrave artikle).
const URGENCY_TO_STATUSES: Record<string, string[]> = {
  critical: ['critical'],
  high: ['critical', 'low'],
  medium: ['low'],
  low: ['ok'],
}

export async function GET(req: Request) {
  try {
    const authResult = await requireAuth(req, { permission: 'manage_inventory' })
    if (authResult.error) return authResult.error

    const { searchParams } = new URL(req.url)

    // FIX R85-4c M7: predlogi so izračunani IZ zalogo — prej findMany brez filtra
    // (zaloga + nabavna zgodovina vseh tenantov). Scope: fail-closed 403 za
    // uporabnika brez lokacije; super-admin (null) = globalni pregled.
    const scope = resolveTenantLocationIdOrThrow(authResult.session, searchParams, {
      endpoint: 'GET /api/inventory/reorder',
    })
    if ('error' in scope) return scope.error

    // R129 (P1-07): novi filtri — ?status=low,critical (canon statusi) in
    // ?supplier=; legacy ?urgency= se mapira na canon statusi (kompatibilnost).
    const statusParam = searchParams.get('status') || ''
    const urgencyParam = searchParams.get('urgency') || ''
    const supplierParam = searchParams.get('supplier') || ''

    let statuses: string[] | undefined
    if (statusParam) {
      statuses = statusParam.split(',').map(s => s.trim()).filter(Boolean)
    } else if (urgencyParam) {
      statuses = URGENCY_TO_STATUSES[urgencyParam]
    }

    const { summary, suggestions } = await getReorderSuggestions(scope.locationId, {
      statuses,
      supplier: supplierParam || undefined,
    })

    return NextResponse.json({ summary, suggestions })
  } catch (error: unknown) {
    return handleApiError(error, 'GET /api/inventory/reorder', 'Napaka pri predlaganju naročil')
  }
}

/**
 * Ustvari naročilnico iz predlogov
 */
export async function POST(req: Request) {
  try {
    // FIX HIGH: Zahtevaj manage_inventory dovoljenje za naročanje zaloge
    const authResult = await requireAuth(req, { permission: 'manage_inventory' })
    if (authResult.error) return authResult.error

    const bodyResult = await parseJsonBody(req)
    if (bodyResult.error) return bodyResult.error

    // FIX CRITICAL: Zod validacija za naročilo zaloge
    const { data, error: validationError } = validateBody(createReorderSchema, bodyResult.data)
    if (validationError) return validationError

    const { items, employeeName } = data

    if (!items || items.length === 0) {
      return NextResponse.json({ error: 'Ni artiklov za naročilo' }, { status: 400 })
    }

    // FIX R85-4c M7 CROSS-TENANT WRITE: prej je createReorderOrder poiskal artikle
    // GLOBALNO ({ id: { in } }) in povečal zalogo TUJEMU tenantu + zapisal tuj
    // StockTransaction. Zdaj: scope razrešen iz seje in podan helperju — artikli
    // izven scope-a so "ni najden" (fail-closed, brez razkritja obstoja).
    const { searchParams } = new URL(req.url)
    const scope = resolveTenantLocationIdOrThrow(authResult.session, searchParams, {
      endpoint: 'POST /api/inventory/reorder',
    })
    if ('error' in scope) return scope.error

    // FIX HIGH: Ovij VSE postavke v eno transakcijo — prej je vsaka postavka bila v svoji
    // transakciji, kar je pustilo delne posodobitve ob napaki na 3. postavki
    const { results, errors } = await createReorderOrder(items, employeeName || '', scope.locationId)

    // Če so napake in noben artikel ni veljaven, vrni napako
    if (errors.length > 0 && errors.length === items.length) {
      return NextResponse.json({ error: ' Noben artikel ni najden', errors }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      createdOrders: results.length,
      totalCost: Math.round(results.reduce((s, r) => s + r.totalCost, 0) * 100) / 100,
      items: results,
      errors: errors.length > 0 ? errors : undefined,
    }, { status: 201 })
  } catch (error: unknown) {
    return handleApiError(error, 'POST /api/inventory/reorder', 'Napaka pri ustvarjanju naročila')
  }
}
