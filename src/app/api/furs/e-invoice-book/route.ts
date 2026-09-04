// ============================================
// GET /api/furs/e-invoice-book — Knjiga računov (zakonska obveznost od 1. julija 2025)
// ============================================
// Slovenian law requires all VAT taxpayers to report the book of issued
// and received invoices electronically to FURS starting from 1 Jul 2025.
// This API generates the e-invoice book for a given period.
// ============================================

import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { toNum, round2 } from '@/lib/decimal'
import { requireAuth } from '@/lib/auth-middleware'
import { handleApiError } from '@/lib/api-utils'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  try {
    const authResult = await requireAuth(req, { permission: 'view_reports' })
    if (authResult.error) return authResult.error

    const { searchParams } = new URL(req.url)
    const dateFrom = searchParams.get('dateFrom')
    const dateTo = searchParams.get('dateTo')
    const format = searchParams.get('format') || 'json' // json | xml | csv

    if (!dateFrom || !dateTo) {
      return NextResponse.json({ error: 'dateFrom in dateTo sta obvezna' }, { status: 400 })
    }

    const startDate = new Date(dateFrom)
    const endDate = new Date(dateTo + 'T23:59:59')

    // FIX Test 4.3: Filter by order.paidAt (not receipt.createdAt) for reconciliation with VAT report
    // Prej: createdAt filter je povzročal mismatch z VAT report (ki uporablja paidAt)
    // Sedaj: queryamo vse receipts in filtriramo po order.paidAt v aplikaciji
    // FIX Test 7.2: Multi-tenant isolation
    const receiptWhere: Record<string, unknown> = { isStorno: false }
    if (authResult.session?.locationId) {
      receiptWhere.locationId = authResult.session.locationId
    }

    const allReceipts = await db.receipt.findMany({
      where: receiptWhere,
      include: {
        order: {
          select: {
            orderNumber: true,
            type: true,
            paymentMethod: true,
            paymentStatus: true,
            paidAt: true,
          },
        },
      },
      orderBy: { receiptNumber: 'asc' },
    })

    // Filter by order.paidAt (fall back to receipt.createdAt if paidAt is null)
    const receipts = allReceipts.filter(r => {
      const dateToCheck = r.order?.paidAt || r.createdAt
      return dateToCheck >= startDate && dateToCheck <= endDate
    })

    // Pridobi storno račune (isti filter)
    const allStornos = await db.receipt.findMany({
      where: {
        isStorno: true,
      },
      include: {
        order: { select: { orderNumber: true, type: true, paymentMethod: true, paymentStatus: true, paidAt: true } },
      },
      orderBy: { receiptNumber: 'asc' },
    })

    const stornos = allStornos.filter(r => {
      const dateToCheck = r.order?.paidAt || r.createdAt
      return dateToCheck >= startDate && dateToCheck <= endDate
    })

    // Pridobi nastavitve
    const settings = await db.restaurantSettings.findFirst({ where: { isActive: true } })

    // Zgradi knjigo računov
    const issuedInvoices = receipts.map(r => ({
      zaporednaStevilka: r.receiptNumber,
      stevilkaRacuna: r.receiptNumber.toString().padStart(6, '0'),
      datumIzdaje: new Date(r.createdAt).toISOString().split('T')[0],
      davcnaStevilkaIzdajatelja: settings?.taxId || '',
      nazivIzdajatelja: settings?.name || '',
      zoi: r.zoi,
      eor: r.eor || '',
      davcnoPotrjeno: r.fiscalVerified,
      status: r.fiscalStatus,
      // Zneski
      osnovaBrezDDV: round2(toNum(r.subtotal)),
      znesekDDV: round2(toNum(r.totalVat)),
      skupniZnesek: round2(toNum(r.total)),
      napitnina: round2(toNum(r.tip)),
      // DDV razčlenitev
      ddvRazčlenitev: JSON.parse(r.vatBreakdown || '[]'),
      // Plačilo
      nacinPlacila: r.paymentMethod || r.order?.paymentMethod || '',
      vrstaNarocila: r.order?.type || '',
      // Storno
      jeStorno: false,
      stornoVezaniRacun: null,
    }))

    const stornoInvoices = stornos.map(r => ({
      zaporednaStevilka: r.receiptNumber,
      stevilkaRacuna: r.receiptNumber.toString().padStart(6, '0'),
      datumIzdaje: new Date(r.createdAt).toISOString().split('T')[0],
      davcnaStevilkaIzdajatelja: settings?.taxId || '',
      nazivIzdajatelja: settings?.name || '',
      zoi: r.zoi,
      eor: r.eor || '',
      davcnoPotrjeno: r.fiscalVerified,
      status: r.fiscalStatus,
      osnovaBrezDDV: round2(toNum(r.subtotal)),
      znesekDDV: round2(toNum(r.totalVat)),
      skupniZnesek: round2(toNum(r.total)),
      napitnina: round2(toNum(r.tip)),
      ddvRazčlenitev: JSON.parse(r.vatBreakdown || '[]'),
      nacinPlacila: r.paymentMethod || '',
      vrstaNarocila: r.order?.type || '',
      jeStorno: true,
      stornoVezaniRacun: r.stornoOf || null,
    }))

    const allInvoices = [...issuedInvoices, ...stornoInvoices]

    // Skupni seštevek
    const summary = {
      obdobje: { od: dateFrom, do: dateTo },
      steviloIzdanih: issuedInvoices.length,
      steviloStorniranih: stornoInvoices.length,
      skupaj: allInvoices.length,
      skupniPromet: round2(issuedInvoices.reduce((s, r) => s + r.skupniZnesek, 0)),
      skupniDDV: round2(issuedInvoices.reduce((s, r) => s + r.znesekDDV, 0)),
      skupnaNapitnina: round2(issuedInvoices.reduce((s, r) => s + r.napitnina, 0)),
      davcnoPotrjeni: allInvoices.filter(r => r.davcnoPotrjeno).length,
      nepotrjeni: allInvoices.filter(r => !r.davcnoPotrjeno).length,
      izdajatelj: {
        naziv: settings?.name || '',
        davcnaStevilka: settings?.taxId || '',
        matičnaStevilka: settings?.businessId || '',
        naslov: `${settings?.address || ''}, ${settings?.postCode || ''} ${settings?.city || ''}`,
        registerId: settings?.registerNumber || '',
      },
    }

    if (format === 'csv') {
      // CSV export
      const headers = ['Zap. št.', 'Številka računa', 'Datum', 'ZOI', 'EOR', 'Potrjen', 'Osnova', 'DDV', 'Skupaj', 'Napitnina', 'Storno']
      const rows = allInvoices.map(r => [
        r.zaporednaStevilka,
        r.stevilkaRacuna,
        r.datumIzdaje,
        r.zoi,
        r.eor,
        r.davcnoPotrjeno ? 'DA' : 'NE',
        r.osnovaBrezDDV.toFixed(2),
        r.znesekDDV.toFixed(2),
        r.skupniZnesek.toFixed(2),
        r.napitnina.toFixed(2),
        r.jeStorno ? 'DA' : 'NE',
      ])
      const csv = [headers, ...rows].map(row => row.map(c => `"${c}"`).join(';')).join('\n')
      const bom = '\uFEFF'
      return new NextResponse(bom + csv, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="e-invoice-book_${dateFrom}_${dateTo}.csv"`,
        },
      })
    }

    return NextResponse.json({
      summary,
      invoices: allInvoices,
    })
  } catch (error: unknown) {
    return handleApiError(error, 'GET /api/furs/e-invoice-book', 'Napaka pri generiranju knjige računov')
  }
}
