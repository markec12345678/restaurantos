// ============================================
// EXCEL GENERATOR — profesionalni Excel izvoz za knjigovodstvo
// Uporablja exceljs za generiranje .xlsx datotek z več listi
// ============================================

import ExcelJS from 'exceljs'
import type { ReportData } from './report-data'

const EUR_FMT = '#,##0.00 €'

/** Generiraj Excel buffer iz poročila */
export async function generateReportExcel(data: ReportData): Promise<Buffer> {
  const wb = new ExcelJS.Workbook()
  wb.creator = 'RestaurantOS'
  wb.created = new Date()
  wb.modified = new Date()

  // ═══ LIST 1: POVZETEK ═══
  const wsSummary = wb.addWorksheet('Povzetek', { properties: { tabColor: { argb: 'FFF59E0B' } } })
  wsSummary.columns = [
    { width: 30 }, { width: 20 }, { width: 20 }, { width: 20 },
  ]

  // Naslov
  wsSummary.mergeCells('A1:D1')
  const titleCell = wsSummary.getCell('A1')
  titleCell.value = 'RestaurantOS — Poročilo o prometu'
  titleCell.font = { size: 16, bold: true }
  titleCell.alignment = { horizontal: 'center' }

  wsSummary.mergeCells('A2:D2')
  const periodCell = wsSummary.getCell('A2')
  const period = data.startDate && data.endDate
    ? `Obdobje: ${data.startDate} do ${data.endDate}`
    : 'Obdobje: Vsa plačana naročila'
  periodCell.value = period
  periodCell.font = { size: 11, italic: true }
  periodCell.alignment = { horizontal: 'center' }

  wsSummary.addRow([])
  wsSummary.addRow(['POVZETEK'])
  wsSummary.getCell('A4').font = { bold: true, size: 12 }

  const summaryData = [
    ['Skupni promet', data.summary.totalRevenue],
    ['DDV skupaj', data.summary.totalTax],
    ['Popusti skupaj', data.summary.totalDiscount],
    ['Napitnine skupaj', data.summary.totalTip],
    ['Število naročil', data.summary.totalOrders],
  ]
  for (const [label, value] of summaryData) {
    const row = wsSummary.addRow([label, value])
    row.getCell(1).font = { bold: true }
    row.getCell(2).numFmt = typeof value === 'number' && label.toString().includes('promet') || label.toString().includes('DDV') || label.toString().includes('Popust') || label.toString().includes('Napitnin') ? EUR_FMT : '0'
  }

  wsSummary.addRow([])
  wsSummary.addRow(['DDV RAZČLENITEV'])
  wsSummary.getCell(`A${wsSummary.rowCount}`).font = { bold: true, size: 12 }

  const vatHeader = wsSummary.addRow(['Stopnja %', 'Koda', 'Osnova', 'DDV', 'Skupaj'])
  vatHeader.font = { bold: true }
  vatHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3E0' } }
  for (const v of data.vatBreakdown) {
    const row = wsSummary.addRow([v.rate, v.code, v.baseAmount, v.vatAmount, v.totalAmount])
    row.getCell(3).numFmt = EUR_FMT
    row.getCell(4).numFmt = EUR_FMT
    row.getCell(5).numFmt = EUR_FMT
  }

  wsSummary.addRow([])
  wsSummary.addRow(['PLAČILNE METODE'])
  wsSummary.getCell(`A${wsSummary.rowCount}`).font = { bold: true, size: 12 }
  const pmHeader = wsSummary.addRow(['Metoda', 'Znesek'])
  pmHeader.font = { bold: true }
  pmHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'E3F2FD' } }
  for (const [method, amount] of Object.entries(data.summary.paymentMethodBreakdown)) {
    const row = wsSummary.addRow([method.toUpperCase(), amount])
    row.getCell(2).numFmt = EUR_FMT
  }

  // ═══ LIST 2: NAROČILA ═══
  const wsOrders = wb.addWorksheet('Naročila', { properties: { tabColor: { argb: 'FF10B981' } } })
  wsOrders.columns = [
    { header: 'Št.', key: 'orderNumber', width: 8 },
    { header: 'Datum', key: 'date', width: 22 },
    { header: 'Tip', key: 'type', width: 12 },
    { header: 'Miza', key: 'tableNumber', width: 8 },
    { header: 'Stranka', key: 'customerName', width: 25 },
    { header: 'Status', key: 'status', width: 12 },
    { header: 'Plačilo', key: 'paymentStatus', width: 12 },
    { header: 'Metoda', key: 'paymentMethod', width: 12 },
    { header: 'Vmesna', key: 'subtotal', width: 12 },
    { header: 'DDV', key: 'tax', width: 12 },
    { header: 'Popust', key: 'discount', width: 12 },
    { header: 'Skupaj', key: 'total', width: 12 },
    { header: 'Napitnina', key: 'tip', width: 12 },
    { header: 'Skupaj+napi.', key: 'totalWithTip', width: 14 },
    { header: 'Artikli', key: 'items', width: 40 },
  ]

  // Header styling
  wsOrders.getRow(1).font = { bold: true, color: { argb: 'FFFFFF' } }
  wsOrders.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '10B981' } }
  wsOrders.getRow(1).alignment = { horizontal: 'center' }

  // Data
  for (const o of data.orders) {
    wsOrders.addRow(o)
  }

  // Number formats for amount columns
  for (let i = 2; i <= data.orders.length + 1; i++) {
    ['I', 'J', 'K', 'L', 'M', 'N'].forEach(col => {
      wsOrders.getCell(`${col}${i}`).numFmt = EUR_FMT
    })
  }

  // Auto filter
  wsOrders.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: data.orders.length + 1, column: 15 },
  }

  // Freeze header
  wsOrders.views = [{ state: 'frozen', ySplit: 1 }]

  const buf = await wb.xlsx.writeBuffer()
  return Buffer.from(buf)
}
