// ============================================
// ESC/POS RECEIPT — GLAVA RAČUNA
// Poslovni podatki, številka računa, datum
// ============================================

import type { ESCPOSBuilder } from '../types'
import type { ReceiptPrintData } from '../types'

/**
 * Nariši glavo računa — poslovni podatki, naslov, maticna stevilka
 */
export function buildReceiptHeader(b: ESCPOSBuilder, data: ReceiptPrintData, _LINE_W: number): void {
  b.init()
    .center()
    .bold(true)
    .largeText()
    .text(data.businessName)
    .normalText()
    .bold(false)
    .lineFeed()

  b.smallText()
  if (data.businessAddress) b.text(data.businessAddress).lineFeed()
  if (data.businessPostCode || data.businessCity) {
    b.text(`${data.businessPostCode || ''} ${data.businessCity || ''}`).lineFeed()
  }
  if (data.businessPhone) b.text(`Tel: ${data.businessPhone}`).lineFeed()
  b.lineFeed()
    .text(`Maticna st.: ${data.businessId}`)
    .lineFeed()
    .text(`ID za DDV: ${data.taxId}`)
    .lineFeed()
    .text(`Blagajna: ${data.registerId}`)
    .lineFeed()
  if (data.premisesId) {
    b.text(`Poslovni prostor: ${data.premisesId}`).lineFeed()
  }

  b.separator('=')
    .left()
    .normalText()

  // ─── ŠTEVILKA RAČUNA IN DATUM ───
  const receiptLabel = data.receiptNumber || `R-${data.orderNumber}`
  b.bold(true)
    .text(`Racun: ${receiptLabel}`)
    .bold(false)
    .lineFeed()

  b.smallText()
    .text(new Date(data.timestamp).toLocaleString('sl-SI', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit'
    }))
    .lineFeed()

  // Vrsta naročila in miza
  const typeLabels: Record<string, string> = {
    'dine-in': 'Na mestu',
    'takeout': 'Za seboj',
    'delivery': 'Dostava',
  }
  if (data.orderType) {
    b.text(`Vrsta: ${typeLabels[data.orderType] || data.orderType}`)
    if (data.tableNumber) b.text(` | Miza ${data.tableNumber}`)
    b.lineFeed()
  }
  if (data.customerName) {
    b.text(`Stranka: ${data.customerName}`).lineFeed()
  }
  if (data.operatorName) {
    b.text(`Blagajnik: ${data.operatorName}`).lineFeed()
  }
  b.normalText()

  b.separator('-')
}
