// ============================================
// POST /api/ai/nl-query — Natural Language Query (POSR-style)
// ============================================
// Manager lahko vpraša v naravnem jeziku:
//   "Koliko je bil vrhunec prometa ta teden?"
//   "Kateri artikel je bil najbolj prodajan včeraj?"
//   "Koliko smo imeli preklicov danes?"
// ============================================

import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { toNum, round2 } from '@/lib/decimal'
import { requireAuth } from '@/lib/auth-middleware'
import { checkRateLimitAsync, getClientIp, AI_ASSISTANT_LIMIT } from '@/lib/rate-limit'
import { handleApiError, parseJsonBody } from '@/lib/api-utils'
import { logger } from '@/lib/logger'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const querySchema = z.object({
  question: z.string().min(3, 'Vprašanje je obvezno').max(500),
})

export async function POST(req: Request) {
  try {
    const authResult = await requireAuth(req, { permission: 'view_reports' })
    if (authResult.error) return authResult.error
    const rl = await checkRateLimitAsync('ai-nl-query', getClientIp(req), AI_ASSISTANT_LIMIT)
    if (!rl.allowed) return NextResponse.json({ error: 'Preveč zahtevkov' }, { status: 429, headers: { 'Retry-After': String(Math.ceil((rl.retryAfterMs || 60000) / 1000)) } })

    const bodyResult = await parseJsonBody(req)
    if (bodyResult.error) return bodyResult.error

    const { data, error } = querySchema.safeParse(bodyResult.data)
    if (error) {
      return NextResponse.json({ error: 'Neveljavni podatki' }, { status: 400 })
    }

    const question = data.question.toLowerCase()
    const now = new Date()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    const yesterdayStart = new Date(todayStart.getTime() - 24 * 60 * 60 * 1000)
    const yesterdayEnd = new Date(todayStart.getTime() - 1)

    // Pattern matching — prepoznaj tip vprašanja
    const patterns = [
      { keywords: ['vrhunec', 'peak', 'najvišji', 'najvec', 'kdaj najbolj'], type: 'peak_hour' },
      { keywords: ['najbolj prodajan', 'top artikel', 'najbolj popular', 'best seller'], type: 'top_items' },
      { keywords: ['preklic', 'cancel', 'storno', 'void'], type: 'cancellations' },
      { keywords: ['promet', 'prihodek', 'revenue', 'prodaja', 'koliko smo'], type: 'revenue' },
      { keywords: ['napitnina', 'tip', 'tipovi'], type: 'tips' },
      { keywords: ['miza', 'zaseden', 'table', 'occupancy'], type: 'table_occupancy' },
      { keywords: ['zaposlen', 'natakar', 'employee', 'performans'], type: 'employee_perf' },
      { keywords: ['ddv', 'tax', 'davek'], type: 'vat' },
    ]

    let matchedType = 'unknown'
    for (const p of patterns) {
      if (p.keywords.some(k => question.includes(k))) {
        matchedType = p.type
        break
      }
    }

    // Določi časovno obdobje
    let dateFrom = todayStart
    let dateTo = now
    let periodLabel = 'danes'

    if (question.includes('včeraj') || question.includes('vceraj') || question.includes('yesterday')) {
      dateFrom = yesterdayStart
      dateTo = yesterdayEnd
      periodLabel = 'včeraj'
    } else if (question.includes('teden') || question.includes('week')) {
      dateFrom = weekAgo
      periodLabel = 'ta teden'
    }

    // Izvedi poizvedbo glede na tip
    let answer = ''
    let data_: Record<string, unknown> = {}

    switch (matchedType) {
      case 'revenue': {
        const orders = await db.order.findMany({
          where: { paidAt: { gte: dateFrom, lte: dateTo }, paymentStatus: 'paid' },
          select: { total: true, tip: true, tax: true },
        })
        const revenue = orders.reduce((s, o) => s + toNum(o.total), 0)
        const tips = orders.reduce((s, o) => s + toNum(o.tip), 0)
        const tax = orders.reduce((s, o) => s + toNum(o.tax), 0)
        answer = `${periodLabel === 'danes' ? 'Danes' : periodLabel === 'včeraj' ? 'Včeraj' : 'Ta teden'} ste imeli ${orders.length} plačanih naročil s skupnim prometom ${round2(revenue).toFixed(2)}€ (DDV: ${round2(tax).toFixed(2)}€, napitnine: ${round2(tips).toFixed(2)}€).`
        data_ = { orders: orders.length, revenue: round2(revenue), tax: round2(tax), tips: round2(tips) }
        break
      }

      case 'top_items': {
        const items = await db.orderItem.groupBy({
          by: ['menuItemId'],
          where: {
            order: { paidAt: { gte: dateFrom, lte: dateTo } },
            voided: false,
          },
          _sum: { quantity: true },
          _count: true,
          orderBy: { _sum: { quantity: 'desc' } },
          take: 5,
        })
        const menuItemIds = items.map(i => i.menuItemId)
        const menuItems = await db.menuItem.findMany({
          where: { id: { in: menuItemIds } },
          select: { id: true, name: true },
        })
        const topItems = items.map(i => {
          const mi = menuItems.find(m => m.id === i.menuItemId)
          return { name: mi?.name || 'Neznan artikel', quantity: i._sum.quantity || 0, orders: i._count }
        })
        answer = `Najbolj prodajani artikli ${periodLabel}: ${topItems.map((i, idx) => `${idx + 1}. ${i.name} (${i.quantity}x)`).join(', ')}.`
        data_ = { topItems }
        break
      }

      case 'peak_hour': {
        const orders = await db.order.findMany({
          where: { paidAt: { gte: dateFrom, lte: dateTo }, paymentStatus: 'paid' },
          select: { paidAt: true, total: true },
        })
        const hourlyMap: Record<number, { count: number; revenue: number }> = {}
        for (const o of orders) {
          if (!o.paidAt) continue
          const h = new Date(o.paidAt).getHours()
          if (!hourlyMap[h]) hourlyMap[h] = { count: 0, revenue: 0 }
          hourlyMap[h].count++
          hourlyMap[h].revenue += toNum(o.total)
        }
        const peak = Object.entries(hourlyMap).sort((a, b) => b[1].revenue - a[1].revenue)[0]
        if (peak) {
          answer = `Vrhunec prometa ${periodLabel} je bil ob ${peak[0]}:00 z ${peak[1].count} naročili in ${round2(peak[1].revenue).toFixed(2)}€ prometa.`
        } else {
          answer = `Ni podatkov o prometu ${periodLabel}.`
        }
        data_ = { hourly: hourlyMap, peakHour: peak ? parseInt(peak[0]) : null }
        break
      }

      case 'cancellations': {
        const cancelled = await db.order.count({
          where: { status: 'cancelled', cancelledAt: { gte: dateFrom, lte: dateTo } },
        })
        const voidedItems = await db.orderItem.count({
          where: { voided: true, updatedAt: { gte: dateFrom, lte: dateTo } },
        })
        answer = `${periodLabel === 'danes' ? 'Danes' : 'V izbranem obdobju'} ste imeli ${cancelled} preklicanih naročil in ${voidedItems} voidanih artiklov.`
        data_ = { cancelledOrders: cancelled, voidedItems }
        break
      }

      case 'tips': {
        const orders = await db.order.findMany({
          where: { paidAt: { gte: dateFrom, lte: dateTo }, paymentStatus: 'paid' },
          select: { tip: true },
        })
        const totalTips = orders.reduce((s, o) => s + toNum(o.tip), 0)
        const avgTip = orders.length > 0 ? totalTips / orders.length : 0
        answer = `${periodLabel === 'danes' ? 'Danes' : 'V izbranem obdobju'} ste zbrali ${round2(totalTips).toFixed(2)}€ napitnin (${orders.length} naročil, povprečno ${round2(avgTip).toFixed(2)}€ na naročilo).`
        data_ = { totalTips: round2(totalTips), orderCount: orders.length, avgTip: round2(avgTip) }
        break
      }

      case 'employee_perf': {
        const employees = await db.order.groupBy({
          by: ['employeeId'],
          where: { paidAt: { gte: dateFrom, lte: dateTo }, paymentStatus: 'paid' },
          _sum: { total: true, tip: true },
          _count: true,
          orderBy: { _sum: { total: 'desc' } },
          take: 10,
        })
        const empIds = employees.map(e => e.employeeId).filter((id): id is string => !!id)
        const empData = await db.employee.findMany({
          where: { id: { in: empIds } },
          select: { id: true, name: true },
        })
        const perf = employees.map(e => {
          const emp = empData.find(em => em.id === e.employeeId)
          return {
            name: emp?.name || 'Nedodeljeno',
            orders: e._count,
            revenue: round2(toNum(e._sum.total)),
            tips: round2(toNum(e._sum.tip)),
          }
        })
        answer = `Top zaposleni ${periodLabel}: ${perf.slice(0, 3).map((e, i) => `${i + 1}. ${e.name} (${e.revenue.toFixed(2)}€, ${e.orders} naročil)`).join(', ')}.`
        data_ = { employees: perf }
        break
      }

      default:
        answer = `Vaše vprašanje "${data.question}" sem prepoznal, ampak ne morem odgovoriti. Poskusite vprašati o: promet, najbolj prodajani artikli, vrhunec prometa, preklici, napitnine, performanse zaposlenih.`
    }

    logger.info('AI', `NL Query: "${data.question}" → type: ${matchedType}`)

    return NextResponse.json({
      question: data.question,
      answer,
      type: matchedType,
      period: periodLabel,
      data: data_,
    })
  } catch (error: unknown) {
    return handleApiError(error, 'POST /api/ai/nl-query', 'Napaka pri NL poizvedbi')
  }
}
