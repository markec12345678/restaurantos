import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { deepToNumbers } from '@/lib/decimal'
import { requireAuth } from '@/lib/auth-middleware'
import { resolveTenantLocationIdOrThrow } from '@/lib/tenant-scope'
import { z } from 'zod'
import { handleApiError, validateRequest } from '@/lib/api-utils'
import { maskWebhookSecret } from '@/lib/secret-masks'

// Validacijska shema za kreiranje webhooka
const createWebhookSchema = z.object({
  name: z.string().min(1, 'Ime je obvezno').max(200, 'Ime ne sme preseči 200 znakov'),
  url: z.string().url('URL mora biti veljaven').max(500, 'URL ne sme preseči 500 znakov'),
  events: z.string().max(2000, 'Dogodki ne smejo preseči 2000 znakov').default('[]'),
  isActive: z.boolean().default(true),
  secret: z.string().max(200, 'Skrivnost ne sme preseči 200 znakov').default(''),
  // R83-FIX: izbirna lokacija — uporablja se SAMO pri platformnem adminu (brez
  // lokacije v seji). Lokacijski admin jo NE more podati (vedno session lokacija).
  locationId: z.string().min(1).max(50).optional(),
})

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  // AVTENTIKACIJA: Webhooki so občutljivi - samo admin
  const authResult = await requireAuth(req, { permission: 'admin' })
  if (authResult.error) return authResult.error

  try {
    const { searchParams } = new URL(req.url)
    const isActive = searchParams.get('isActive')

    // R83-FIX: tenant scope — prej je lokacijski admin videl webhook-e VSEH
    // tenantov (URL-ji = potencialno tajne integration endpoint-i).
    const scope = resolveTenantLocationIdOrThrow(authResult.session, searchParams, {
      endpoint: 'GET /api/webhooks',
    })
    if ('error' in scope) return scope.error

    const where: Record<string, unknown> = {}
    if (isActive !== null) where.isActive = isActive === 'true'
    if (scope.locationId) where.locationId = scope.locationId

    const webhooks = await db.webhook.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    })

    // FIX SECURITY: maskiraj webhook secret v GET odgovoru
    return NextResponse.json(deepToNumbers(webhooks.map(maskWebhookSecret)))
  } catch (error: unknown) {
    return handleApiError(error, 'GET /api/webhooks', 'Napaka pri pridobivanju spletnih kljuk')
  }
}

export async function POST(req: Request) {
  // AVTENTIKACIJA: Ustvarjanje webhookov - samo admin
  const authResult = await requireAuth(req, { permission: 'admin' })
  if (authResult.error) return authResult.error

  try {
    const result = await validateRequest(req, createWebhookSchema)
    if (result.error) return result.error

    const data = result.data

    // R83-FIX: locationId stamp — prej je bil VSAK API-kreiran webhook GLOBALEN
    // (brez locationId) → lokacijski admin je lahko ustvaril webhook, ki je prejemal
    // dogodke VSEH tenantov (order.paid zneski/tip, guest.created email, dostavni
    // naslovi). Zdaj: lokacijski admin → webhook vezan na NJEGOVO lokacijo;
    // platformni admin (brez lokacije) → globalni webhook (pooblaščen) ali
    // izbirna validirana body.locationId.
    // R86-2c2 (M2 klasa): žig je izpeljan prek kanonskega resolverja — non-admin
    // seja z NULL lokacijo (session-lifecycle sprejme null za vse role) je prej
    // utiho ustvarila GLOBALNI webhook (dogodki vseh tenantov) ali žigala
    // poljuben body.locationId. Zdaj: 403 fail-closed.
    const scope = resolveTenantLocationIdOrThrow(authResult.session, new URL(req.url).searchParams, {
      endpoint: 'POST /api/webhooks',
    })
    if ('error' in scope) return scope.error
    let webhookLocationId: string | null = scope.locationId
    if (!webhookLocationId && data.locationId) {
      const loc = await db.location.findUnique({ where: { id: data.locationId }, select: { id: true } })
      if (!loc) {
        return NextResponse.json({ error: 'Neveljavna lokacija (locationId ne obstaja)' }, { status: 400 })
      }
      webhookLocationId = data.locationId
    }

    // Samodejno generiraj secret če ni podan (Web Crypto API - Edge Runtime kompatibilen)
    const randomBytes = new Uint8Array(32)
    crypto.getRandomValues(randomBytes)
    const hexSecret = Array.from(randomBytes, b => b.toString(16).padStart(2, '0')).join('')
    const secret = data.secret || `whsec_${hexSecret}`

    const webhook = await db.webhook.create({
      data: {
        name: data.name,
        url: data.url,
        events: data.events,
        isActive: data.isActive,
        secret,
        ...(webhookLocationId ? { locationId: webhookLocationId } : {}),
      },
    })

    // NOTE: POST vrne neo-maskiran secret — uporabnik ga mora videti enkrat
    // ob kreiranju, da ga lahko kopira. Vsi nadaljnji GET klici ga maskirajo.
    return NextResponse.json(webhook, { status: 201 })
  } catch (error: unknown) {
    return handleApiError(error, 'POST /api/webhooks', 'Napaka pri ustvarjanju spletne kljuke')
  }
}
