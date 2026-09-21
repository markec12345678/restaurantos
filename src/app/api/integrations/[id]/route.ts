import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { deepToNumbers } from '@/lib/decimal'
import { requireAuth } from '@/lib/auth-middleware'
import { z } from 'zod'
import { handleApiError, validateRequest } from '@/lib/api-utils'
// R88-2: tenant scope kanon (R80 centralni resolver) + MODEL A write guard
import { isWithinScope, notInScopeResponse, resolveTenantLocationIdOrThrow, resolveWriteLocationId } from '@/lib/tenant-scope'
// R88-2: webhook envelope izdaja za delivery integracije (wolt/glovo/bolt)
import { getAppUrl } from '@/lib/utils'
import { isOrderingSecretConfigured, webhookEnvelopeTokenFor } from '@/lib/ordering-token'

// ============================================
// GET /api/integrations/[id] — Podrobnosti integracije
// ============================================

export const dynamic = 'force-dynamic'

// R88-2: delivery providerji z inbound webhookom (envelope URL se izda v GET)
const DELIVERY_WEBHOOK_PROVIDERS = new Set(['wolt', 'glovo', 'bolt'])

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireAuth(req, { permission: 'admin' })
  if (authResult.error) return authResult.error

  // R88-2 resolver kanon: takoj po requireAuth, PRED DB poizvedbo —
  // non-admin NULL-lokacijska seja → 403 fail-closed (M2 kanon).
  const scope = resolveTenantLocationIdOrThrow(authResult.session, new URL(req.url).searchParams, {
    endpoint: 'GET /api/integrations/[id]',
  })
  if ('error' in scope) return scope.error

  try {
    const { id } = await params

    const integration = await db.integration.findUnique({
      where: { id },
      include: {
        logs: {
          take: 50,
          orderBy: { createdAt: 'desc' },
        },
      },
    })

    if (!integration) {
      return NextResponse.json({ error: 'Integracija ni najdena' }, { status: 404 })
    }

    // R88-2 tenant scope: integracija žigana na tujo lokacijo (ali NULL žig —
    // ta je viden SAMO super-adminu, isWithinScope('loc', null) === false)
    // → unificiran 404 (ni obstoja-oraklja).
    if (!isWithinScope(scope.locationId, integration.locationId)) {
      return notInScopeResponse('Integracija')
    }

    // Prikaži API ključe samo z masko
    const sanitized: Record<string, unknown> = {
      ...integration,
      apiKey: integration.apiKey ? '••••••••' : '',
      apiSecret: integration.apiSecret ? '••••••••' : '',
    }

    // R88-2: webhookUrl SAMO za delivery providerje (wolt/glovo/bolt) —
    // envelope `?t=<integrationId>:<hmac64>` se konfigurira v portalu platforme.
    // Produkcija brez HMAC secret-a → polje IZPUŠČENO (nikoli token z javno
    // znanim dev secretom; R82-D kanon, zrcali izdajno lokacijsko ruto).
    if (
      DELIVERY_WEBHOOK_PROVIDERS.has(integration.provider) &&
      !(process.env.NODE_ENV === 'production' && !isOrderingSecretConfigured())
    ) {
      sanitized.webhookUrl = `${getAppUrl()}/api/delivery/webhook/${integration.provider}?t=${webhookEnvelopeTokenFor(integration.id)}`
    }

    return NextResponse.json(deepToNumbers(sanitized))
  } catch (error: unknown) {
    return handleApiError(error, 'GET /api/integrations/[id]', 'Napaka pri pridobivanju integracije')
  }
}

// ============================================
// PUT /api/integrations/[id] — Posodobi integracijo
// ============================================

const updateIntegrationSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  type: z.enum(['eracuni', 'accounting', 'delivery', 'crm', 'ecommerce', 'analytics', 'custom']).optional(),
  provider: z.string().max(100).optional(),
  baseUrl: z.string().optional(),
  apiKey: z.string().max(500).optional(),
  apiSecret: z.string().max(500).optional(),
  config: z.string().max(5000).optional(),
  syncEnabled: z.boolean().optional(),
  syncInterval: z.number().int().min(60).max(86400).optional(),
  events: z.string().max(2000).optional(),
  isActive: z.boolean().optional(),
  // R88-2: per-location webhook žig (nullable — null = brisanje žiga, SAMO super-admin)
  locationId: z.string().max(200).nullable().optional(),
})

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireAuth(req, { permission: 'admin' })
  if (authResult.error) return authResult.error

  // R88-2 resolver kanon: takoj po requireAuth (M2 fail-closed).
  const scope = resolveTenantLocationIdOrThrow(authResult.session, new URL(req.url).searchParams, {
    endpoint: 'PUT /api/integrations/[id]',
  })
  if ('error' in scope) return scope.error

  try {
    const { id } = await params
    const { data, error: validationError } = await validateRequest(req, updateIntegrationSchema)
    if (validationError) return validationError

    // Preveri, da integracija obstaja
    const existing = await db.integration.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Integracija ni najdena' }, { status: 404 })
    }

    // R88-2 tenant scope: tuja (ali NULL-žigana) integracija → unificiran 404
    if (!isWithinScope(scope.locationId, existing.locationId)) {
      return notInScopeResponse('Integracija')
    }

    const updateData: Record<string, unknown> = {}
    if (data.name !== undefined) updateData.name = data.name
    if (data.type !== undefined) updateData.type = data.type
    if (data.provider !== undefined) updateData.provider = data.provider
    if (data.baseUrl !== undefined) updateData.baseUrl = data.baseUrl
    // FIX CRITICAL: Ne shrani maskiranih API ključev v bazo
    if (data.apiKey !== undefined && data.apiKey !== '••••••••') updateData.apiKey = data.apiKey
    if (data.apiSecret !== undefined && data.apiSecret !== '••••••••') updateData.apiSecret = data.apiSecret
    if (data.config !== undefined) updateData.config = data.config
    if (data.syncEnabled !== undefined) updateData.syncEnabled = data.syncEnabled
    if (data.syncInterval !== undefined) updateData.syncInterval = data.syncInterval
    if (data.events !== undefined) updateData.events = data.events
    if (data.isActive !== undefined) updateData.isActive = data.isActive

    // R88-2: locationId — MODEL A write kanon (R87 guests POST vzorec):
    //   - scope-bound (regular/admin z lokacijo): body.locationId se IGNORIRA,
    //     vedno žig session lokacije (nikoli tuja lokacija prek body).
    //   - super-admin (scope null): body.locationId = string → kandidat
    //     (prazen → 400 resolveWriteLocationId), body.locationId = null →
    //     izrecno brisanje žiga (integracija postane super-admin-only vidna).
    //   Izbrani locationId se VEDNO validira proti DB (neznana → 404 'Lokacija').
    if (data.locationId !== undefined) {
      if (scope.locationId) {
        const loc = await db.location.findFirst({ where: { id: scope.locationId }, select: { id: true } })
        if (!loc) return notInScopeResponse('Lokacija')
        updateData.locationId = scope.locationId
      } else if (data.locationId === null) {
        updateData.locationId = null
      } else {
        const writeLoc = resolveWriteLocationId(scope.locationId, data.locationId)
        if (!writeLoc.ok) return writeLoc.response
        const loc = await db.location.findFirst({ where: { id: writeLoc.locationId }, select: { id: true } })
        if (!loc) return notInScopeResponse('Lokacija')
        updateData.locationId = writeLoc.locationId
      }
    }

    const integration = await db.integration.update({
      where: { id },
      data: updateData,
    })

    // FIX SECURITY: maskiraj apiKey + apiSecret v PUT odgovoru (enako kot GET)
    return NextResponse.json(deepToNumbers({
      ...integration,
      apiKey: integration.apiKey ? '••••••••' : '',
      apiSecret: integration.apiSecret ? '••••••••' : '',
    }))
  } catch (error: unknown) {
    return handleApiError(error, 'PUT /api/integrations/[id]', 'Napaka pri posodobitvi integracije')
  }
}

// ============================================
// DELETE /api/integrations/[id] — Izbriši integracijo
// ============================================

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireAuth(req, { permission: 'admin' })
  if (authResult.error) return authResult.error

  // R88-2 resolver kanon (isto šivanje kot GET/PUT — brez tega bi ostal
  // cross-tenant DELETE IDOR na isti datoteki, ki jo je ta runda scopesala).
  const scope = resolveTenantLocationIdOrThrow(authResult.session, new URL(req.url).searchParams, {
    endpoint: 'DELETE /api/integrations/[id]',
  })
  if ('error' in scope) return scope.error

  try {
    const { id } = await params

    // Preveri, da integracija obstaja
    const existing = await db.integration.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Integracija ni najdena' }, { status: 404 })
    }

    // R88-2 tenant scope: tuja (ali NULL-žigana) integracija → unificiran 404
    if (!isWithinScope(scope.locationId, existing.locationId)) {
      return notInScopeResponse('Integracija')
    }

    // FIX MEDIUM: Ovij v transakcijo — prepreči delne izbris (logi izbrisani, integracija ne)
    await db.$transaction(async (tx) => {
      await tx.integrationLog.deleteMany({ where: { integrationId: id } })
      await tx.integration.delete({ where: { id } })
    })

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    return handleApiError(error, 'DELETE /api/integrations/[id]', 'Napaka pri brisanju integracije')
  }
}
