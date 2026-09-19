// ============================================
// GET /api/reports/digest-trend — 7-dnevni trend za dnevni povzetek (R71)
// ============================================
// Podaljšek R65 (primerjava s prejšnjim dnem) → trend zadnjih N dni.
// Podatki: naročila paymentStatus='paid' (Z-report semantika, ista kot
// fetchDailyDigestData), OKNA PO LJUBLJANSKEM KOLEDARJU (ljubljanaDayBounds —
// CET/CEST-varen razred, kot EOD/Z-report; NE server-local).
//
// Bucketizacija: vsako naročilo v svoj LJ koledarski dan
// (ljubljanaDateTimeParts(createdAt).date) — naročilo ob 00:30 UTC je v
// Ljubljani ob 2:30 in spada v PRAVILNI koledarski dan (isti razred napak
// kot rezervacije R43).
//
// Auth: admin. Rate limit: AUTHENTICATED_LIMIT.
// Query: ?date=YYYY-MM-DD (končni dan okna; privzeto včeraj po LJ — ista
//        digest semantika), ?days=1..31 (privzeto 7).
// Odgovor: { data: DigestTrend & { endDate: string } }
// ============================================

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/auth-middleware'
import { handleApiError } from '@/lib/api-utils'
import { checkRateLimitAsync, getClientIp, AUTHENTICATED_LIMIT } from '@/lib/rate-limit'
import { db } from '@/lib/db'
import { ljubljanaDayBounds, ljubljanaYesterdayStr, ljubljanaDateTimeParts } from '@/lib/timezone-sl'
import { computeDigestTrend, type TrendDayRaw } from '@/lib/digest-trend'

export const dynamic = 'force-dynamic'

const trendQuerySchema = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Datum mora biti v formatu YYYY-MM-DD')
    .optional(),
  days: z.coerce.number().int().min(1).max(31).optional(),
})

export async function GET(req: Request) {
  try {
    const rl = await checkRateLimitAsync('digest-trend', getClientIp(req), AUTHENTICATED_LIMIT)
    if (!rl.allowed) {
      return NextResponse.json(
        { error: 'Preveč zahtevkov' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil((rl.retryAfterMs || 60000) / 1000)) } }
      )
    }

    const authResult = await requireAuth(req, { permission: 'admin' })
    if (authResult.error) return authResult.error

    const url = new URL(req.url)
    const { data: parsed, error: validationError } = trendQuerySchema.safeParse({
      date: url.searchParams.get('date') || undefined,
      days: url.searchParams.get('days') || undefined,
    })
    if (validationError) {
      return NextResponse.json({ error: validationError.issues[0]?.message }, { status: 400 })
    }

    const endDateStr = parsed.date || ljubljanaYesterdayStr()
    const dayCount = parsed.days || 7

    // Okno: (končni dan − (dayCount−1)) → končni dan, po LJ koledarju
    const [ey, em, ed] = endDateStr.split('-').map(Number)
    const firstDateStr = new Date(Date.UTC(ey, em - 1, ed - (dayCount - 1)))
      .toISOString()
      .slice(0, 10)
    const windowStart = ljubljanaDayBounds(firstDateStr).start
    const windowEnd = ljubljanaDayBounds(endDateStr).end

    // Ena poizvedba za celo okno → bucketizacija po LJ dnevih v JS
    const orders = await db.order.findMany({
      where: { paymentStatus: 'paid', createdAt: { gte: windowStart, lte: windowEnd } },
      select: { createdAt: true, total: true },
    })

    const buckets = new Map<string, TrendDayRaw>()
    for (const o of orders) {
      const key = ljubljanaDateTimeParts(o.createdAt.toISOString()).date
      const revenue =
        typeof o.total === 'object' && o.total !== null && 'toNumber' in (o.total as object)
          ? (o.total as { toNumber: () => number }).toNumber()
          : Number(o.total) || 0
      const b = buckets.get(key) ?? { date: key, revenue: 0, ordersCount: 0 }
      b.revenue += revenue
      b.ordersCount += 1
      buckets.set(key, b)
    }

    // Polni niz dni (tudi brez prometa → 0) v kronološkem vrstnem redu
    const raw: TrendDayRaw[] = []
    for (let i = 0; i < dayCount; i++) {
      const d = new Date(Date.UTC(ey, em - 1, ed - i))
      const key = d.toISOString().slice(0, 10)
      raw.push(buckets.get(key) ?? { date: key, revenue: 0, ordersCount: 0 })
    }
    raw.reverse() // ASC — computeDigestTrend pričakuje rast po datumu

    const trend = computeDigestTrend(raw, dayCount)

    return NextResponse.json({ data: { ...trend, endDate: endDateStr } })
  } catch (error: unknown) {
    return handleApiError(error, 'GET /api/reports/digest-trend', 'Napaka pri izračunu trenda')
  }
}
