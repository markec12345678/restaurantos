import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'

// ============================================
// GET /api/reports/vat — DDV razčlenitev za FURS
// Prikazuje prodajo po DDV stopnjah (22%, 9.5%, 0%)
// Parametri: startDate, endDate, period (daily/weekly/monthly/yearly)
// ============================================

export async function GET(req: Request) {
  try {
    // FIX CRITICAL: Zahtevaj avtentikacijo za dostop do DDV podatkov (FURS relevantno)
    const authResult = await requireAuth(req, { permission: 'view_reports' })
    if (authResult.error) return authResult.error

    const { searchParams } = new URL(req.url)
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const period = searchParams.get('period') || 'monthly'

    // Obdobje
    const where: Record<string, unknown> = { status: 'completed' }
    if (startDate || endDate) {
      const createdAt: Record<string, Date> = {}
      if (startDate) createdAt.gte = new Date(startDate)
      if (endDate) createdAt.lte = new Date(endDate)
      where.createdAt = createdAt
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

        const rateKey = String(oi.vatRate)
        const base = oi.price * oi.quantity
        const vat = oi.vatAmount

        if (!vatRates[rateKey]) {
          vatRates[rateKey] = {
            rate: oi.vatRate,
            label: `DDV ${oi.vatRate}%`,
            code: oi.vatRate >= 20 ? 'S' : oi.vatRate > 0 ? 'R' : 'Z',
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
      vr.baseAmount = Math.round(vr.baseAmount * 100) / 100
      vr.vatAmount = Math.round(vr.vatAmount * 100) / 100
      vr.totalAmount = Math.round(vr.totalAmount * 100) / 100
      Object.values(vr.items).forEach(item => {
        item.base = Math.round(item.base * 100) / 100
        item.vat = Math.round(item.vat * 100) / 100
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
      const d = new Date(order.createdAt)

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
        const base = oi.price * oi.quantity
        const vat = oi.vatAmount
        const entry = timeVatDistribution[periodKey]

        if (oi.vatRate >= 20) {
          entry.base22 += base
          entry.vat22 += vat
        } else if (oi.vatRate > 0) {
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
      e.base22 = Math.round(e.base22 * 100) / 100
      e.vat22 = Math.round(e.vat22 * 100) / 100
      e.base95 = Math.round(e.base95 * 100) / 100
      e.vat95 = Math.round(e.vat95 * 100) / 100
      e.base0 = Math.round(e.base0 * 100) / 100
      e.vat0 = Math.round(e.vat0 * 100) / 100
      e.totalBase = Math.round(e.totalBase * 100) / 100
      e.totalVat = Math.round(e.totalVat * 100) / 100
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
        totalBase: Math.round(totalBase * 100) / 100,
        totalVat: Math.round(totalVat * 100) / 100,
        totalWithVat: Math.round((totalBase + totalVat) * 100) / 100,
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
  } catch (error) {
    console.error('VAT report error:', error)
    return NextResponse.json({ error: 'Napaka pri pridobivanju DDV poročila' }, { status: 500 })
  }
}
