// ============================================
// LOKACIJA DETAIL — Posodobi, izbriši, pridobi podrobnosti
// ============================================

import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { deepToNumbers } from '@/lib/decimal'
import { requireAuth } from '@/lib/auth-middleware'
import { checkRateLimitAsync, getClientIp, AUTHENTICATED_LIMIT } from '@/lib/rate-limit'
// R93-b: enoten 429 helper (rate-limit/response.ts) — DIREKTEN import, ne barrel:
// testi mockajo '@/lib/rate-limit' z vi.hoisted, direkten path teče realen helper.
import { rateLimitedResponse } from '@/lib/rate-limit/response'
import { handleApiError, validateRequest } from '@/lib/api-utils'
import { updateLocationSchema } from './_helpers'
import { maskLocationSecrets } from '@/lib/secret-masks'
import { isWithinScope, notInScopeResponse, resolveTenantLocationIdOrThrow } from '@/lib/tenant-scope'

// FIX R80 (tenant scope): lokacija JE tenant root (runda 76 /locations/sync vzorec).
// Skupni guard za VSE handlerje v tej datoteki (GET/PUT/DELETE): lokacijsko vezana
// seja sme dostopati SAMO do svoje lokacije (GET je vračal _count ×6 + order.aggregate
// dnevni promet/tips za POLJUBNO lokacijo; PUT/DELETE pa pisanje po tujem tenantu).
// Super-admin (session.locationId = null) ima cross-lokacijski nadzor.
// FIX R86-2c1 (M2): prej je guard pri NULL session.locationId kar spustil
// (`if (sessionLocId && …)`), tako da je non-admin seja z 'admin' permissionom
// in NULL lokacijo (session-lifecycle sprejme null za vse role) lahko brala/
// pisala POLJUBNO lokacijo. Zdaj: centralni resolver — non-admin NULL → 403
// fail-closed PRED vsako poizvedbo; admin/super-admin null = globalni.
function guardLocationScope(
  session: { locationId?: string | null; role?: string } | null | undefined,
  id: string,
): NextResponse | null {
  const scope = resolveTenantLocationIdOrThrow(session, undefined, {
    endpoint: '/api/locations/[id] scope guard',
  })
  if ('error' in scope) return scope.error
  if (scope.locationId && !isWithinScope(scope.locationId, id)) {
    // Namerno 404 — ne razkrivamo obstoja tuje lokacije.
    return notInScopeResponse('Lokacija')
  }
  return null
}


// ============================================
// GET /api/locations/[id] — Podrobnosti lokacije
// ============================================

export const dynamic = 'force-dynamic'

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireAuth(req, { permission: 'admin' })
  if (authResult.error) return authResult.error

  try {
    const { id } = await params
    const denied = guardLocationScope(authResult.session, id)
    if (denied) return denied

    const location = await db.location.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            orders: true,
            tables: true,
            employees: true,
            inventoryItems: true,
            cashShifts: true,
            reservations: true,
          },
        },
        tables: {
          where: { status: 'occupied' },
          take: 20,
        },
      },
    })

    if (!location) {
      return NextResponse.json({ error: 'Lokacija ni najdena' }, { status: 404 })
    }

    // Dnevna statistika za lokacijo
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const todayStats = await db.order.aggregate({
      where: {
        locationId: id,
        paymentStatus: 'paid',
        paidAt: { gte: today },
      },
      _sum: { total: true, tip: true },
      _count: true,
    })

    // FIX SECURITY: maskiraj fursCertPassword + fursCertPath pred vračanjem klientu
    return NextResponse.json({
      ...maskLocationSecrets(location),
      todayStats: {
        totalSales: todayStats._sum.total || 0,
        totalTips: todayStats._sum.tip || 0,
        totalOrders: todayStats._count,
      },
    })
  } catch (error: unknown) {
    return handleApiError(error, 'GET /api/locations/[id]', 'Napaka pri pridobivanju lokacije')
  }
}

