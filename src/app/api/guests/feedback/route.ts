// ============================================
// GUEST FEEDBACK API — Povratne informacije gostov
// Toast POS + OpenTable standard
// Avtentikacija + Zod validacija
// ============================================

// ============================================
// GET - Pridobi povratne informacije
// ============================================
import { db, createAuditLog } from '@/lib/db'
import { NextResponse } from 'next/server'
// odstranjen prazen import (runda 12 lint cleanup)
import { requireAuth } from '@/lib/auth-middleware'
import { createGuestFeedbackSchema } from '@/lib/validations'
import { handleApiError, parseJsonBody, parsePaginationParams, validateBody } from '@/lib/api-utils'
import { resolveTenantLocationIdOrThrow, resolveWriteLocationId } from '@/lib/tenant-scope'
// P1-14 (R140-b): skupni SELECT whitelist (GET + PATCH pariteta) — brez
// notranjih/workerskih stolpcev, nova polja (status/tableNumber/orderRef/...)
// so vključena; glej _helpers/feedback-select.ts
import { FEEDBACK_SELECT } from './_helpers/feedback-select'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  try {
    const authResult = await requireAuth(req, { permission: 'take_orders' })
    if (authResult.error) return authResult.error

    const { searchParams } = new URL(req.url)
    const rating = searchParams.get('rating')
    // P1-16: centralna pagination validacija (limit max, search dolžina)
    const { limit } = parsePaginationParams(searchParams, { defaultLimit: 50 })

    // FIX R80 (tenant scope): GuestFeedback IMA locationId, a je bil GET
    // nefiltriran — take_orders staff je videl PII gostov (guestName, comments,
    // NPS) VSEH lokacij. Scope iz seje: session.locationId → filter; fail-closed
    // za non-admin BREZ lokacije (403, data-integrity edge); admin brez lokacije
    // (super-admin) = nefiltriran globalni pregled.
    const scope = resolveTenantLocationIdOrThrow(authResult.session, searchParams, {
      endpoint: 'GET /api/guests/feedback',
    })
    if ('error' in scope) return scope.error
    const locFilter = scope.locationId ? { locationId: scope.locationId } : {}

    const where: Record<string, unknown> = { ...locFilter }
    if (rating) {
      where.overallRating = parseInt(rating)
    }

    const [feedbacks, totalCount] = await Promise.all([
      db.guestFeedback.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        // P1-14 (R140-b): whitelist namesto celotnih vrstic (canon r85/r137)
        select: FEEDBACK_SELECT,
      }),
      db.guestFeedback.count({ where }),
    ])

    // FIX MEDIUM: Uporabi aggregate/groupBy namesto pridobivanja vseh zapisov
    // FIX R80: stats aggregate je prav tako scoped na lokacijo (locFilter)
    const statsAgg = await db.guestFeedback.aggregate({
      where: locFilter,
      _count: true,
      _avg: {
        overallRating: true,
        foodRating: true,
        serviceRating: true,
        atmosphereRating: true,
      },
    })

    const promoterCount = await db.guestFeedback.count({ where: { overallRating: { gte: 4 }, ...locFilter } })
    const detractorCount = await db.guestFeedback.count({ where: { overallRating: { lte: 2 }, ...locFilter } })
    const wouldReturnCount = await db.guestFeedback.count({ where: { wouldReturn: true, ...locFilter } })
    const wouldRecommendCount = await db.guestFeedback.count({ where: { wouldRecommend: true, ...locFilter } })
    const statsTotalCount = statsAgg._count

    const stats = {
      total: statsTotalCount,
      avgRating: statsAgg._avg.overallRating
        ? Math.round(statsAgg._avg.overallRating * 10) / 10
        : 0,
      avgFoodRating: statsAgg._avg.foodRating
        ? Math.round(statsAgg._avg.foodRating * 10) / 10
        : 0,
      avgServiceRating: statsAgg._avg.serviceRating
        ? Math.round(statsAgg._avg.serviceRating * 10) / 10
        : 0,
      avgAtmosphereRating: statsAgg._avg.atmosphereRating
        ? Math.round(statsAgg._avg.atmosphereRating * 10) / 10
        : 0,
      nps: statsTotalCount > 0
        ? Math.round(((promoterCount - detractorCount) / statsTotalCount) * 100)
        : 0,
      wouldReturnPercent: statsTotalCount > 0
        ? Math.round((wouldReturnCount / statsTotalCount) * 100)
        : 0,
      wouldRecommendPercent: statsTotalCount > 0
        ? Math.round((wouldRecommendCount / statsTotalCount) * 100)
        : 0,
    }

    // P1-14 (R140-b): no-store — staff PII odgovor se ne sme predpomniti
    // (R124b konsistenca kanon)
    return NextResponse.json({
      feedbacks,
      stats,
      total: totalCount,
    }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error: unknown) {
    return handleApiError(error, 'GET /api/guests/feedback', 'Napaka pri pridobivanju povratnih informacij')
  }
}

// ============================================
// POST - Ustvari novo povratno informacijo
// ============================================
export async function POST(req: Request) {
  try {
    const authResult = await requireAuth(req, { permission: 'take_orders' })
    if (authResult.error) return authResult.error

    // FIX R87-4 (LOW preostanek): centralni resolver TAKOJ za requireAuth (pred
    // body parse). Prej: resolveLocationId(session, employee) je za NULL-location
    // take_orders sejo povlekel GLOBALNI prva-lokacija fallback
    // (location-fallback.ts) → PII povratna informacija gosta na PRVI lokaciji
    // KATEREGA KOLI tenanta. Zdaj: regular/manager NULL → 403; super-admin brez
    // ?locationId → 400 fail-closed (ne global-first stamp).
    const scope = resolveTenantLocationIdOrThrow(authResult.session, new URL(req.url).searchParams, {
      endpoint: 'POST /api/guests/feedback',
    })
    if ('error' in scope) return scope.error
    const writeLoc = resolveWriteLocationId(scope.locationId)
    if (!writeLoc.ok) return writeLoc.response
    const locationId = writeLoc.locationId

    const bodyResult = await parseJsonBody(req)
    if (bodyResult.error) return bodyResult.error

    // FIX MEDIUM: Zod validacija namesto ad-hoc preverjanja
    const { data, error: validationError } = validateBody(createGuestFeedbackSchema, bodyResult.data)
    if (validationError) return validationError

    // FIX QA runda 38: DB stolpec GuestFeedback.locationId je NOT NULL (schema drift,
    // P2011 potrjen na prod) — lokacija je fail-closed rezolvirana zgoraj (R87-4).

    const feedback = await db.guestFeedback.create({
      data: {
        guestId: data.guestId || null,
        locationId,
        guestName: data.guestName,
        orderId: data.orderId || null,
        overallRating: data.overallRating,
        foodRating: data.foodRating,
        serviceRating: data.serviceRating,
        atmosphereRating: data.atmosphereRating,
        comment: data.comment,
        tags: JSON.stringify(data.tags),
        wouldReturn: data.wouldReturn,
        wouldRecommend: data.wouldRecommend,
        source: data.source,
      },
    })

    // Audit log
    await createAuditLog({
      userId: authResult.session?.employeeId,
      action: 'CREATE_FEEDBACK',
      entityType: 'GuestFeedback',
      entityId: feedback.id,
      details: {
        guestName: data.guestName,
        overallRating: data.overallRating,
      },
    })

    return NextResponse.json({ success: true, feedback }, { status: 201 })
  } catch (error: unknown) {
    return handleApiError(error, 'POST /api/guests/feedback', 'Napaka pri ustvarjanju povratne informacije')
  }
}
