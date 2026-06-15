
// ============================================
// GET /api/reports/export — Izvoz poročil v CSV
// Parametri: type=orders|items|vat|employees|shifts|inventory, startDate, endDate
// Vrne CSV datoteko z ustreznimi podatki
// ============================================

import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { validateReportDateRange } from '@/lib/validations'
import { handleApiError } from '@/lib/api-utils'
import {
  generateOrdersCsv, generateItemsCsv, generateVatCsv,
  generateEmployeesCsv, generateShiftsCsv, generateInventoryCsv,
  getFilename, ALLOWED_TYPES,
} from './_helpers'
import type { ReportType } from './_helpers'

export async function GET(req: Request) {
  try {
    // FIX CRITICAL: Zahtevaj avtentikacijo za izvoz poslovnih podatkov
    // FIX HIGH: Inventory export zahteva admin — vsebuje občutljive nabavne podatke
    const { searchParams } = new URL(req.url)
    const type = searchParams.get('type') || 'orders'

    const permission = type === 'inventory' ? 'admin' : 'view_reports'
    const authResult = await requireAuth(req, { permission })
    if (authResult.error) return authResult.error

    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    // FIX HIGH: Validiraj datumski obseg — prepreči izvoz celotne zgodovine
    const dateError = validateReportDateRange(startDate, endDate)
    if (dateError) return dateError

    // FIX HIGH: Validiraj type parameter
    if (!ALLOWED_TYPES.includes(type as ReportType)) {
      return NextResponse.json({ error: 'Neznana vrsta izvoza' }, { status: 400 })
    }

    const dateFilter: Record<string, Date> = {}
    if (startDate) dateFilter.gte = new Date(startDate)
    if (endDate) dateFilter.lte = new Date(endDate)

    const reportType = type as ReportType
    let csv = ''
    let filename = ''

    switch (reportType) {
      case 'orders': {
        const result = await generateOrdersCsv(dateFilter)
        csv = result.csv
        break
      }
      case 'items': {
        const result = await generateItemsCsv(dateFilter)
        csv = result.csv
        break
      }
      case 'vat': {
        const result = await generateVatCsv(dateFilter)
        csv = result.csv
        break
      }
      case 'employees': {
        const result = await generateEmployeesCsv(dateFilter)
        csv = result.csv
        break
      }
      case 'shifts': {
        const result = await generateShiftsCsv(dateFilter)
        csv = result.csv
        break
      }
      case 'inventory': {
        const result = await generateInventoryCsv()
        csv = result.csv
        break
      }
    }

    filename = getFilename(reportType, startDate, endDate)

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
  } catch (error: unknown) {
    return handleApiError(error, 'GET /api/reports/export', 'Napaka pri izvozu')
  }
}