// ============================================
// PUT /api/locations/[id] — Posodobi lokacijo
// ============================================

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireAuth(req, { permission: 'admin' })
  if (authResult.error) return authResult.error

  // R92-a: rate limit TAKOJ po requireAuth — samo avtenticirani klici trošijo
  // vedro (anonimni probe-i ne onesnažijo NAT vedra pisarne); fail-closed
  // (checkRateLimitAsync zavrača, če cache odpove — core.ts kanon).
  // Fiksni ključ 'locations-mutate' (NE iz pathname): en IP ne more fan-out
  // prek različnih locationId-jev — pathname-izpeljan ključ bi vsaki lokaciji
  // dal svoje vedro. PUT+DELETE delita vedro (isti write kanon, zrcali rotate
  // R91-4); GET ostane brez vedra (ceneni read).
  const rateCheck = await checkRateLimitAsync('locations-mutate', getClientIp(req), AUTHENTICATED_LIMIT)
  if (!rateCheck.allowed) {
    // 429 oblika = hišni kanon (withRateLimit HOF): Retry-After / X-RateLimit-*
    // glave, fallback 60 s, ko odgovor ne nosi retryAfterMs.
    return rateLimitedResponse(rateCheck.retryAfterMs)
  }

  try {
    const { id } = await params
    const denied = guardLocationScope(authResult.session, id)
    if (denied) return denied

    const { data, error: validationError } = await validateRequest(req, updateLocationSchema)
    if (validationError) return validationError

    // Preveri, da lokacija obstaja
    const existing = await db.location.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Lokacija ni najdena' }, { status: 404 })
    }

    // Če spreminjamo kodo, preveri unikatnost
    if (data.code && data.code !== existing.code) {
      const codeExists = await db.location.findUnique({ where: { code: data.code } })
      if (codeExists) {
        return NextResponse.json({ error: `Koda "${data.code}" je že zasedena` }, { status: 409 })
      }
    }

    const location = await db.location.update({
      where: { id },
      data,
    })

    // FIX SECURITY: maskiraj fursCertPassword + fursCertPath v odgovoru
    return NextResponse.json(deepToNumbers(maskLocationSecrets(location)))
  } catch (error: unknown) {
    return handleApiError(error, 'PUT /api/locations/[id]', 'Napaka pri posodobitvi lokacije')
  }
}

// ============================================
// DELETE /api/locations/[id] — Izbriši/deaktiviraj lokacijo
// ============================================

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireAuth(req, { permission: 'admin' })
  if (authResult.error) return authResult.error

  // R92-a: isti vedro kot PUT ('locations-mutate') — isti write kanon,
  // fail-closed; fiksni ključ preprečuje per-locationId fan-out iz enega IP-ja.
  const rateCheck = await checkRateLimitAsync('locations-mutate', getClientIp(req), AUTHENTICATED_LIMIT)
  if (!rateCheck.allowed) {
    // 429 oblika = hišni kanon (withRateLimit HOF): Retry-After / X-RateLimit-*
    // glave, fallback 60 s, ko odgovor ne nosi retryAfterMs.
    return rateLimitedResponse(rateCheck.retryAfterMs)
  }

  try {
    const { id } = await params
    const denied = guardLocationScope(authResult.session, id)
    if (denied) return denied

    const location = await db.location.findUnique({ where: { id } })
    if (!location) {
      return NextResponse.json({ error: 'Lokacija ni najdena' }, { status: 404 })
    }

    // Preveri, da lokacija nima aktivnih naročil
    const activeOrders = await db.order.count({
      where: {
        locationId: id,
        status: { in: ['pending', 'in-progress', 'ready'] },
      },
    })

    if (activeOrders > 0) {
      return NextResponse.json({
        error: `Lokacija ima ${activeOrders} aktivnih naročil — najprej jih zaključite`,
      }, { status: 400 })
    }

    // Soft delete — deaktiviraj namesto brisanja
    await db.location.update({
      where: { id },
      data: { isActive: false, isOpen: false },
    })

    return NextResponse.json({ success: true, action: 'deactivated' })
  } catch (error: unknown) {
    return handleApiError(error, 'DELETE /api/locations/[id]', 'Napaka pri brisanju lokacije')
  }
}
