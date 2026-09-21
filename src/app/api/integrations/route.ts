import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { deepToNumbers } from '@/lib/decimal'
import { requireAuth } from '@/lib/auth-middleware'
import { z } from 'zod'
import { handleApiError, validateRequest } from '@/lib/api-utils'
// R90-3: tenant scope kanon (R80 centralni resolver) + MODEL A write guard
// (zrcali R88-2 [id]/route.ts — list/create sta bila zadnja nescope-ana
// integracijska rake: GET je vseh tenantov integration.findMany, POST pa
// ustvarjal GLOBALNE integracije brez locationId žiga).
import { notInScopeResponse, resolveTenantLocationIdOrThrow, resolveWriteLocationId } from '@/lib/tenant-scope'
// R90-3: webhook envelope izdaja za delivery integracije (wolt/glovo/bolt)
import { getAppUrl } from '@/lib/utils'
import { isOrderingSecretConfigured, webhookEnvelopeTokenFor } from '@/lib/ordering-token'

// ============================================
// GET /api/integrations — Seznam integracij
// ============================================

export const dynamic = 'force-dynamic'

// R90-3: delivery providerji z inbound webhookom — ISTI set kot R88-2
// [id]/route.ts (ta ga ne export-a, zato podvojen; ob spremembi posodobi oba).
const DELIVERY_WEBHOOK_PROVIDERS = new Set(['wolt', 'glovo', 'bolt'])

