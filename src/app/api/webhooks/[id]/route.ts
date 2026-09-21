import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { deepToNumbers } from '@/lib/decimal'
import { requireAuth } from '@/lib/auth-middleware'
import { checkRateLimitAsync, getClientIp, AUTHENTICATED_LIMIT } from '@/lib/rate-limit'
import { resolveTenantLocationIdOrThrow } from '@/lib/tenant-scope'
import { z } from 'zod'
import { handleApiError, validateRequest } from '@/lib/api-utils'
import { maskWebhookSecret } from '@/lib/secret-masks'

// FIX HIGH: Zod validacija za posodobitev webhooka — prepreči injection
const updateWebhookSchema = z.object({
  name: z.string().min(1, 'Ime je obvezno').max(200, 'Ime ne sme preseči 200 znakov').optional(),
  url: z.string().url('URL mora biti veljaven').max(500, 'URL ne sme preseči 500 znakov').optional(),
  events: z.string().max(2000, 'Dogodki ne smejo preseči 2000 znakov').optional(),
  isActive: z.boolean().optional(),
  secret: z.string().max(200, 'Skrivnost ne sme preseči 200 znakov').optional(),
})

export const dynamic = 'force-dynamic'

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  // AVTENTIKACIJA: Urejanje webhookov - samo admin
  const authResult = await requireAuth(req, { permission: 'admin' })
  if (authResult.error) return authResult.error

  // R92-a: rate limit TAKOJ po requireAuth — samo avtenticirani klici trošijo
  // vedro (anonimni probe-i ne onesnažijo NAT vedra pisarne); fail-closed
  // (checkRateLimitAsync zavrača, če cache odpove — core.ts kanon).
  // Fiksni ključ 'webhooks-mutate' (NE iz pathname): en IP ne more fan-out
  // prek različnih webhookId-jev — pathname-izpeljan ključ bi vsakemu
  // webhooku dal svoje vedro. PUT+DELETE delita vedro (isti write kanal).
  const rateCheck = await checkRateLimitAsync('webhooks-mutate', getClientIp(req), AUTHENTICATED_LIMIT)
  if (!rateCheck.allowed) {
    // 429 oblika = hišni kanon (withRateLimit HOF): Retry-After / X-RateLimit-*
    // glave, fallback 60 s, ko odgovor ne nosi retryAfterMs.
    const retryAfter = Math.ceil((rateCheck.retryAfterMs ?? 60000) / 1000)
    return NextResponse.json(
      { error: 'Preveč zahtev. Poskusite znova čez nekaj časa.' },
      {
        status: 429,
        headers: {
          'Retry-After': String(retryAfter),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': String(Math.ceil(Date.now() / 1000) + retryAfter),
        },
      }
    )
  }

  try {
    const { id } = await params

    // R86-2c2 (M2 klasa): scope iz kanonskega resolverja — fail-closed PRED body
    // parsanjem. Prej raw spread `session?.locationId ?? undefined` je bil
    // fail-OPEN za non-admin seja z NULL lokacijo (session-lifecycle.ts:114-117
    // jo sprejme) → prazen filter = urejanje poljubnega tujeja webhooka.
    const scope = resolveTenantLocationIdOrThrow(authResult.session, new URL(req.url).searchParams, {
      endpoint: 'PUT /api/webhooks/[id]',
    })
    if ('error' in scope) return scope.error

    const result = await validateRequest(req, updateWebhookSchema)
    if (result.error) return result.error

    const data = result.data

    // Preveri, da webhook obstaja (FIX IDOR: findUnique → findFirst z locationId scope
    // — location-scoped admin ne more urejati webhookov tuje lokacije/tenanta)
    const existing = await db.webhook.findFirst({
      where: { id, ...(scope.locationId ? { locationId: scope.locationId } : {}) },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Webhook ni najden' }, { status: 404 })
    }

    const updateData: Record<string, unknown> = {}
    if (data.name !== undefined) updateData.name = data.name
    if (data.url !== undefined) updateData.url = data.url
    if (data.events !== undefined) updateData.events = data.events
    if (data.isActive !== undefined) updateData.isActive = data.isActive
    if (data.secret !== undefined) updateData.secret = data.secret

    const webhook = await db.webhook.update({
      where: { id },
      data: updateData,
    })

    // FIX SECURITY: maskiraj webhook secret v PUT odgovoru
    return NextResponse.json(deepToNumbers(maskWebhookSecret(webhook)))
  } catch (error: unknown) {
    return handleApiError(error, 'PUT /api/webhooks/[id]', 'Napaka pri posodobitvi webhooka')
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  // AVTENTIKACIJA: Brisanje webhookov - samo admin
  const authResult = await requireAuth(req, { permission: 'admin' })
  if (authResult.error) return authResult.error

  // R92-a: isti vedro kot PUT ('webhooks-mutate') — isti write kanal,
  // fail-closed; fiksni ključ preprečuje per-id fan-out iz enega IP-ja.
  const rateCheck = await checkRateLimitAsync('webhooks-mutate', getClientIp(req), AUTHENTICATED_LIMIT)
  if (!rateCheck.allowed) {
    // 429 oblika = hišni kanon (withRateLimit HOF): Retry-After / X-RateLimit-*
    // glave, fallback 60 s, ko odgovor ne nosi retryAfterMs.
    const retryAfter = Math.ceil((rateCheck.retryAfterMs ?? 60000) / 1000)
    return NextResponse.json(
      { error: 'Preveč zahtev. Poskusite znova čez nekaj časa.' },
      {
        status: 429,
        headers: {
          'Retry-After': String(retryAfter),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': String(Math.ceil(Date.now() / 1000) + retryAfter),
        },
      }
    )
  }

  try {
    const { id } = await params

    // FIX IDOR (tenant scope): izbriši SAMO webhook znotraj session lokacije
    // (super admin z locationId=null vidi vse)
    // R86-2c2 (M2 klasa): resolver namesto raw spread — non-admin NULL lokacija
    // → 403 fail-closed (prej: globalni deleteMany).
    const scope = resolveTenantLocationIdOrThrow(authResult.session, new URL(req.url).searchParams, {
      endpoint: 'DELETE /api/webhooks/[id]',
    })
    if ('error' in scope) return scope.error
    const deleted = await db.webhook.deleteMany({
      where: { id, ...(scope.locationId ? { locationId: scope.locationId } : {}) },
    })
    if (deleted.count === 0) {
      return NextResponse.json({ error: 'Webhook ni najden' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    return handleApiError(error, 'DELETE /api/webhooks/[id]', 'Napaka pri brisanju spletne kljuke')
  }
}
