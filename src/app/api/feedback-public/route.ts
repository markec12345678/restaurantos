// ============================================
// PUBLIC FEEDBACK API — Javni API za mnenja gostov
// Brez avtentikacije — za QR kiosk
// FIX CRITICAL: Skupni rate limiter modul
// ============================================

// FIX MEDIUM: Zod validacija za javni feedback endpoint — prejšnja koda ni imela sheme
import { db, createAuditLog } from '@/lib/db'
import { NextResponse } from 'next/server'
import { checkRateLimit, getClientIp, FEEDBACK_PUBLIC_LIMIT } from '@/lib/rate-limit'
import { z } from 'zod'
import { handleApiError, validateRequest } from '@/lib/api-utils'

const feedbackSchema = z.object({
  ratings: z.record(z.string(), z.number().min(1).max(5)).refine(r => Object.keys(r).length > 0, 'Vsaj ena ocena je obvezna'),
  comment: z.string().max(500).default(''),
  quickFeedback: z.array(z.string().max(50)).max(10).default([]),
  tableId: z.string().max(100).optional(),
  locationId: z.string().max(100).optional(),
  source: z.enum(['qr_kiosk', 'web', 'receipt']).default('qr_kiosk'),
})

export async function POST(req: Request) {
  // FIX CRITICAL: Rate limiting — skupni modul
  const clientIp = getClientIp(req)
  const rateCheck = checkRateLimit('feedback-public', clientIp, FEEDBACK_PUBLIC_LIMIT)
  if (!rateCheck.allowed) {
    return NextResponse.json(
      { error: 'Preveč zahtev. Poskusite znova čez minuto.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil((rateCheck.retryAfterMs || 60000) / 1000)) } }
    )
  }

  try {
    const { data, error: validationError } = await validateRequest(req, feedbackSchema)
    if (validationError) return validationError
    const { ratings, comment, quickFeedback, tableId, locationId, source } = data

    // FIX MEDIUM: Izračunaj avgRating strežniško — ne zaupaj klientu
    const ratingValues = Object.values(ratings) as number[]
    const avgRating = ratingValues.length > 0
      ? Math.round((ratingValues.reduce((s: number, v: number) => s + v, 0) / ratingValues.length) * 10) / 10
      : 3

    // Shrani v audit log (kot GuestFeedback dogodek)
    await createAuditLog({
      action: 'GUEST_FEEDBACK_RECEIVED',
      entityType: 'GuestFeedback',
      details: {
        ratings,
        comment: (comment || '').slice(0, 500), // Omejitev dolžine
        tableId: tableId || null,
        locationId: locationId || null,
        avgRating: avgRating || 0,
        source: source || 'qr_kiosk',
        ip: clientIp.slice(0, 20), // Skrajšano za varnost
      } as Record<string, unknown>,
    })

    // Poskusi shraniti v GuestFeedback model
    try {
      await db.guestFeedback.create({
        data: {
          guestId: null,
          guestName: 'Anonimen',
          overallRating: Math.round(avgRating || 3),
          foodRating: Math.round((ratings as Record<string, number>)['food'] || 0),
          serviceRating: Math.round((ratings as Record<string, number>)['service'] || 0),
          atmosphereRating: Math.round((ratings as Record<string, number>)['ambience'] || 0),
          comment: (comment || '').slice(0, 500),
          tags: JSON.stringify(quickFeedback || []),
          wouldReturn: (avgRating || 3) >= 4,
          wouldRecommend: (avgRating || 3) >= 4,
          source: source || 'qr_kiosk',
        },
      })
    } catch {
      // Če GuestFeedback model ni na voljo, audit log je že shranjen
    }

    return NextResponse.json({
      success: true,
      message: 'Hvala za vaše mnenje!',
    }, { status: 201 })
  } catch (error: unknown) {
    return handleApiError(error, 'POST /api/feedback-public', 'Napaka pri shranjevanju mnenja')
  }
}
