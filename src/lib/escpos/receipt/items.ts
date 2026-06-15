// ============================================
// ESC/POS RECEIPT — ARTIKLI
// Izpis artiklov, modifikatorjev, poničanih postavk
// ============================================

import type { ESCPOSBuilder } from '../types'
import type { ReceiptPrintData } from '../types'

/**
 * Nariši seznam artiklov na računu
 */
export function buildReceiptItems(b: ESCPOSBuilder, data: ReceiptPrintData, LINE_W: number): void {
  for (const item of data.items) {
    if (item.isVoided) {
      // Poničani artikel — prikažemo prečrtan
      b.smallText()
        .text(`  ${item.quantity}x ${item.name} [PONICANO]`)
        .lineFeed()
        .normalText()
      continue
    }

    const itemTotal = item.price * item.quantity
    const vatSuffix = item.vatRate > 0 ? ` (${item.vatRate}%)` : ' (0%)'
    const nameStr = `${item.quantity}x ${item.name}`
    const priceStr = `${itemTotal.toFixed(2)}`
    const nameLen = nameStr.length
    const priceLen = priceStr.length + 4 // EUR + space
    // FIX EP3 MEDIUM: Če je ime artikla predolgo, ga skrajšaj — prejšnja koda je overflowala vrstico
    // kar je pri tiskalnikih z 58mm papirjem (32 znakov) povzročilo grdo prelamljanje
    const maxNameLen = LINE_W - priceLen - vatSuffix.length - 1
    if (nameLen > maxNameLen) {
      const truncated = nameStr.substring(0, maxNameLen - 1) + '…'
      const padding = 1
      b.text(truncated + vatSuffix + ' '.repeat(padding) + priceStr + ' B')
      .lineFeed()
    } else {
      const padding = Math.max(1, LINE_W - nameLen - priceLen - vatSuffix.length)
      b.text(nameStr + vatSuffix + ' '.repeat(padding) + priceStr + ' B')
      .lineFeed()
    }

    // Modifikatorji
    if (item.modifiers && item.modifiers.length > 0) {
      for (const mod of item.modifiers) {
        const modName = `  + ${mod.name}`
        const modPrice = mod.price > 0 ? `${mod.price.toFixed(2)}` : ''
        const modPad = Math.max(1, LINE_W - modName.length - modPrice.length - 2)
        b.smallText().text(modName + ' '.repeat(modPad) + modPrice).normalText().lineFeed()
      }
    }
  }

  b.separator('-')
}
