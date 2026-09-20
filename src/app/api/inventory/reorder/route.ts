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

export async function GET(req: Request) {
  try {
    const authResult = await requireAuth(req, { permission: 'manage_inventory' })
    if (authResult.error) return authResult.error

    const { searchParams } = new URL(req.url)
    const urgency = searchParams.get('urgency') || '' // filter by urgency

    // FIX R85-4c M7: predlogi so izračunani IZ zalogo — prej findMany brez filtra
    // (zaloga + nabavna zgodovina vseh tenantov). Scope: fail-closed 403 za
    // uporabnika brez lokacije; super-admin (null) = globalni pregled.
    const scope = resolveTenantLocationIdOrThrow(authResult.session, searchParams, {
      endpoint: 'GET /api/inventory/reorder',
    })
    if ('error' in scope) return scope.error

    const { summary, suggestions } = await getReorderSuggestions(urgency, scope.locationId)

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
