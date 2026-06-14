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
import { requireAuth } from '@/lib/auth-middleware'
import { createGuestFeedbackSchema } from '@/lib/validations'
import { handleApiError, parseJsonBody, validateBody } from '@/lib/api-utils'
export async function GET(req: Request) {
  try {
    const authResult = await requireAuth(req, { permission: 'take_orders' })
    if (authResult.error) return authResult.error

    const { searchParams } = new URL(req.url)
    const rating = searchParams.get('rating')
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 200)

    const where: Record<string, unknown> = {}
    if (rating) {
      where.overallRating = parseInt(rating)
    }

    const [feedbacks, totalCount] = await Promise.all([
      db.guestFeedback.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
      }),
      db.guestFeedback.count({ where }),
    ])

    // FIX MEDIUM: Uporabi aggregate/groupBy namesto pridobivanja vseh zapisov
    const statsAgg = await db.guestFeedback.aggregate({
      _count: true,
      _avg: {
        overallRating: true,
        foodRating: true,
        serviceRating: true,
        atmosphereRating: true,
      },
    })

    const promoterCount = await db.guestFeedback.count({ where: { overallRating: { gte: 4 } } })
    const detractorCount = await db.guestFeedback.count({ where: { overallRating: { lte: 2 } } })
    const wouldReturnCount = await db.guestFeedback.count({ where: { wouldReturn: true } })
    const wouldRecommendCount = await db.guestFeedback.count({ where: { wouldRecommend: true } })
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

    return NextResponse.json({
      feedbacks,
      stats,
      total: totalCount,
    })
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

    const bodyResult = await parseJsonBody(req)
    if (bodyResult.error) return bodyResult.error

    // FIX MEDIUM: Zod validacija namesto ad-hoc preverjanja
    const { data, error: validationError } = validateBody(createGuestFeedbackSchema, bodyResult.data)
    if (validationError) return validationError

    const feedback = await db.guestFeedback.create({
      data: {
        guestId: data.guestId || null,
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
