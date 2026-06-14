// ============================================
// ESC/POS UKAZNI GRADILNIK
// Podpora za Star SP700 (impact) in Epson TM-T88VI (thermal)
// Kodna stran 852 (Latin 2) za slovenske znake (č, š, ž, itd.)
// ============================================

import { logger } from '@/lib/logger'

// ESC/POS ukazi
const ESC = '\x1B'
const GS = '\x1D'

// Kodna stran 852 (Latin 2 - za slovenščino)
const CODE_PAGE_852 = 852

// FIX BUG-EP1 CRITICAL: MAX_PRINT_BUFFER je bil referenciran a nikoli definiran — runtime ReferenceError
// Omejitev na 16KB prepreči buffer overflow v tiskalniku
const MAX_PRINT_BUFFER = 16 * 1024 // 16 KB

// ============================================
// SLOVENSKA ZNAKOVNA MAPA (CP852)
// ============================================

const SLOVENIAN_CHAR_MAP: Record<string, string> = {
  'č': '\x9D', // č v CP852
  'š': '\x9A', // š v CP852
  'ž': '\x9E', // ž v CP852
  'Č': '\x8D', // Č v CP852
  'Š': '\x8A', // Š v CP852
  'Ž': '\x8E', // Ž v CP852
  'ć': '\x87', // ć v CP852
  'Ć': '\x86', // Ć v CP852
  'đ': '\x91', // đ v CP852
  'Đ': '\x90', // Đ v CP852
}

/**
 * Pretvori slovenske znake v CP852 kodiranje
 * FIX HIGH: Odstrani ESC (\x1B) in GS (\x1D) znake iz vnosa — prepreči ESC/POS injection
 * Zlonamerni vnosi z ESC/GS znaki bi se interpretirali kot ukazi tiskalnika
 * FIX EP6 LOW: Odstrani tudi NUL (0x00), FF (0x0C) in FS (0x1C) — prepreči nepravilno premikanje papirja
 */
function encodeSlovenian(text: string): string {
  let result = ''
  for (const char of text) {
    const code = char.charCodeAt(0)
    // FIX: Odstrani kontrolne znake — ESC (0x1B), GS (0x1D), NUL (0x00), FF (0x0C), FS (0x1C)
    if (code === 0x00 || code === 0x0C || code === 0x1B || code === 0x1C || code === 0x1D) continue
    if (SLOVENIAN_CHAR_MAP[char]) {
      result += SLOVENIAN_CHAR_MAP[char]
    } else {
      result += char
    }
  }
  return result
}

// ============================================
// UKAZNI GRADILNIK — EPSON TM-T88VI (standardni ESC/POS)
// ============================================

export interface ESCPOSBuilder {
  commands: string[]
  init: () => ESCPOSBuilder
  bold: (_on?: boolean) => ESCPOSBuilder
  center: () => ESCPOSBuilder
  left: () => ESCPOSBuilder
  right: () => ESCPOSBuilder
  text: (_t: string) => ESCPOSBuilder
  lineFeed: (_n?: number) => ESCPOSBuilder
  separator: (_char?: string) => ESCPOSBuilder
  cut: (_partial?: boolean) => ESCPOSBuilder
  openCashDrawer: () => ESCPOSBuilder
  largeText: () => ESCPOSBuilder
  smallText: () => ESCPOSBuilder
  normalText: () => ESCPOSBuilder
  underline: (_on?: boolean) => ESCPOSBuilder
  inverted: (_on?: boolean) => ESCPOSBuilder
  tab: () => ESCPOSBuilder
  build: () => Buffer
}

