// ============================================
// ESC/POS RECEIPT — VSOTE, DDV, SKUPAJ
// Vmesna vsota, DDV razčlenitev, popust, skupaj, napitnina
// ============================================

import type { ESCPOSBuilder } from '../types'
import type { ReceiptPrintData } from '../types'

/**
 * Nariši vmesno vsoto, DDV razčlenitev, popust in skupaj
 */
export function buildReceiptTotals(b: ESCPOSBuilder, data: ReceiptPrintData, LINE_W: number): void {
  // ─── VMESNA VSOTA ───
  const subtotalLabel = 'Vmesna vsota:'
  const subtotalVal = `${data.subtotal.toFixed(2)} EUR`
  const subPad = Math.max(1, LINE_W - subtotalLabel.length - subtotalVal.length)
  b.text(subtotalLabel + ' '.repeat(subPad) + subtotalVal).lineFeed()

  // ─── DDV PO STOPNVAH (ZDDV-1 format) ───
  b.separator('.')
  b.bold(true).text('DDV razclenitev:').bold(false).lineFeed()
  b.smallText()

  // Glava tabele
  const ddvHeader = '  Stopnja    Osnova        DDV      Skupaj'
  b.text(ddvHeader).lineFeed()
  b.separator('.')

  for (const vb of data.vatBreakdown) {
    const rateStr = `${vb.rate}%`.padStart(7)
    const baseStr = vb.base.toFixed(2).padStart(10)
    const vatStr = vb.vat.toFixed(2).padStart(10)
    const totalStr = (vb.base + vb.vat).toFixed(2).padStart(10)
    b.text(`  ${rateStr}  ${baseStr}  ${vatStr}  ${totalStr}`).lineFeed()
  }

  // Skupaj DDV
  const ddvTotalLabel = '  SKUPAJ DDV:'
  const ddvTotalVal = data.totalVat.toFixed(2).padStart(10)
  b.bold(true).text(`${ddvTotalLabel}${' '.repeat(Math.max(1, LINE_W - ddvTotalLabel.length - ddvTotalVal.length - 4))}${ddvTotalVal}`).bold(false).lineFeed()
  b.normalText()

  // ─── POPUST ───
  if (data.discount > 0) {
    const discLabel = data.discountName ? `Popust (${data.discountName}):` : 'Popust:'
    const discVal = `-${data.discount.toFixed(2)} EUR`
    const discPad = Math.max(1, LINE_W - discLabel.length - discVal.length)
    b.text(discLabel + ' '.repeat(discPad) + discVal).lineFeed()
  }

  b.separator('=')

  // ─── SKUPAJ ───
  b.bold(true)
    .largeText()
    .text(`SKUPAJ: ${data.total.toFixed(2)} EUR`)
    .normalText()
    .bold(false)
    .lineFeed()

  // ─── NAPITNINA ───
  if (data.tip > 0) {
    const tipLabel = 'Napitnina:'
    const tipVal = `${data.tip.toFixed(2)} EUR`
    const tipPad = Math.max(1, LINE_W - tipLabel.length - tipVal.length)
    b.text(tipLabel + ' '.repeat(tipPad) + tipVal).lineFeed()

    b.bold(true)
      .text(`SKUPAJ Z NAPITNINO: ${data.totalWithTip.toFixed(2)} EUR`)
      .bold(false)
      .lineFeed()
  }

  // ─── NAČIN PLAČILA ───
  const paymentLabels: Record<string, string> = {
    cash: 'Gotovina',
    card: 'Kartica',
    mobile: 'Mobilno',
    voucher: 'Bon',
    alternate: 'Drugo',
  }
  b.text(`Nacin placila: ${paymentLabels[data.paymentMethod] || data.paymentMethod}`).lineFeed()

  b.separator('=')
}