export async function GET(req: Request) {
  const authResult = await requireAuth(req, { permission: 'admin' })
  if (authResult.error) return authResult.error

  // R90-3 resolver kanon: takoj po requireAuth, PRED DB poizvedbo —
  // non-admin NULL-lokacijska seja → 403 fail-closed (zrcali R88-2 [id] ruta).
  const scope = resolveTenantLocationIdOrThrow(authResult.session, new URL(req.url).searchParams, {
    endpoint: 'GET /api/integrations',
  })
  if ('error' in scope) return scope.error

  try {
    const { searchParams } = new URL(req.url)
    const type = searchParams.get('type')
    const isActive = searchParams.get('isActive')

    const where: Record<string, unknown> = {}
    // R90-3 tenant scope: scope-bound admin vidi SAMO integracije žigane na
    // NJEGOVO lokacijo (NULL-žigane legacy vrstice ostanejo nevidne —
    // konsistentno z R88-2 [id] kanonom, kjer isWithinScope NULL-žigane
    // vrstice pokaže IZKLJUČNO scope-null super-adminu). Super-admin
    // (scope.locationId null) → brez lokacijskega filtra (vidi vse,
    // vključno z NULL-žiganimi).
    if (scope.locationId) where.locationId = scope.locationId
    if (type) where.type = type
    if (isActive !== null) where.isActive = isActive === 'true'

    const integrations = await db.integration.findMany({
      where,
      include: {
        _count: { select: { logs: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    // Odstrani občutljive podatke iz seznama
    const sanitized = integrations.map(int => {
      const row: Record<string, unknown> = {
        ...int,
        apiKey: int.apiKey ? '••••••••' : '',
        apiSecret: int.apiSecret ? '••••••••' : '',
      }

      // R90-3: webhookUrl za delivery providerje — IDENTIČEN guard kot R88-2
      // [id] detail ruta (L71-76): envelope `?t=<integrationId>:<hmac64>` se
      // konfigurira v portalu platforme. Produkcija brez HMAC secret-a →
      // polje IZPUŠČENO (nikoli token z javno znanim dev secretom; R82-D kanon).
      if (
        DELIVERY_WEBHOOK_PROVIDERS.has(int.provider) &&
        !(process.env.NODE_ENV === 'production' && !isOrderingSecretConfigured())
      ) {
        row.webhookUrl = `${getAppUrl()}/api/delivery/webhook/${int.provider}?t=${webhookEnvelopeTokenFor(int.id)}`
      }

      return row
    })

    return NextResponse.json(deepToNumbers(sanitized))
  } catch (error: unknown) {
    return handleApiError(error, 'GET /api/integrations', 'Napaka pri pridobivanju integracij')
  }
}

// ============================================
// POST /api/integrations — Ustvari integracijo
// ============================================

const createIntegrationSchema = z.object({
  name: z.string().min(1, 'Ime je obvezno').max(200, 'Ime ne sme preseči 200 znakov'),
  type: z.enum(['eracuni', 'accounting', 'delivery', 'crm', 'ecommerce', 'analytics', 'custom'], { message: 'Neveljaven tip integracije' }),
  provider: z.string().min(1, 'Ponudnik je obvezen').max(100, 'Ponudnik ne sme preseči 100 znakov'),
  baseUrl: z.string().max(500, 'URL ne sme preseči 500 znakov').default(''),
  apiKey: z.string().max(500, 'API ključ ne sme preseči 500 znakov').default(''),
  apiSecret: z.string().max(500, 'API skrivnost ne sme preseči 500 znakov').default(''),
  config: z.string().max(5000, 'Konfiguracija ne sme preseči 5000 znakov').default('{}'),
  syncEnabled: z.boolean().default(true),
  syncInterval: z.number().int().min(60, 'Interval sinhronizacije mora biti vsaj 60 sekund').max(86400, 'Interval sinhronizacije ne sme preseči 86400 sekund').default(300),
  events: z.string().max(2000, 'Dogodki ne smejo preseči 2000 znakov').default('[]'),
  isActive: z.boolean().default(true),
  // R90-3: per-location žig (MODEL A) — nullable/optional; pomen glej write
  // kanon v handlerju (scope-bound: ignorirano; super-admin: string/null/undefined).
  locationId: z.string().min(1).max(50).nullable().optional(),
})

export async function POST(req: Request) {
  const authResult = await requireAuth(req, { permission: 'admin' })
  if (authResult.error) return authResult.error

  // R90-3 resolver kanon: takoj po requireAuth, PRED body parse (M2 fail-closed;
  // kanon "resolver precedes body parse" — zrcali R88-3 orders POST).
  const scope = resolveTenantLocationIdOrThrow(authResult.session, new URL(req.url).searchParams, {
    endpoint: 'POST /api/integrations',
  })
  if ('error' in scope) return scope.error

  try {
    const { data, error: validationError } = await validateRequest(req, createIntegrationSchema)
    if (validationError) return validationError

    // R90-3: locationId žig — MODEL A write kanon (zrcali R88-2 PUT v [id]/route.ts):
    //   a. scope-bound (session.locationId truthy): body.locationId se IGNORIRA
    //      (nikoli ne zaupamo klientu — prepreči cross-tenant žig prek body) —
    //      vedno žig session lokacije (session-sourced scope: brez DB validacije,
    //      isti vzorec kot R88-3 orders/seed).
    //   b. super-admin (scope.locationId null): body.locationId = string →
    //      kandidat, validiran proti DB (obstaja + AKTIVNA; neznana → unified
    //      404 notInScopeResponse); body.locationId = null → izrecen GLOBAL
    //      (NULL-žig — po R88-2 kanonu vidna samo super-adminom); body.locationId
    //      = undefined → 400 resolveWriteLocationId (super-admin MORA izbrati
    //      izrecno — nikoli ugibati lokacije).
    let stampedLocationId: string | null
    if (scope.locationId) {
      stampedLocationId = scope.locationId
    } else if (data.locationId === null) {
      stampedLocationId = null
    } else {
      const writeLoc = resolveWriteLocationId(scope.locationId, data.locationId)
      if (!writeLoc.ok) return writeLoc.response
      const loc = await db.location.findFirst({
        where: { id: writeLoc.locationId, isActive: true },
        select: { id: true },
      })
      if (!loc) return notInScopeResponse('Lokacija')
      stampedLocationId = writeLoc.locationId
    }

    const integration = await db.integration.create({
      data: {
        name: data.name,
        type: data.type,
        provider: data.provider,
        baseUrl: data.baseUrl,
        apiKey: data.apiKey,
        apiSecret: data.apiSecret,
        config: data.config,
        syncEnabled: data.syncEnabled,
        syncInterval: data.syncInterval,
        events: data.events,
        isActive: data.isActive,
        locationId: stampedLocationId,
      },
    })

    // FIX SECURITY: maskiraj apiKey + apiSecret v odgovoru (enako kot GET)
    // Prejšnja koda je vrnila plain secret ob kreiranju.
    const sanitized: Record<string, unknown> = {
      ...integration,
      apiKey: integration.apiKey ? '••••••••' : '',
      apiSecret: integration.apiSecret ? '••••••••' : '',
    }

    // R90-3: webhookUrl za delivery providerje — ISTI guard kot GET/[id] (konsistentnost).
    if (
      DELIVERY_WEBHOOK_PROVIDERS.has(integration.provider) &&
      !(process.env.NODE_ENV === 'production' && !isOrderingSecretConfigured())
    ) {
      sanitized.webhookUrl = `${getAppUrl()}/api/delivery/webhook/${integration.provider}?t=${webhookEnvelopeTokenFor(integration.id)}`
    }

    return NextResponse.json(deepToNumbers(sanitized), { status: 201 })
  } catch (error: unknown) {
    return handleApiError(error, 'POST /api/integrations', 'Napaka pri ustvarjanju integracije')
  }
}
