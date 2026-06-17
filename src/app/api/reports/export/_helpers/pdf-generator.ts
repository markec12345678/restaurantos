// ============================================
// PDF GENERATOR — profesionalna PDF poročila za knjigovodstvo
// Uporablja pdfkit za generiranje strukturiranih PDF dokumentov
// ============================================

import PDFDocument from 'pdfkit'
import type { ReportData } from './report-data'

const EUR = (n: number) => `€${n.toFixed(2)}`

/** Generiraj PDF buffer iz poročila */
export async function generateReportPdf(data: ReportData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'A4' })
    const chunks: Buffer[] = []

    doc.on('data', (chunk: Buffer) => chunks.push(chunk))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)

    // ═══ HEADER ═══
    doc.fontSize(20).font('Helvetica-Bold').text('RestaurantOS', { align: 'center' })
    doc.fontSize(14).font('Helvetica').text('Poročilo o prometu', { align: 'center' })
    doc.moveDown(0.5)
    const period = data.startDate && data.endDate
      ? `Obdobje: ${data.startDate} do ${data.endDate}`
      : 'Obdobje: Vsa plačana naročila'
    doc.fontSize(10).text(period, { align: 'center' })
    doc.text(`Generirano: ${new Date(data.generatedAt).toLocaleString('sl-SI')}`, { align: 'center' })
    doc.moveDown(1)
    doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke()
    doc.moveDown(1)

    // ═══ POVZETEK ═══
    doc.fontSize(14).font('Helvetica-Bold').text('Povzetek', { underline: true })
    doc.moveDown(0.5)
    doc.fontSize(10).font('Helvetica')
    const summaryRows = [
      ['Skupni promet', EUR(data.summary.totalRevenue)],
      ['DDV skupaj', EUR(data.summary.totalTax)],
      ['Popusti skupaj', EUR(data.summary.totalDiscount)],
      ['Napitnine skupaj', EUR(data.summary.totalTip)],
      ['Število naročil', String(data.summary.totalOrders)],
    ]
    for (const [label, value] of summaryRows) {
      doc.text(label, 50, doc.y, { continued: true, width: 300 })
      doc.text(value, { align: 'right', width: 495 })
    }
    doc.moveDown(1)

    // ═══ DDV RAZČLENITEV ═══
    if (data.vatBreakdown.length > 0) {
      doc.fontSize(14).font('Helvetica-Bold').text('DDV razčlenitev', { underline: true })
      doc.moveDown(0.5)

      // Tabela header
      doc.fontSize(9).font('Helvetica-Bold')
      const tableTop = doc.y
      const cols = [50, 150, 280, 380, 480]
      doc.text('Stopnja', cols[0], tableTop)
      doc.text('Koda', cols[1], tableTop)
      doc.text('Osnova', cols[2], tableTop, { align: 'right', width: 100 })
      doc.text('DDV', cols[3], tableTop, { align: 'right', width: 100 })
      doc.text('Skupaj', cols[4], tableTop, { align: 'right', width: 65 })
      doc.moveDown(0.3)
      doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#ccc').stroke()
      doc.moveDown(0.2)

      // Vrstice
      doc.font('Helvetica')
      for (const v of data.vatBreakdown) {
        const y = doc.y
        doc.text(`${v.rate}%`, cols[0], y)
        doc.text(v.code, cols[1], y)
        doc.text(EUR(v.baseAmount), cols[2], y, { align: 'right', width: 100 })
        doc.text(EUR(v.vatAmount), cols[3], y, { align: 'right', width: 100 })
        doc.text(EUR(v.totalAmount), cols[4], y, { align: 'right', width: 65 })
        doc.moveDown(0.3)
      }
      doc.moveDown(1)
    }

    // ═══ PLAČILNE METODE ═══
    const pmEntries = Object.entries(data.summary.paymentMethodBreakdown)
    if (pmEntries.length > 0) {
      doc.fontSize(14).font('Helvetica-Bold').text('Plačilne metode', { underline: true })
      doc.moveDown(0.5)
      doc.fontSize(10).font('Helvetica')
      for (const [method, amount] of pmEntries) {
        doc.text(method.toUpperCase(), 50, doc.y, { continued: true, width: 300 })
        doc.text(EUR(amount), { align: 'right', width: 495 })
      }
      doc.moveDown(1)
    }

    // ═══ NOVA STRAN: Seznam naročil ═══
    if (data.orders.length > 0) {
      doc.addPage()
      doc.fontSize(14).font('Helvetica-Bold').text('Seznam naročil', { underline: true })
      doc.moveDown(0.5)

      doc.fontSize(8).font('Helvetica-Bold')
      const ot = doc.y
      doc.text('#', 50, ot, { width: 30 })
      doc.text('Datum', 80, ot, { width: 90 })
      doc.text('Stranka', 170, ot, { width: 120 })
      doc.text('Tip', 290, ot, { width: 60 })
      doc.text('Metoda', 350, ot, { width: 60 })
      doc.text('Skupaj', 460, ot, { align: 'right', width: 85 })
      doc.moveDown(0.3)
      doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#ccc').stroke()
      doc.moveDown(0.2)

      doc.font('Helvetica')
      for (const o of data.orders) {
        if (doc.y > 780) { doc.addPage(); doc.fontSize(8).font('Helvetica') }
        const y = doc.y
        doc.text(String(o.orderNumber), 50, y, { width: 30 })
        doc.text(o.date, 80, y, { width: 90 })
        doc.text(o.customerName || '-', 170, y, { width: 120 })
        doc.text(o.type, 290, y, { width: 60 })
        doc.text(o.paymentMethod || '-', 350, y, { width: 60 })
        doc.text(EUR(o.total), 460, y, { align: 'right', width: 85 })
        doc.moveDown(0.25)
      }
    }

    // ═══ FOOTER ═══
    doc.moveDown(2)
    doc.fontSize(8).font('Helvetica-Oblique').fillColor('#666')
    doc.text(`RestaurantOS — Avtomatsko generirano poročilo | ${new Date().toISOString()}`, { align: 'center' })

    doc.end()
  })
}
