// ============================================
// ESC/POS GENERATORJI TISKANJA
// Kuhinjsko naročilo in testni tisk
// ============================================

import { createESCPOSBuilder } from './builders'
import type { KitchenOrderPrintData, PrinterModel } from './types'

/**
 * Generiraj ESC/POS podatke za kuhinjsko naročilo
 */
export function generateKitchenOrder(data: KitchenOrderPrintData, model: PrinterModel = 'epson'): Buffer {
  const b = createESCPOSBuilder(model)

  b.init()
    .center()
    .bold(true)
    .largeText()
    .text(`NAROCILO #${data.orderNumber}`)
    .normalText()
    .bold(false)
    .lineFeed()

  // Vrsta naročila in miza
  b.bold(true)
  const typeLabels: Record<string, string> = {
    'dine-in': 'NA MESTU',
    'takeout': 'ZA SEBOJ',
    'delivery': 'DOSTAVA',
  }
  b.text(`  ${typeLabels[data.orderType] || data.orderType}`)

  if (data.tableNumber) {
    b.text(`  |  MIZA ${data.tableNumber}`)
  }
  if (data.customerName) {
    b.text(`  |  ${data.customerName}`);
  }
  b.bold(false)
  b.lineFeed()

  b.separator('=')
  b.left()

  // Postaja (če je podana)
  if (data.stationName) {
    b.bold(true).text(`  POSTAJA: ${data.stationName}`).bold(false).lineFeed()
    b.separator('-')
  }

  // Artikli
  for (const item of data.items) {
    b.bold(true)
      .text(`  ${item.quantity}x  ${item.name}`)
      .bold(false)
      .lineFeed()

    // Modifikatorji
    if (item.modifiers && item.modifiers.length > 0) {
      for (const mod of item.modifiers) {
        b.text(`       + ${mod.name}`).lineFeed()
      }
    }

    // Opombe
    if (item.notes) {
      b.inverted(true)
        .text(`  *** ${item.notes} ***`)
        .inverted(false)
        .lineFeed()
    }
  }

  b.separator('=')

  // Skupne opombe
  if (data.notes) {
    b.bold(true).text('  OPOMBE: ').bold(false).text(data.notes).lineFeed()
    b.separator('-')
  }

  // Čas
  b.lineFeed()
    .smallText()
    .text(`  Cas: ${new Date(data.timestamp).toLocaleString('sl-SI')}`)
    .lineFeed(2)

  // Cut
  b.normalText().cut()

  return b.build()
}

/**
 * Generiraj testni tisk
 */
export function generateTestPrint(model: PrinterModel = 'epson'): Buffer {
  const b = createESCPOSBuilder(model)

  b.init()
    .center()
    .bold(true)
    .largeText()
    .text('TESTNI TISK')
    .normalText()
    .bold(false)
    .lineFeed(2)

  b.left()
    .text('RestaurantOS POS - Test tiskalnika')
    .lineFeed()
    .separator('-')
    // FIX LOW: Prejšnja koda je uporabila ASCII č,š,ž namesto pravih Slovenian znakov — test ni preverjal CP852
    .text('Slovenski znaki: č, š, ž, Č, Š, Ž')
    .lineFeed()
    .text('Posebni znaki: c, s, z')
    .lineFeed()
    .separator('-')
    .text(`Cas: ${new Date().toLocaleString('sl-SI')}`)
    .lineFeed()
    .text('Status: Tiskalnik deluje pravilno!')
    .lineFeed(3)
    .cut()

  return b.build()
}
