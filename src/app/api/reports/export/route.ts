// ============================================
// GET /api/reports/export — Izvoz poročil v CSV / PDF / Excel / eDavki XML
// Parametri: type=orders|items|vat|employees|shifts|inventory, format=csv|pdf|excel|xml, startDate, endDate
// Vrne datoteko v ustreznem formatu z UTF-8 podporo
// ============================================

import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { validateReportDateRange } from '@/lib/validations'
import { handleApiError } from '@/lib/api-utils'
import { getRestaurantInfoForLocation } from '@/lib/furs/config-resolver'
import {
  generateOrdersCsv, generateItemsCsv, generateVatCsv,
  generateEmployeesCsv, generateShiftsCsv, generateInventoryCsv,
  fetchReportData, generateReportPdf, generateReportExcel, generateEdavkiXml, generateUblInvoice,
  getFilename, ALLOWED_TYPES, ALLOWED_FORMATS,
} from './_helpers'
import type { ReportType, ExportFormat } from './_helpers'


export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const type = searchParams.get('type') || 'orders'
    const format = (searchParams.get('format') || 'csv') as ExportFormat

    const permission = type === 'inventory' ? 'admin' : 'view_reports'
    const authResult = await requireAuth(req, { permission })
    if (authResult.error) return authResult.error

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

    const dateFilter: Record<string, Date> = {}
    if (startDate) dateFilter.gte = new Date(startDate)
    if (endDate) dateFilter.lte = new Date(endDate)

    const reportType = type as ReportType
    const filename = getFilename(reportType, startDate, endDate, format)

    // ═══ CSV (originalna logika) ═══
    if (format === 'csv') {
      let csv = ''
      switch (reportType) {
        case 'orders': { csv = (await generateOrdersCsv(dateFilter)).csv; break }
        case 'items': { csv = (await generateItemsCsv(dateFilter)).csv; break }
        case 'vat': { csv = (await generateVatCsv(dateFilter)).csv; break }
        case 'employees': { csv = (await generateEmployeesCsv(dateFilter)).csv; break }
        case 'shifts': { csv = (await generateShiftsCsv(dateFilter)).csv; break }
        case 'inventory': { csv = (await generateInventoryCsv()).csv; break }
      }
      const bom = '\uFEFF'
      return new NextResponse(bom + csv, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
        },
      })
    }

    // ═══ PDF / Excel / XML — uporabljajo skupni ReportData fetcher ═══
    // Za te formate uporabimo orders tip (popoln promet z DDV razčlenitvijo)
    const data = await fetchReportData(dateFilter)

    // Pridobi davčno številko in ime iz Location (za XML)
    // FIX P0-C3A: Prej je bil `findFirst()` BREZ where filtra — vrne naključni record!
    // Sedaj uporablja getRestaurantInfoForLocation z session.locationId.
    let taxNumber = ''
    let taxpayerName = 'RestaurantOS'
    if (format === 'xml') {
      const info = await getRestaurantInfoForLocation(authResult.session?.locationId)
      taxNumber = info.taxId || info.registerNumber || ''
      taxpayerName = info.name || 'RestaurantOS'
    }

    if (format === 'pdf') {
      const buffer = await generateReportPdf(data)
      return new NextResponse(new Uint8Array(buffer), {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
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
        },
      })
    }

    return NextResponse.json({ error: 'Nepodprt format' }, { status: 400 })
  } catch (error: unknown) {
    return handleApiError(error, 'GET /api/reports/export', 'Napaka pri izvozu')
  }
}
