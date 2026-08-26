// ============================================
// ESC/POS RECEIPT — NOGA RAČUNA
// FURS podatki, QR koda, noga, odpiranje predala, rez
// ============================================

import type { ESCPOSBuilder } from '../types'
import type { ReceiptPrintData } from '../types'

/**
 * Nariši nogo računa — FURS podatki, QR koda, noga, predal, rez
 */
export function buildReceiptFooter(b: ESCPOSBuilder, data: ReceiptPrintData): void {
  // ─── FURS PODATKI (ZDDV-1 obvezni) ───
  b.smallText().lineFeed()

  if (data.zoi) {
    // ZOI razdeljen na 2 vrstici zaradi dolžine
    const zoiStr = data.zoi
    b.text(`ZOI: ${zoiStr.substring(0, 24)}`).lineFeed()
    if (zoiStr.length > 24) {
      b.text(`     ${zoiStr.substring(24)}`).lineFeed()
    }
  }

  if (data.eor) {
    b.text(`EOR: ${data.eor}`).lineFeed()
  }

  // FURS simulacija opozorilo
  if (data.isSimulation) {
    b.inverted(true)
      .text('*** FURS SIMULACIJA - Ni produkcijsko overjeno ***')
      .inverted(false)
      .lineFeed()
  }

  // QR koda vsebina (besedilno — tiskalnik podpira QR z GS k 3)
  if (data.qrContent) {
    b.lineFeed()
      .text('Preveri racun:').lineFeed()
    // Prikaži FURS URL skrajšan
    const qrLines = data.qrContent.match(/.{1,46}/g) || [data.qrContent]
    for (const line of qrLines) {
      b.text(line).lineFeed()
    }
  }

  b.normalText()

  // ─── NOGA RAČUNA ───
  if (data.receiptFooter) {
    b.lineFeed()
      .center()
      .smallText()
      .text(data.receiptFooter)
      .normalText()
      .lineFeed()
  }

  // Hvala in rez
  b.lineFeed()
    .center()
    .text('Hvala za obisk!')
    .lineFeed(3)

  // FIX EP7 LOW: Odperi predal PRED rezom — prejšnja koda je odprla predal PO rezu,
  // kar pomeni, da se predal odpre med izmetom računa namesto pred tem
  if (data.paymentMethod === 'cash') {
    b.openCashDrawer()
  }

  b.cut()
}
