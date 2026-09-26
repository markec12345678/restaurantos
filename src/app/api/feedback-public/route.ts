// ============================================
// PUBLIC FEEDBACK API — Javni API za mnenja gostov
// Brez avtentikacije — za QR kiosk
// FIX CRITICAL: Skupni rate limiter modul
// ============================================

// FIX MEDIUM: Zod validacija za javni feedback endpoint — prejšnja koda ni imela sheme
import { db, createAuditLog } from '@/lib/db'
import { NextResponse } from 'next/server'
// odstranjen prazen import (runda 12 lint cleanup)
import { checkRateLimitAsync, getClientIp, FEEDBACK_PUBLIC_LIMIT } from '@/lib/rate-limit'
import { rateLimitedResponse } from '@/lib/rate-limit/response'
import { z } from 'zod'
import { handleApiError, validateRequest } from '@/lib/api-utils'

const feedbackSchema = z.object({
  ratings: z.record(z.string(), z.number().min(1).max(5)).refine(r => Object.keys(r).length > 0, 'Vsaj ena ocena je obvezna'),
  comment: z.string().max(500).default(''),
  quickFeedback: z.array(z.string().max(50)).max(10).default([]),
  tableId: z.string().max(100).optional(),
  locationId: z.string().max(100).optional(),
  // P1-14 (R140-b): opcijska referenca naročila (format pariteta ostalih id
  // polj v shemi). Strežnik shrani SAMO snapshot orderRef, če order obstaja
  // na isti lokaciji (zero-oracle) — id sam po sebi se NE persistira.
  orderId: z.string().max(100).optional(),
  source: z.enum(['qr_kiosk', 'web', 'receipt']).default('qr_kiosk'),
})

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  // FIX CRITICAL: Rate limiting — skupni modul
  const clientIp = getClientIp(req)
  const rateCheck = await checkRateLimitAsync('feedback-public', clientIp, FEEDBACK_PUBLIC_LIMIT)
  if (!rateCheck.allowed) {
    return rateLimitedResponse(rateCheck.retryAfterMs, 'Preveč zahtev. Poskusite znova čez minuto.')
  }

  try {
    const { data, error: validationError } = await validateRequest(req, feedbackSchema)
    if (validationError) return validationError
    const { ratings, comment, quickFeedback, tableId, locationId, orderId, source } = data

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

    // R83 fix: locationId stamp — prej je bila lokacija sprejeta v body
    // a NIKOLI zapisana (GuestFeedback.locationId vedno NULL) → mnenja
    // nevidna v scoped per-lokacijskih poročilih. Validiraj na obstoj.
    let feedbackLocationId: string | null = null
    if (locationId) {
      const loc = await db.location.findUnique({ where: { id: locationId }, select: { id: true } })
      feedbackLocationId = loc?.id ?? null
    }

    // P1-14 (R140-b): kontekst mize — tableId se ZDAJ persistira (prej je bil
    // sprejet a izgubljen) + snapshot št. mize. Lookup Table znotraj ISTEGA
    // locationId scope-a (pariteta R84 M2: nikoli globalni lookup brez
    // lokacijskega konteksta); neznana/tuja miza → shrani tableId BREZ
    // snapshot-a. Best-effort: NIKOLI ne faila mnenja zaradi mize.
    let tableNumberSnapshot: string | null = null
    if (tableId) {
      try {
        const tbl = await db.table.findUnique({
          where: { id: tableId },
          select: { number: true, locationId: true },
        })
        if (tbl && (!feedbackLocationId || tbl.locationId === feedbackLocationId)) {
          tableNumberSnapshot = String(tbl.number)
        }
      } catch {
        // snapshot ne sme porušiti mnenja
      }
    }

    // P1-14 (R140-b): kontekst naročila — ZERO-ORACLE (anti-enumeracija):
    // orderRef (Order.orderNumber snapshot) SAMO če order obstaja IN pripada
    // ISTI lokaciji; neobstoječ/tuj order → tiho null, javni odgovor ostane
    // enak (nikoli ne razkrij obstoja orderja). Id se NE persistira.
    let orderRefSnapshot: string | null = null
    if (orderId && feedbackLocationId) {
      try {
        const ord = await db.order.findUnique({
          where: { id: orderId },
          select: { orderNumber: true, locationId: true },
        })
        if (ord && ord.locationId === feedbackLocationId && ord.orderNumber != null) {
          orderRefSnapshot = String(ord.orderNumber)
        }
      } catch {
        // tiho — zero-oracle
      }
    }

    // P1-14 (R140-b) FIX '201 vedno' vrzeli: prej je bila napaka DB create
    // tiho pogoltnjena (audit = edini sled) → staff nikoli ni videl mnenja.
    // Zdaj: uspeh → 201, neuspeh → 500 generičen (handleApiError kanon).
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
        ...(feedbackLocationId ? { locationId: feedbackLocationId } : {}),
        ...(tableId ? { tableId } : {}),
        ...(tableNumberSnapshot ? { tableNumber: tableNumberSnapshot } : {}),
        ...(orderRefSnapshot ? { orderRef: orderRefSnapshot } : {}),
      },
    })

    return NextResponse.json({
      success: true,
      message: 'Hvala za vaše mnenje!',
    }, { status: 201 })
  } catch (error: unknown) {
    return handleApiError(error, 'POST /api/feedback-public', 'Napaka pri shranjevanju mnenja')
  }
}
