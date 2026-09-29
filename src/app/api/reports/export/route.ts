// ============================================
// GET /api/reports/export — Izvoz poročil v CSV / PDF / Excel / eDavki XML
// Parametri: type=orders|items|vat|employees|shifts|inventory|payments|refunds|purchases|expenses|daily-close|journal, format=csv|pdf|excel|xml|ubl, startDate, endDate, locationId
// Vrne datoteko v ustreznem formatu z UTF-8 podporo
//
// R146-b (epic #115 #33 Accounting exports):
//   • 6 novih računovodskih CSV tipov (payments/refunds/purchases/expenses/
//     daily-close/journal) — reproducibilni izvoz iz istega source of truth
//     (Decimal(12,2) EUR, ISO datumi, determinističen orderBy),
//   • rate-limit bucket 'reports-export' PRED authom (pariteta liability),
//   • MODEL A scope: ročni blok zamenjan z resolveTenantLocationIdOrThrow
//     (regular brez lokacije → 403 fail-closed; super-admin brez ?locationId
//     = global, z ?locationId = cross-branch),
//   • audit ACCOUNTING_EXPORTED SAMO ob uspešnem izvozu (epic P2-04:
//     "…export → authorization → audit"); NIČ ob 400/401/403/429,
//   • Cache-Control: no-store na uspešnih odgovorih (R144 kanon — občutljivi
//     finančni podatki se ne cache-irajo).
// ============================================

import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
// R146-b: resolver iz '@/lib/tenant-scope' (NIČ skozi barrel '@/lib/auth-middleware'
// — regresijski mocki, ki mockajo barrel z samo requireAuth, ostanejo združljivi;
// implementacija je ista — auth-middleware/tenant-scope je re-export shim).
import { resolveTenantLocationIdOrThrow } from '@/lib/tenant-scope'
import { createAuditLog } from '@/lib/db'
import { checkRateLimitAsync, getClientIp, AUTHENTICATED_LIMIT } from '@/lib/rate-limit'
import { rateLimitedResponse } from '@/lib/rate-limit/response'
import { validateReportDateRange } from '@/lib/validations'
import { handleApiError } from '@/lib/api-utils'
import { ljubljanaDayBounds } from '@/lib/timezone-sl'
import { getRestaurantInfoForLocation } from '@/lib/furs/config-resolver'
import {
  generateOrdersCsv, generateItemsCsv, generateVatCsv,
  generateEmployeesCsv, generateShiftsCsv, generateInventoryCsv,
  generatePaymentsCsv, generateRefundsCsv, generatePurchasesCsv,
  generateExpensesCsv, generateDailyCloseCsv, generateJournalCsv,
  countCsvRows, ACCOUNTING_CSV_TYPES,
  fetchReportData, generateReportPdf, generateReportExcel, generateEdavkiXml, generateUblInvoice,
  getFilename, ALLOWED_TYPES, ALLOWED_FORMATS,
} from './_helpers'
import type { ReportType, ExportFormat } from './_helpers'


