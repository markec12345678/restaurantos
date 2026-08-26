// ============================================
// ESC/POS GENERATOR RAČUNA
// FURS račun (ZDDV-1 skladen)
// ============================================

import { createESCPOSBuilder } from '../builders'
import type { ReceiptPrintData, PrinterModel } from '../types'
import { buildReceiptHeader } from './header'
import { buildReceiptItems } from './items'
import { buildReceiptTotals } from './totals'
import { buildReceiptFooter } from './footer'

/**
 * Generiraj ESC/POS podatke za FURS račun (World-class format)
 * ZDDV-1 skladno — DDV po stopnjah, ZOI, EOR, QR koda
 */
// FIX MEDIUM: Prejšnja koda je hardcodirala LINE_W=48 za vse tiskalnike
// 58mm tiskalniki imajo 32 znakov na vrstico — hardcoded 48 povzroči prelom teksta
export function generateReceipt(data: ReceiptPrintData, model: PrinterModel = 'epson', lineWidth = 48): Buffer {
  const b = createESCPOSBuilder(model)
  const LINE_W = lineWidth

  buildReceiptHeader(b, data, LINE_W)
  buildReceiptItems(b, data, LINE_W)
  buildReceiptTotals(b, data, LINE_W)
  buildReceiptFooter(b, data)

  return b.build()
}
