import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'

// ============================================
// GET /api/reports/export — Izvoz poročil v CSV
// Parametri: type=orders|items|vat|employees|shifts|inventory, startDate, endDate
// Vrne CSV datoteko z ustreznimi podatki
// ============================================

function escapeCsvField(field: unknown): string {
  const str = String(field ?? '')
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes(';')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

function toCsvRow(fields: unknown[]): string {
  return fields.map(escapeCsvField).join(';') // Slovenian Excel uses ;
}

export async function GET(req: Request) {
  try {
    // FIX CRITICAL: Zahtevaj avtentikacijo za izvoz poslovnih podatkov
    const authResult = await requireAuth(req, { permission: 'view_reports' })
    if (authResult.error) return authResult.error

    const { searchParams } = new URL(req.url)
    const type = searchParams.get('type') || 'orders'
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    const dateFilter: Record<string, Date> = {}
    if (startDate) dateFilter.gte = new Date(startDate)
    if (endDate) dateFilter.lte = new Date(endDate)

    let csv = ''
    let filename = ''

    switch (type) {
      case 'orders': {
        const orders = await db.order.findMany({
          where: Object.keys(dateFilter).length > 0 ? { createdAt: dateFilter } : {},
          include: {
            table: true,
            orderItems: { include: { menuItem: true } },
          },
          orderBy: { createdAt: 'desc' },
        })

        csv = toCsvRow(['Št. naročila', 'Datum', 'Tip', 'Miza', 'Stranka', 'Status', 'Plačilo', 'Metoda', 'Vmesna vsota', 'DDV', 'Popust', 'Skupaj', 'Napitnina', 'Skupaj z napitnino', 'Artikli'])
        csv += '\n'

        for (const o of orders) {
          const items = o.orderItems.map(oi => `${oi.quantity}x ${oi.menuItem?.name || '?'}`).join(', ')
          csv += toCsvRow([
            o.orderNumber,
            new Date(o.createdAt).toLocaleString('sl-SI'),
            o.type,
            o.table?.number || '',
            o.customerName || '',
            o.status,
            o.paymentStatus,
            o.paymentMethod,
            o.subtotal.toFixed(2),
            o.tax.toFixed(2),
            o.discount.toFixed(2),
            o.total.toFixed(2),
            (o.tip || 0).toFixed(2),
            o.totalWithTip.toFixed(2),
            items,
          ])
          csv += '\n'
        }
        filename = `narocila_${startDate || 'vse'}_${endDate || 'vse'}.csv`
        break
      }

      case 'items': {
        const orders = await db.order.findMany({
          where: {
            status: 'completed',
            ...(Object.keys(dateFilter).length > 0 ? { createdAt: dateFilter } : {}),
          },
          include: {
            orderItems: { include: { menuItem: { include: { category: true } } } },
          },
        })

        const itemMap: Record<string, { name: string; category: string; menu: string; vatRate: number; quantity: number; revenue: number; vat: number }> = {}
        for (const o of orders) {
          for (const oi of o.orderItems) {
            if (oi.voided) continue
            const key = oi.menuItemId
            if (!itemMap[key]) {
              itemMap[key] = {
                name: oi.menuItem?.name || 'Neznan',
                category: oi.menuItem?.category?.name || 'Ostalo',
                menu: (oi.menuItem as any)?.category?.menu?.name || '',
                vatRate: oi.vatRate,
                quantity: 0,
                revenue: 0,
                vat: 0,
              }
            }
            itemMap[key].quantity += oi.quantity
            itemMap[key].revenue += oi.price * oi.quantity
            itemMap[key].vat += oi.vatAmount
          }
        }

        csv = toCsvRow(['Artikel', 'Kategorija', 'Meni', 'DDV stopnja', 'Količina', 'Prihodek (brez DDV)', 'DDV', 'Skupaj'])
        csv += '\n'

        for (const item of Object.values(itemMap).sort((a, b) => b.revenue - a.revenue)) {
          csv += toCsvRow([
            item.name,
            item.category,
            item.menu,
            `${item.vatRate}%`,
            item.quantity,
            item.revenue.toFixed(2),
            item.vat.toFixed(2),
            (item.revenue + item.vat).toFixed(2),
          ])
          csv += '\n'
        }
        filename = `artikli_${startDate || 'vse'}_${endDate || 'vse'}.csv`
        break
      }

      case 'vat': {
        const orders = await db.order.findMany({
          where: {
            status: 'completed',
            ...(Object.keys(dateFilter).length > 0 ? { createdAt: dateFilter } : {}),
          },
          include: { orderItems: true },
        })

        const vatMap: Record<string, { rate: number; base: number; vat: number; total: number }> = {}
        for (const o of orders) {
          for (const oi of o.orderItems) {
            if (oi.voided) continue
            const key = String(oi.vatRate)
            if (!vatMap[key]) {
              vatMap[key] = { rate: oi.vatRate, base: 0, vat: 0, total: 0 }
            }
            vatMap[key].base += oi.price * oi.quantity
            vatMap[key].vat += oi.vatAmount
            vatMap[key].total += oi.price * oi.quantity + oi.vatAmount
          }
        }

        csv = toCsvRow(['DDV stopnja', 'Osnova', 'DDV', 'Skupaj'])
        csv += '\n'

        for (const vr of Object.values(vatMap).sort((a, b) => b.rate - a.rate)) {
          csv += toCsvRow([
            `${vr.rate}%`,
            vr.base.toFixed(2),
            vr.vat.toFixed(2),
            vr.total.toFixed(2),
          ])
          csv += '\n'
        }
        filename = `ddv_${startDate || 'vse'}_${endDate || 'vse'}.csv`
        break
      }

      case 'employees': {
        const orders = await db.order.findMany({
          where: {
            status: { in: ['completed'] },
            ...(Object.keys(dateFilter).length > 0 ? { createdAt: dateFilter } : {}),
          },
        })

        const employees = await db.employee.findMany()
        const empMap = new Map(employees.map(e => [e.id, e]))

        const stats: Record<string, { name: string; role: string; orders: number; revenue: number; tips: number }> = {}
        for (const o of orders) {
          const empId = o.employeeId || 'unknown'
          const emp = empMap.get(empId)
          if (!stats[empId]) {
            stats[empId] = { name: emp?.name || 'Nedoločen', role: emp?.role || '', orders: 0, revenue: 0, tips: 0 }
          }
          stats[empId].orders += 1
          stats[empId].revenue += o.total
          stats[empId].tips += (o.tip || 0)
        }

        csv = toCsvRow(['Zaposleni', 'Vloga', 'Št. naročil', 'Prihodek', 'Napitnine'])
        csv += '\n'

        for (const s of Object.values(stats).sort((a, b) => b.revenue - a.revenue)) {
          csv += toCsvRow([
            s.name,
            s.role,
            s.orders,
            s.revenue.toFixed(2),
            s.tips.toFixed(2),
          ])
          csv += '\n'
        }
        filename = `zaposleni_${startDate || 'vse'}_${endDate || 'vse'}.csv`
        break
      }

      case 'shifts': {
        const shifts = await db.cashRegisterShift.findMany({
          where: Object.keys(dateFilter).length > 0 ? { openedAt: dateFilter } : {},
          orderBy: { openedAt: 'desc' },
        })

        csv = toCsvRow(['Zaposleni', 'Odprto', 'Zaprto', 'Začetna gotovina', 'Končna gotovina', 'Gotovina', 'Kartice', 'Mobilno', 'Skupaj', 'Napitnine', 'Popusti', 'Poničeno', 'Razlika'])
        csv += '\n'

        for (const s of shifts) {
          const expected = s.startingCash + s.cashSales
          csv += toCsvRow([
            s.employeeName,
            new Date(s.openedAt).toLocaleString('sl-SI'),
            s.closedAt ? new Date(s.closedAt).toLocaleString('sl-SI') : 'Odprto',
            s.startingCash.toFixed(2),
            s.closingCash.toFixed(2),
            s.cashSales.toFixed(2),
            s.cardSales.toFixed(2),
            s.mobileSales.toFixed(2),
            s.totalSales.toFixed(2),
            s.totalTips.toFixed(2),
            s.totalDiscounts.toFixed(2),
            s.totalVoided.toFixed(2),
            (s.closingCash - expected).toFixed(2),
          ])
          csv += '\n'
        }
        filename = `izmene_${startDate || 'vse'}_${endDate || 'vse'}.csv`
        break
      }

      case 'inventory': {
        const items = await db.inventoryItem.findMany({
          include: { menuItem: { select: { name: true } } },
          orderBy: { name: 'asc' },
        })

        csv = toCsvRow(['Artikel', 'Enota', 'Količina', 'Min. količina', 'Cena/enoto', 'Servisov/enoto', 'Cena/servis', 'Dobavitelj', 'Kategorija', 'Povezani meni artikel'])
        csv += '\n'

        for (const item of items) {
          csv += toCsvRow([
            item.name,
            item.unit,
            item.quantity,
            item.minQuantity,
            item.costPerUnit.toFixed(2),
            item.servingsPerUnit,
            item.costPerServing.toFixed(2),
            item.supplier,
            item.category,
            item.menuItem?.name || '',
          ])
          csv += '\n'
        }
        filename = `zaloga_${new Date().toISOString().split('T')[0]}.csv`
        break
      }

      default:
        return NextResponse.json({ error: 'Neznana vrsta izvoza' }, { status: 400 })
    }

    // UTF-8 BOM za pravilen prikaz v Excelu
    const bom = '\uFEFF'
    const csvContent = bom + csv

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
      },
    })
  } catch (error) {
    console.error('Export error:', error)
    return NextResponse.json({ error: 'Napaka pri izvozu' }, { status: 500 })
  }
}
