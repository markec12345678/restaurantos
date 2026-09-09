// ============================================
// ESC/POS RECEIPT — VSOTE, DDV, SKUPAJ
// Vmesna vsota, DDV razčlenitev, popust, skupaj, napitnina
// ============================================

import type { ESCPOSBuilder } from '../types'
import type { ReceiptPrintData } from '../types'

/**
 * P2-UX FIX (decimalna vejica na tiskanem računu): slovenski zapis 12,50.
 */
function sl(n: number): string {
  return n.toFixed(2).replace('.', ',')
}

/**
 * Nariši vmesno vsoto, DDV razčlenitev, popust in skupaj
 */
export function buildReceiptTotals(b: ESCPOSBuilder, data: ReceiptPrintData, LINE_W: number): void {
  // ─── VMESNA VSOTA ───
  const subtotalLabel = 'Vmesna vsota:'
  const subtotalVal = `${sl(data.subtotal)} EUR`
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
    const baseStr = sl(vb.base).padStart(10)
    const vatStr = sl(vb.vat).padStart(10)
    const totalStr = sl(vb.base + vb.vat).padStart(10)
    b.text(`  ${rateStr}  ${baseStr}  ${vatStr}  ${totalStr}`).lineFeed()
  }

  // Skupaj DDV
  const ddvTotalLabel = '  SKUPAJ DDV:'
  const ddvTotalVal = sl(data.totalVat).padStart(10)
  b.bold(true).text(`${ddvTotalLabel}${' '.repeat(Math.max(1, LINE_W - ddvTotalLabel.length - ddvTotalVal.length - 4))}${ddvTotalVal}`).bold(false).lineFeed()
  b.normalText()

  // ─── POPUST ───
  if (data.discount > 0) {
    const discLabel = data.discountName ? `Popust (${data.discountName}):` : 'Popust:'
    const discVal = `-${sl(data.discount)} EUR`
    const discPad = Math.max(1, LINE_W - discLabel.length - discVal.length)
    b.text(discLabel + ' '.repeat(discPad) + discVal).lineFeed()
  }

  b.separator('=')

  // ─── SKUPAJ ───
  b.bold(true)
    .largeText()
    .text(`SKUPAJ: ${sl(data.total)} EUR`)
    .normalText()
    .bold(false)
    .lineFeed()

  // ─── NAPITNINA ───
  if (data.tip > 0) {
    const tipLabel = 'Napitnina:'
    const tipVal = `${sl(data.tip)} EUR`
    const tipPad = Math.max(1, LINE_W - tipLabel.length - tipVal.length)
    b.text(tipLabel + ' '.repeat(tipPad) + tipVal).lineFeed()

    b.bold(true)
      .text(`SKUPAJ Z NAPITNINO: ${sl(data.totalWithTip)} EUR`)
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
