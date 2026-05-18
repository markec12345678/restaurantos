// ============================================
// PUBLIC FEEDBACK API — Javni API za mnenja gostov
// Brez avtentikacije — za QR kiosk
// ============================================

import { db, createAuditLog } from '@/lib/db'
import { NextResponse } from 'next/server'

// Rate limiting (simple in-memory)
const feedbackRateLimit = new Map<string, { count: number; lastReset: number }>()
const RATE_LIMIT_WINDOW = 60000 // 1 minuta
const RATE_LIMIT_MAX = 3 // Največ 3 mnenja na minuto

export async function POST(req: Request) {
  try {
    // Rate limiting
    const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown'
    const now = Date.now()
    const rateData = feedbackRateLimit.get(ip)

    if (rateData && now - rateData.lastReset < RATE_LIMIT_WINDOW) {
      if (rateData.count >= RATE_LIMIT_MAX) {
        return NextResponse.json({ error: 'Preveč zahtev. Poskusite znova čez minuto.' }, { status: 429 })
      }
      rateData.count++
    } else {
      feedbackRateLimit.set(ip, { count: 1, lastReset: now })
    }

    const body = await req.json()
    const { ratings, comment, quickFeedback, tableId, locationId, avgRating, source } = body

    if (!ratings || Object.keys(ratings).length === 0) {
      return NextResponse.json({ error: 'Vsaj ena ocena je obvezna' }, { status: 400 })
    }

    // Preveri obseg ocen (1-5)
    for (const [key, value] of Object.entries(ratings)) {
      if (typeof value !== 'number' || value < 1 || value > 5) {
        return NextResponse.json({ error: `Neveljavna ocena za ${key}` }, { status: 400 })
      }
    }

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
        ip: ip.slice(0, 20), // Skrajšano za varnost
      } as Record<string, unknown>,
    })

    // Poskusi shraniti v GuestFeedback model
    try {
      const feedback = await db.guestFeedback.create({
        data: {
          guestId: null,
          guestName: 'Anonimen',
          overallRating: Math.round(avgRating || 3),
          foodRating: Math.round(ratings.food || 0),
          serviceRating: Math.round(ratings.service || 0),
          atmosphereRating: Math.round(ratings.ambience || 0),
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
  } catch (error) {
    console.error('[FEEDBACK-PUBLIC POST]', error)
    return NextResponse.json({ error: 'Napaka pri shranjevanju mnenja' }, { status: 500 })
  }
}
