
// ============================================
// GET /api/reports/vat — DDV razčlenitev za FURS
// Prikazuje prodajo po DDV stopnjah (22%, 9.5%, 0%)
// Parametri: startDate, endDate, period (daily/weekly/monthly/yearly)
// ============================================

import { db } from '@/lib/db'
import { toNum, round2 } from '@/lib/decimal'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { validateReportDateRange } from '@/lib/validations'
import { checkRateLimit, getClientIp, AUTHENTICATED_LIMIT } from '@/lib/rate-limit'
import { handleApiError } from '@/lib/api-utils'

export async function GET(req: Request) {
  try {
    // Rate limiting — prepreči zlorabo API-ja
    const rl = checkRateLimit('reports-vat', getClientIp(req), AUTHENTICATED_LIMIT)
    if (!rl.allowed) return NextResponse.json({ error: 'Preveč zahtevkov' }, { status: 429, headers: { 'Retry-After': String(Math.ceil((rl.retryAfterMs || 60000) / 1000)) } })

    // FIX CRITICAL: Zahtevaj avtentikacijo za dostop do DDV podatkov (FURS relevantno)
    const authResult = await requireAuth(req, { permission: 'view_reports' })
    if (authResult.error) return authResult.error

    const { searchParams } = new URL(req.url)
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const period = searchParams.get('period') || 'monthly'

    // FIX HIGH: Validiraj datumski obseg in period parameter
    const dateError = validateReportDateRange(startDate, endDate)
    if (dateError) return dateError
    if (period && !['daily', 'weekly', 'monthly', 'yearly'].includes(period)) {
      return NextResponse.json({ error: 'Neveljavno obdobje' }, { status: 400 })
    }

    // Obdobje
    // FIX CRITICAL: Za DDV poročilo uporabimo paymentStatus='paid' — neplačana naročila NE sodijo v DDV poročilo
    const where: Record<string, unknown> = { paymentStatus: 'paid' }
    if (startDate || endDate) {
      const paidAt: Record<string, Date> = {}
      if (startDate) paidAt.gte = new Date(startDate)
      if (endDate) paidAt.lte = new Date(endDate)
      // FIX CRITICAL: Uporabi paidAt za finančno/DDV poročilo namesto createdAt
      where.paidAt = paidAt
    }

    const orders = await db.order.findMany({
      where,
      include: {
        orderItems: {
          include: { menuItem: { include: { category: true } } },
        },
      },
      orderBy: { createdAt: 'asc' },
    })

    // === DDV RAZČLENITEV PO STOPNJAH ===
    const vatRates: Record<string, {
      rate: number
      label: string
      code: string // FURS koda: S=standard, R=znižana, Z=oproščeno
      baseAmount: number
      vatAmount: number
      totalAmount: number
      itemCount: number
      orderCount: number
      items: Record<string, { name: string; category: string; quantity: number; base: number; vat: number }>
    }> = {
      '22': { rate: 22, label: 'DDV 22% (Standardna)', code: 'S', baseAmount: 0, vatAmount: 0, totalAmount: 0, itemCount: 0, orderCount: 0, items: {} },
      '9.5': { rate: 9.5, label: 'DDV 9.5% (Znižana)', code: 'R', baseAmount: 0, vatAmount: 0, totalAmount: 0, itemCount: 0, orderCount: 0, items: {} },
      '0': { rate: 0, label: 'DDV 0% (Oproščeno)', code: 'Z', baseAmount: 0, vatAmount: 0, totalAmount: 0, itemCount: 0, orderCount: 0, items: {} },
    }

    const processedOrders = new Set<string>()

    for (const order of orders) {
      for (const oi of order.orderItems) {
        if (oi.voided) continue

        const rateKey = String(toNum(oi.vatRate))
        // FIX C-09: Osnova mora odšteti discount — FURS zahteva osnovo PO popustu
        const base = toNum(oi.price) * oi.quantity - toNum(oi.discountAmount || 0)
        const vat = toNum(oi.vatAmount)

        if (!vatRates[rateKey]) {
          vatRates[rateKey] = {
            rate: toNum(oi.vatRate),
            label: `DDV ${toNum(oi.vatRate)}%`,
            code: toNum(oi.vatRate) >= 20 ? 'S' : toNum(oi.vatRate) > 0 ? 'R' : 'Z',
            baseAmount: 0,
            vatAmount: 0,
            totalAmount: 0,
            itemCount: 0,
            orderCount: 0,
            items: {},
          }
        }

        const vr = vatRates[rateKey]
        vr.baseAmount += base
        vr.vatAmount += vat
        vr.totalAmount += base + vat
        vr.itemCount += oi.quantity

        if (!processedOrders.has(`${rateKey}-${order.id}`)) {
          vr.orderCount += 1
          processedOrders.add(`${rateKey}-${order.id}`)
        }

        // Podrobno po artiklih
        const itemKey = oi.menuItemId
        if (!vr.items[itemKey]) {
          vr.items[itemKey] = {
            name: oi.menuItem?.name || 'Neznan',
            category: oi.menuItem?.category?.name || 'Ostalo',
            quantity: 0,
            base: 0,
            vat: 0,
          }
        }
        vr.items[itemKey].quantity += oi.quantity
        vr.items[itemKey].base += base
        vr.items[itemKey].vat += vat
      }
    }

    // Zaokroži zneske
    Object.values(vatRates).forEach(vr => {
      vr.baseAmount = round2(vr.baseAmount)
      vr.vatAmount = round2(vr.vatAmount)
      vr.totalAmount = round2(vr.totalAmount)
      Object.values(vr.items).forEach(item => {
        item.base = round2(item.base)
        item.vat = round2(item.vat)
      })
    })

    // === ČASOVNA RAZDELITEV PO DDV STOPNJAH ===
    const timeVatDistribution: Record<string, {
      period: string
      base22: number
      vat22: number
      base95: number
      vat95: number
      base0: number
      vat0: number
      totalBase: number
      totalVat: number
    }> = {}

    for (const order of orders) {
      let periodKey: string
      // FIX MEDIUM: Uporabi paidAt (datum plačila) namesto createdAt za časovno razdelitev
      // Poročilo temelji na plačilih — naročilo plačano v torku sodi v torek, ne v ponedeljek (ko je bilo ustvarjeno)
      const d = new Date(order.paidAt || order.createdAt)

      if (period === 'daily') {
        periodKey = `${String(d.getHours()).padStart(2, '0')}:00`
      } else if (period === 'weekly') {
        const dayNames = ['Pon', 'Tor', 'Sre', 'Čet', 'Pet', 'Sob', 'Ned']
        periodKey = dayNames[(d.getDay() + 6) % 7]
      } else if (period === 'monthly') {
        periodKey = String(d.getDate())
      } else {
        periodKey = d.toISOString().split('T')[0]
      }

      if (!timeVatDistribution[periodKey]) {
        timeVatDistribution[periodKey] = {
          period: periodKey,
          base22: 0, vat22: 0,
          base95: 0, vat95: 0,
          base0: 0, vat0: 0,
          totalBase: 0, totalVat: 0,
        }
      }

      for (const oi of order.orderItems) {
        if (oi.voided) continue
        const base = toNum(oi.price) * oi.quantity
        const vat = toNum(oi.vatAmount)
        const entry = timeVatDistribution[periodKey]

        if (toNum(oi.vatRate) >= 20) {
          entry.base22 += base
          entry.vat22 += vat
        } else if (toNum(oi.vatRate) > 0) {
          entry.base95 += base
          entry.vat95 += vat
        } else {
          entry.base0 += base
          entry.vat0 += vat
        }
        entry.totalBase += base
        entry.totalVat += vat
      }
    }

    // Zaokroži
    Object.values(timeVatDistribution).forEach(e => {
      e.base22 = round2(e.base22)
      e.vat22 = round2(e.vat22)
      e.base95 = round2(e.base95)
      e.vat95 = round2(e.vat95)
      e.base0 = round2(e.base0)
      e.vat0 = round2(e.vat0)
      e.totalBase = round2(e.totalBase)
      e.totalVat = round2(e.totalVat)
    })

    // === SKUPAJ ===
    const totalBase = Object.values(vatRates).reduce((sum, vr) => sum + vr.baseAmount, 0)
    const totalVat = Object.values(vatRates).reduce((sum, vr) => sum + vr.vatAmount, 0)

    return NextResponse.json({
      period,
      startDate: startDate || null,
      endDate: endDate || null,
      vatBreakdown: Object.values(vatRates),
      timeDistribution: Object.values(timeVatDistribution),
      summary: {
        totalBase: round2(totalBase),
        totalVat: round2(totalVat),
        totalWithVat: round2(totalBase + totalVat),
        completedOrders: orders.length,
      },
      // FURS format za davčno overjanje
      fursFormat: Object.values(vatRates).map(vr => ({
        taxRate: vr.rate,
        taxBase: vr.baseAmount,
        taxAmount: vr.vatAmount,
        code: vr.code,
      })),
    })
  } catch (error: unknown) {
    return handleApiError(error, 'GET /api/reports/vat', 'Napaka pri pridobivanju DDV poročila')
  }
}
