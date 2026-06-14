// ============================================
// ESC/POS GENERATOR RAČUNA
// FURS račun (ZDDV-1 skladen)
// ============================================

import { createESCPOSBuilder } from './builders'
import type { ReceiptPrintData, PrinterModel } from './types'

/**
 * Generiraj ESC/POS podatke za FURS račun (World-class format)
 * ZDDV-1 skladno — DDV po stopnjah, ZOI, EOR, QR koda
 */
// FIX MEDIUM: Prejšnja koda je hardcodirala LINE_W=48 za vse tiskalnike
// 58mm tiskalniki imajo 32 znakov na vrstico — hardcoded 48 povzroči prelom teksta
export function generateReceipt(data: ReceiptPrintData, model: PrinterModel = 'epson', lineWidth = 48): Buffer {
  const b = createESCPOSBuilder(model)
  const LINE_W = lineWidth

  // ─── GLAVA RAČUNA ───
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

  // ─── ARTIKLI ───
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

  return b.build()
}