export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  try {
    // R146-b: rate limit PRED authom (pariteta gift-cards-liability / reports-vat)
    const rl = await checkRateLimitAsync('reports-export', getClientIp(req), AUTHENTICATED_LIMIT)
    if (!rl.allowed) return rateLimitedResponse(rl.retryAfterMs, 'Preveč zahtevkov')

    const { searchParams } = new URL(req.url)
    const type = searchParams.get('type') || 'orders'
    const format = (searchParams.get('format') || 'csv') as ExportFormat

    const permission = type === 'inventory' ? 'admin' : 'view_reports'
    const authResult = await requireAuth(req, { permission })
    if (authResult.error) return authResult.error

    // R146-b (MODEL A; nadgradnja FIX R82-F): scope iz ENOTNEGA resolverja —
    // regular brez lokacije → 403 fail-closed (NO_LOCATION_MESSAGE);
    // lokacijska seja avtoritativna (?locationId ignoriran); super-admin brez
    // ?locationId = null scope (globalni izvoz), z ?locationId = cross-branch.
    const scope = resolveTenantLocationIdOrThrow(authResult.session, searchParams, {
      endpoint: 'GET /api/reports/export',
    })
    if ('error' in scope) return scope.error
    const locId = scope.locationId

    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    const dateError = validateReportDateRange(startDate, endDate)
    if (dateError) return dateError

    if (!ALLOWED_TYPES.includes(type as ReportType)) {
      return NextResponse.json({ error: 'Neznana vrsta izvoza' }, { status: 400 })
    }
    if (!ALLOWED_FORMATS.includes(format)) {
      return NextResponse.json({ error: `Neznan format. Dovoljeni: ${ALLOWED_FORMATS.join(', ')}` }, { status: 400 })
    }
    // R146-b: računovodski tipi izvažajo SAMO CSV (reproducibilnost — glej
    // _helpers/accounting-reports.ts header); PDF/Excel/XML/UBL = DEFER.
    if (ACCOUNTING_CSV_TYPES.includes(type as ReportType) && format !== 'csv') {
      return NextResponse.json({ error: 'Neznan format. Dovoljeni: csv' }, { status: 400 })
    }

    // R158-4 (R159-b): računovodsko izvozno okno po LJ poslovnemu dnevu
    // (prej UTC polnoč / 23:59:59.999Z). end = ekskluzivna LJ polnoč
    // naslednjega dne (lt) — konzumenti (generate*Csv) širijo filter v where.
    const dateFilter: Record<string, Date> = {}
    if (startDate) dateFilter.gte = ljubljanaDayBounds(startDate).start
    if (endDate) dateFilter.lt = ljubljanaDayBounds(endDate).end

    const reportType = type as ReportType
    const filename = getFilename(reportType, startDate, endDate, format)

    // ═══ CSV (originalna logika + R146-b računovodski tipi) ═══
    if (format === 'csv') {
      let csv = ''
      switch (reportType) {
        case 'orders': { csv = (await generateOrdersCsv(dateFilter, locId)).csv; break }
        case 'items': { csv = (await generateItemsCsv(dateFilter, locId)).csv; break }
        case 'vat': { csv = (await generateVatCsv(dateFilter, locId)).csv; break }
        case 'employees': { csv = (await generateEmployeesCsv(dateFilter, locId)).csv; break }
        case 'shifts': { csv = (await generateShiftsCsv(dateFilter, locId)).csv; break }
        case 'inventory': { csv = (await generateInventoryCsv(locId)).csv; break }
        // R146-b: računovodski izvozi (MODEL A scope — payments/refunds prek
        // check.order.locationId, ostali prek lastnega/pogojnega locationId)
        case 'payments': { csv = (await generatePaymentsCsv(dateFilter, locId)).csv; break }
        case 'refunds': { csv = (await generateRefundsCsv(dateFilter, locId)).csv; break }
        case 'purchases': { csv = (await generatePurchasesCsv(dateFilter, locId)).csv; break }
        case 'expenses': { csv = (await generateExpensesCsv(dateFilter, locId)).csv; break }
        case 'daily-close': { csv = (await generateDailyCloseCsv(dateFilter, locId)).csv; break }
        case 'journal': { csv = (await generateJournalCsv(dateFilter, locId)).csv; break }
      }

      // R146-b audit: SAMO ob uspešnem izvozu (audit obstaja ⇔ izvoz uspel);
      // NIKOLI ob 400/401/403/429. Details = številki/counters brez PII.
      await createAuditLog({
        action: 'ACCOUNTING_EXPORTED',
        entityType: 'ReportExport',
        entityId: `${type}:${format}`,
        userId: authResult.session?.employeeId,
        locationId: locId,
        details: { type, format, startDate, endDate, rows: countCsvRows(csv) },
      })

      const bom = '\uFEFF'
      return new NextResponse(bom + csv, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
          'Cache-Control': 'no-store', // R144 kanon: finančni izvoz se ne cache-ira
        },
      })
    }

    // ═══ PDF / Excel / XML — uporabljajo skupni ReportData fetcher ═══
    // Za te formate uporabimo orders tip (popoln promet z DDV razčlenitvijo)
    const data = await fetchReportData(dateFilter, locId)

    // Pridobi davčno številko in ime iz Location (za XML)
    // FIX P0-C3A: Prej je bil `findFirst()` BREZ where filtra — vrne naključni record!
    // Sedaj uporablja getRestaurantInfoForLocation z scoped lokacijo (R146-b:
    // locId — super-admin z ?locationId dobi pravo lokacijo, ne null lookup).
    let taxNumber = ''
    let taxpayerName = 'RestaurantOS'
    if (format === 'xml') {
      const info = await getRestaurantInfoForLocation(locId)
      taxNumber = info.taxId || info.registerNumber || ''
      taxpayerName = info.name || 'RestaurantOS'
    }

    // R146-b audit: PDF/Excel/XML/UBL so obstoječi (orders) formati — isti
    // audit kanon kot CSV, rows = število naročil v poročilu. Postavljen ŠELE
    // za vsemi rejection točkami (audit obstaja ⇔ izvoz res uspel / 200).
    await createAuditLog({
      action: 'ACCOUNTING_EXPORTED',
      entityType: 'ReportExport',
      entityId: `${type}:${format}`,
      userId: authResult.session?.employeeId,
      locationId: locId,
      details: { type, format, startDate, endDate, rows: data.orders.length },
    })

    if (format === 'pdf') {
      const buffer = await generateReportPdf(data)
      return new NextResponse(new Uint8Array(buffer), {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
          'Cache-Control': 'no-store',
        },
      })
    }

    if (format === 'excel') {
      const buffer = await generateReportExcel(data)
      return new NextResponse(new Uint8Array(buffer), {
        status: 200,
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
          'Cache-Control': 'no-store',
        },
      })
    }

    if (format === 'xml') {
      const xml = generateEdavkiXml(data, { taxNumber, taxpayerName })
      return new NextResponse(xml, {
        status: 200,
        headers: {
          'Content-Type': 'application/xml; charset=utf-8',
          'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
          'Cache-Control': 'no-store',
        },
      })
    }

    // F6-1: UBL 2.1 / PEPPOL BIS 3.0 (EU 2026 e-invoicing mandat)
    if (format === 'ubl') {
      const ubl = generateUblInvoice(data, {
        supplierName: taxpayerName,
        supplierTaxId: taxNumber || 'SI00000000',
        supplierAddress: 'Slovenska cesta 1',
        supplierCity: 'Ljubljana',
        supplierCountry: 'SI',
        invoiceNumber: `POS-DAILY-${data.startDate || 'all'}`,
      })
      return new NextResponse(ubl, {
        status: 200,
        headers: {
          'Content-Type': 'application/xml; charset=utf-8',
          'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
          'Cache-Control': 'no-store',
        },
      })
    }

    return NextResponse.json({ error: 'Nepodprt format' }, { status: 400 })
  } catch (error: unknown) {
    return handleApiError(error, 'GET /api/reports/export', 'Napaka pri izvozu')
  }
}
