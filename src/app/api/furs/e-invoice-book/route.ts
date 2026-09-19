// ============================================
// GET /api/furs/e-invoice-book — Knjiga računov (zakonska obveznost od 1. julija 2025)
// ============================================
// Slovenian law requires all VAT taxpayers to report the book of issued
// and received invoices electronically to FURS starting from 1 Jul 2025.
// This API generates the e-invoice book for a given period.
// ============================================

import { NextResponse } from 'next/server'
import { safeJsonParse } from '@/lib/json-fields'
import { db } from '@/lib/db'
import { toNum, round2 } from '@/lib/decimal'
import { requireAuth, resolveTenantLocationIdOrThrow } from '@/lib/auth-middleware'
import { handleApiError } from '@/lib/api-utils'
import { getRestaurantInfoForLocation } from '@/lib/furs/config-resolver'

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

    // FIX R76 (tenant override): Centralni tenant scope resolver namesto ročnih checkov.
    // Prej: (1) izdani racuni so uporabili samo session.locationId — super-admin override
    // je bil aplikiran SAMO na storno (inkonzistentno: isti report, dva razlicna tenanta),
    // (2) session.locationId=null (npr. WebAuthn admin) je videl VSE tenant-e (fail-open).
    // Zdaj: resolveTenantLocationIdOrThrow — fail-closed za regular usera brez lokacije,
    // super-admin ?locationId=X override se velja za OBE query (izdane + storno).
    const scope = resolveTenantLocationIdOrThrow(authResult.session, searchParams, {
      endpoint: 'GET /api/furs/e-invoice-book',
    })
    if ('error' in scope) return scope.error
    const scopedLocationId = scope.locationId

    const startDate = new Date(dateFrom)
    const endDate = new Date(dateTo + 'T23:59:59')

    // FIX Test 4.3: Filter by order.paidAt (not receipt.createdAt) for reconciliation with VAT report
    // Prej: createdAt filter je povzročal mismatch z VAT report (ki uporablja paidAt)
    // Sedaj: queryamo vse receipts in filtriramo po order.paidAt v aplikaciji
    // FIX Test 7.2: Multi-tenant isolation (R76: enoten scope prek resolverja)
    const receiptWhere: Record<string, unknown> = { isStorno: false }
    if (scopedLocationId) {
      receiptWhere.locationId = scopedLocationId
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

    // Pridobi storno račune (isti scope kot izdani — R76: prej je super-admin override
    // veljal samo za storno, izdani so ostali na session.locationId → inkonzistenca)
    const stornoWhere: Record<string, unknown> = { isStorno: true }
    if (scopedLocationId) {
      stornoWhere.locationId = scopedLocationId
    }

    const allStornos = await db.receipt.findMany({
      where: stornoWhere,
      include: {
        order: { select: { orderNumber: true, type: true, paymentMethod: true, paymentStatus: true, paidAt: true } },
      },
      orderBy: { receiptNumber: 'asc' },
    })

    const stornos = allStornos.filter(r => {
      const dateToCheck = r.order?.paidAt || r.createdAt
      return dateToCheck >= startDate && dateToCheck <= endDate
    })

    // FIX P0-C3A: Pridobi poslovne podatke iz Location (vezano na resolved scope)
    // Prej: settings.findFirst({isActive:true}) — globalno, v multi-tenant napačna lokacija
    // R76: scope.locationId že vključuje super-admin ?locationId override (konzistentno
    // z receipt Where pogoji) — izdajateljevi podatki prihajajo iz iste lokacije kot računi.
    const info = await getRestaurantInfoForLocation(scopedLocationId)

    // Zgradi knjigo računov
    const issuedInvoices = receipts.map(r => ({
      zaporednaStevilka: r.receiptNumber,
      stevilkaRacuna: r.receiptNumber.toString().padStart(6, '0'),
      datumIzdaje: new Date(r.createdAt).toISOString().split('T')[0],
      // FIX P0-C3A: uporabi snapshot iz receipta (zapisan ob kreaciji) ali Location info
      davcnaStevilkaIzdajatelja: r.taxId || info.taxId || '',
      nazivIzdajatelja: r.businessName || info.name || '',
      zoi: r.zoi,
      eor: r.eor || '',
      davcnoPotrjeno: r.fiscalVerified,
      status: r.fiscalStatus,
      // Zneski
      osnovaBrezDDV: round2(toNum(r.subtotal)),
      znesekDDV: round2(toNum(r.totalVat)),
      skupniZnesek: round2(toNum(r.total)),
      napitnina: round2(toNum(r.tip)),
      // P1-9: varna parse — pokvarjen vatBreakdown string ne sesuje celotne
      // knjige izdanih računov (prej: JSON.parse throw → 500 na vseh računih)
      ddvRazčlenitev: safeJsonParse<unknown>(r.vatBreakdown, []),
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
      davcnaStevilkaIzdajatelja: r.taxId || info.taxId || '',
      nazivIzdajatelja: r.businessName || info.name || '',
      zoi: r.zoi,
      eor: r.eor || '',
      davcnoPotrjeno: r.fiscalVerified,
      status: r.fiscalStatus,
      osnovaBrezDDV: round2(toNum(r.subtotal)),
      znesekDDV: round2(toNum(r.totalVat)),
      skupniZnesek: round2(toNum(r.total)),
      napitnina: round2(toNum(r.tip)),
      ddvRazčlenitev: safeJsonParse<unknown>(r.vatBreakdown, []),
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
        naziv: info.name || '',
        davcnaStevilka: info.taxId || '',
        matičnaStevilka: info.businessId || '',
        naslov: `${info.address || ''}, ${info.postCode || ''} ${info.city || ''}`.trim(),
        registerId: info.registerNumber || '',
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
