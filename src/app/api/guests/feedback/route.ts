// ============================================
// GUEST FEEDBACK API — Povratne informacije gostov
// Toast POS + OpenTable standard
// Avtentikacija + Zod validacija
// ============================================

import { db, createAuditLog } from '@/lib/db'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'

// ============================================
// GET - Pridobi povratne informacije
// ============================================
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

    // Izračunaj statistiko
    const allFeedbacks = await db.guestFeedback.findMany()
    const stats = {
      total: allFeedbacks.length,
      avgRating: allFeedbacks.length > 0
        ? Math.round((allFeedbacks.reduce((s, f) => s + f.overallRating, 0) / allFeedbacks.length) * 10) / 10
        : 0,
      avgFoodRating: allFeedbacks.length > 0
        ? Math.round((allFeedbacks.reduce((s, f) => s + f.foodRating, 0) / allFeedbacks.length) * 10) / 10
        : 0,
      avgServiceRating: allFeedbacks.length > 0
        ? Math.round((allFeedbacks.reduce((s, f) => s + f.serviceRating, 0) / allFeedbacks.length) * 10) / 10
        : 0,
      avgAtmosphereRating: allFeedbacks.length > 0
        ? Math.round((allFeedbacks.reduce((s, f) => s + f.atmosphereRating, 0) / allFeedbacks.length) * 10) / 10
        : 0,
      nps: (() => {
        if (allFeedbacks.length === 0) return 0
        const promoters = allFeedbacks.filter(f => f.overallRating >= 4).length
        const detractors = allFeedbacks.filter(f => f.overallRating <= 2).length
        return Math.round(((promoters - detractors) / allFeedbacks.length) * 100)
      })(),
      wouldReturnPercent: allFeedbacks.length > 0
        ? Math.round((allFeedbacks.filter(f => f.wouldReturn).length / allFeedbacks.length) * 100)
        : 0,
      wouldRecommendPercent: allFeedbacks.length > 0
        ? Math.round((allFeedbacks.filter(f => f.wouldRecommend).length / allFeedbacks.length) * 100)
        : 0,
    }

    return NextResponse.json({
      feedbacks,
      stats,
      total: totalCount,
    })
  } catch (error) {
    console.error('Napaka pri pridobivanju povratnih informacij:', error)
    return NextResponse.json({ error: 'Napaka pri pridobivanju povratnih informacij' }, { status: 500 })
  }
}

// ============================================
// POST - Ustvari novo povratno informacijo
// ============================================
export async function POST(req: Request) {
  try {
    const authResult = await requireAuth(req, { permission: 'take_orders' })
    if (authResult.error) return authResult.error

    const body = await req.json()

    // Validacija
    if (!body.overallRating || body.overallRating < 1 || body.overallRating > 5) {
      return NextResponse.json({ error: 'Skupna ocena mora biti med 1 in 5' }, { status: 400 })
    }

    const feedback = await db.guestFeedback.create({
      data: {
        guestId: body.guestId || null,
        guestName: body.guestName || '',
        orderId: body.orderId || null,
        overallRating: body.overallRating,
        foodRating: body.foodRating || 0,
        serviceRating: body.serviceRating || 0,
        atmosphereRating: body.atmosphereRating || 0,
        comment: body.comment || '',
        tags: JSON.stringify(body.tags || []),
        wouldReturn: body.wouldReturn !== false,
        wouldRecommend: body.wouldRecommend !== false,
        source: body.source || 'pos',
      },
    })

    // Audit log
    await createAuditLog({
      userId: authResult.session?.employeeId,
      action: 'CREATE_FEEDBACK',
      entityType: 'GuestFeedback',
      entityId: feedback.id,
      details: {
        guestName: body.guestName,
        overallRating: body.overallRating,
        foodRating: body.foodRating,
        serviceRating: body.serviceRating,
      },
    })

    return NextResponse.json({ success: true, feedback }, { status: 201 })
  } catch (error) {
    console.error('Napaka pri ustvarjanju povratne informacije:', error)
    return NextResponse.json({ error: 'Napaka pri ustvarjanju povratne informacije' }, { status: 500 })
  }
}