function createEpsonBuilder(lineWidth = 48): ESCPOSBuilder {
  const commands: string[] = []

  const builder: ESCPOSBuilder = {
    commands,

    init() {
      commands.push(ESC + '@') // Initialize printer
      commands.push(ESC + 't' + String.fromCharCode(CODE_PAGE_852)) // Select code page 852
      return builder
    },

    bold(on = true) {
      commands.push(ESC + 'E' + (on ? '\x01' : '\x00'))
      return builder
    },

    center() {
      commands.push(ESC + 'a' + '\x01')
      return builder
    },

    left() {
      commands.push(ESC + 'a' + '\x00')
      return builder
    },

    right() {
      commands.push(ESC + 'a' + '\x02')
      return builder
    },

    text(t: string) {
      commands.push(encodeSlovenian(t))
      return builder
    },

    lineFeed(n = 1) {
      commands.push(ESC + 'd' + String.fromCharCode(n))
      return builder
    },

    separator(char = '-') {
      // FIX EP-01 HIGH: Uporabi lineWidth namesto hardcoded 48 — podpira 58mm (32 chars) in 80mm (48 chars)
      commands.push(encodeSlovenian(char.repeat(lineWidth)) + '\n')
      return builder
    },

    cut(partial = true) {
      // FIX EP-10 LOW: Feed 3 lines before cutting (prepreči rez na tiskanem besedilu)
      commands.push(ESC + 'd' + '\x03') // Feed 3 lines
      commands.push(GS + 'V' + (partial ? '\x01' : '\x00'))
      return builder
    },

    // FIX EP-02 HIGH: Cash drawer open ukaz — odpre predal po gotovinskem plačilu
    openCashDrawer() {
      // ESC p m t1 t2 — Pulse pin m (0=pin2, 1=pin5) for t1*2ms on, t2*2ms off
      commands.push(ESC + 'p' + '\x00' + String.fromCharCode(100) + String.fromCharCode(50))
      return builder
    },

    largeText() {
      // Double height and width
      commands.push(GS + '!' + '\x11')
      return builder
    },

    smallText() {
      // Reset to normal, then small
      commands.push(GS + '!' + '\x00')
      commands.push(ESC + '!' + '\x01') // Font B
      return builder
    },

    normalText() {
      commands.push(GS + '!' + '\x00')
      commands.push(ESC + '!' + '\x00') // Font A, normal
      return builder
    },

    underline(on = true) {
      commands.push(ESC + '-' + (on ? '\x01' : '\x00'))
      return builder
    },

    inverted(on = true) {
      commands.push(GS + 'B' + (on ? '\x01' : '\x00'))
      return builder
    },

    tab() {
      commands.push('\t')
      return builder
    },

    build() {
      const buf = Buffer.from(commands.join(''), 'binary')
      // FIX EP2 HIGH: Omeji velikost bufferja na 16KB — prepreči overflow tiskalnika
      if (buf.length > MAX_PRINT_BUFFER) {
        logger.warn('ESC/POS', `Epson buffer prevelik (${buf.length} bytes) — obrezujem na ${MAX_PRINT_BUFFER}`)
        return buf.subarray(0, MAX_PRINT_BUFFER)
      }
      return buf
    },
  }

  return builder
}

// ============================================
// UKAZNI GRADILNIK — STAR SP700 (impact printer)
// ============================================

function createStarBuilder(lineWidth = 48): ESCPOSBuilder {
  const commands: string[] = []

  const builder: ESCPOSBuilder = {
    commands,

    init() {
      commands.push(ESC + '@') // Initialize printer
      // FIX EP1 HIGH: Star SP700 MORA uporabiti ESC t 18 (code page 852) za pravilno slovenščino
      // Prejšnja koda je uporabila ESC R 12 (mednarodni nabor), ki spremeni le nekaj znakov
      // v osnovnem ASCII obsegu — č, š, ž, Č, Š, Ž so se tiskali kot smeti/prazno
      // ESC t 18 = izberi code page 852 (Latin 2), ki podpira vse slovenske znake
      commands.push(ESC + 't' + String.fromCharCode(18)) // Code page 852 (CP852 = Latin 2)
      return builder
    },

    bold(on = true) {
      commands.push(ESC + 'E' + (on ? '\x01' : '\x00'))
      return builder
    },

    center() {
      commands.push(ESC + 'a' + '\x01')
      return builder
    },

    left() {
      commands.push(ESC + 'a' + '\x00')
      return builder
    },

    right() {
      commands.push(ESC + 'a' + '\x02')
      return builder
    },

    text(t: string) {
      commands.push(encodeSlovenian(t))
      return builder
    },

    lineFeed(n = 1) {
      commands.push('\n'.repeat(n))
      return builder
    },

    separator(char = '-') {
      // FIX EP-01 HIGH: Uporabi lineWidth namesto hardcoded 48
      commands.push(encodeSlovenian(char.repeat(lineWidth)) + '\n')
      return builder
    },

    cut(partial = true) {
      // Star SP700: pulse the auto-cutter
      commands.push(ESC + 'd' + '\x03') // Feed 3 lines before cut
      commands.push(GS + 'V' + (partial ? '\x01' : '\x00'))
      return builder
    },

    // FIX EP-02 HIGH: Cash drawer open ukaz za Star tiskalnike
    openCashDrawer() {
      // Star cash drawer command: ESC p m t1 t2 (isti ukaz kot Epson)
      commands.push(ESC + 'p' + '\x00' + String.fromCharCode(100) + String.fromCharCode(50))
      return builder
    },

    largeText() {
      // Star: double height + double width
      commands.push(ESC + 'h' + '\x01') // Double height
      commands.push(ESC + 'w' + '\x01') // Double width
      return builder
    },

    smallText() {
      commands.push(ESC + 'h' + '\x00')
      commands.push(ESC + 'w' + '\x00')
      return builder
    },

    normalText() {
      commands.push(ESC + 'h' + '\x00')
      commands.push(ESC + 'w' + '\x00')
      return builder
    },

    underline(on = true) {
      commands.push(ESC + '-' + (on ? '\x01' : '\x00'))
      return builder
    },

    inverted(_on = true) {
      // Star SP700 ne podpira inverted, ignoriramo
      return builder
    },

    tab() {
      commands.push('\t')
      return builder
    },

    build() {
      const buf = Buffer.from(commands.join(''), 'binary')
      // FIX EP2 HIGH: Omeji velikost bufferja na 16KB — prepreči overflow tiskalnika
      if (buf.length > MAX_PRINT_BUFFER) {
        logger.warn('ESC/POS', `Star buffer prevelik (${buf.length} bytes) — obrezujem na ${MAX_PRINT_BUFFER}`)
        return buf.subarray(0, MAX_PRINT_BUFFER)
      }
      return buf
    },
  }

  return builder
}

// ============================================
// FACTORY FUNKCIJA
// ============================================

export type PrinterModel = 'epson' | 'star'

/**
 * Ustvari ESC/POS gradilnik glede na model tiskalnika
 * FIX EP-01 HIGH: Dodan lineWidth parameter — 48 za 80mm, 32 za 58mm papir
 */
export function createESCPOSBuilder(model: PrinterModel = 'epson', lineWidth = 48): ESCPOSBuilder {
  switch (model) {
    case 'star':
      return createStarBuilder(lineWidth)
    case 'epson':
    default:
      return createEpsonBuilder(lineWidth)
  }
}

// ============================================
// PRIPRAVA PODATKOV ZA TISKANJE
// ============================================

export interface KitchenOrderPrintData {
  orderNumber: number
  tableNumber?: number | null
  orderType: string
  customerName?: string
  items: Array<{
    quantity: number
    name: string
    modifiers?: Array<{ name: string }>
    notes?: string
    category?: string
  }>
  notes?: string
  timestamp: string
  stationName?: string
}

export interface ReceiptPrintData {
  orderNumber: number
  receiptNumber?: string      // R-YYYY-NNNNNN format
  businessName: string
  businessAddress: string
  businessCity?: string
  businessPostCode?: string
  businessPhone?: string
  businessId: string
  taxId: string
  registerId: string
  premisesId?: string
  zoi: string
  eor: string
  isSimulation?: boolean     // FURS simulacija opozorilo
  items: Array<{
    quantity: number
    name: string
    price: number             // Cena brez DDV na enoto
    vatRate: number
    isVoided?: boolean
    modifiers?: Array<{ name: string; price: number }>
  }>
  subtotal: number
  vatBreakdown: Array<{ rate: number; base: number; vat: number }>
  totalVat: number
  discount: number
  discountName?: string
  total: number
  tip: number
  totalWithTip: number
  paymentMethod: string
  timestamp: string
  qrContent?: string         // FURS QR koda vsebina
  receiptFooter?: string
  operatorName?: string      // Ime blagajnika
  tableNumber?: number | null
  orderType?: string         // dine-in, takeout, delivery
  customerName?: string
}

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
