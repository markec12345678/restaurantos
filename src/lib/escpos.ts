// ============================================
// ESC/POS UKAZNI GRADILNIK
// Podpora za Star SP700 (impact) in Epson TM-T88VI (thermal)
// Kodna stran 852 (Latin 2) za slovenske znake (č, š, ž, itd.)
// ============================================

// ESC/POS ukazi
const ESC = '\x1B'
const GS = '\x1D'

// Kodna stran 852 (Latin 2 - za slovenščino)
const CODE_PAGE_852 = 852

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
 */
function encodeSlovenian(text: string): string {
  let result = ''
  for (const char of text) {
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
  bold: (on?: boolean) => ESCPOSBuilder
  center: () => ESCPOSBuilder
  left: () => ESCPOSBuilder
  right: () => ESCPOSBuilder
  text: (t: string) => ESCPOSBuilder
  lineFeed: (n?: number) => ESCPOSBuilder
  separator: (char?: string) => ESCPOSBuilder
  cut: (partial?: boolean) => ESCPOSBuilder
  largeText: () => ESCPOSBuilder
  smallText: () => ESCPOSBuilder
  normalText: () => ESCPOSBuilder
  underline: (on?: boolean) => ESCPOSBuilder
  inverted: (on?: boolean) => ESCPOSBuilder
  tab: () => ESCPOSBuilder
  build: () => Buffer
}

function createEpsonBuilder(): ESCPOSBuilder {
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
      commands.push(encodeSlovenian(char.repeat(48)) + '\n')
      return builder
    },

    cut(partial = true) {
      commands.push(GS + 'V' + (partial ? '\x01' : '\x00'))
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
      return Buffer.from(commands.join(''), 'binary')
    },
  }

  return builder
}

// ============================================
// UKAZNI GRADILNIK — STAR SP700 (impact printer)
// ============================================

function createStarBuilder(): ESCPOSBuilder {
  const commands: string[] = []

  const builder: ESCPOSBuilder = {
    commands,

    init() {
      commands.push(ESC + '@') // Initialize printer
      commands.push(ESC + 'R' + String.fromCharCode(12)) // Select international charset (Central Europe)
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
      commands.push(encodeSlovenian(char.repeat(48)) + '\n')
      return builder
    },

    cut(partial = true) {
      // Star SP700: pulse the auto-cutter
      // ESC d n — print and feed n lines, then cut
      commands.push(ESC + 'd' + '\x03') // Feed 3 lines before cut
      commands.push(GS + 'V' + (partial ? '\x01' : '\x00'))
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

    inverted(on = true) {
      // Star SP700 ne podpira inverted, ignoriramo
      return builder
    },

    tab() {
      commands.push('\t')
      return builder
    },

    build() {
      return Buffer.from(commands.join(''), 'binary')
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
 */
export function createESCPOSBuilder(model: PrinterModel = 'epson'): ESCPOSBuilder {
  switch (model) {
    case 'star':
      return createStarBuilder()
    case 'epson':
    default:
      return createEpsonBuilder()
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
  businessName: string
  businessAddress: string
  businessId: string
  taxId: string
  registerId: string
  zoi: string
  eor: string
  items: Array<{
    quantity: number
    name: string
    price: number
    vatRate: number
  }>
  subtotal: number
  vatBreakdown: Array<{ rate: number; base: number; vat: number }>
  totalVat: number
  discount: number
  total: number
  tip: number
  paymentMethod: string
  timestamp: string
  receiptFooter?: string
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
 * Generiraj ESC/POS podatke za FURS račun
 */
export function generateReceipt(data: ReceiptPrintData, model: PrinterModel = 'epson'): Buffer {
  const b = createESCPOSBuilder(model)

  b.init()
    .center()
    .bold(true)
    .largeText()
    .text(data.businessName)
    .normalText()
    .bold(false)
    .lineFeed()

  b.smallText()
    .text(data.businessAddress)
    .lineFeed()
    .text(`Maticna st.: ${data.businessId}`)
    .lineFeed()
    .text(`ID za DDV: ${data.taxId}`)
    .lineFeed()
    .text(`Blagajna: ${data.registerId}`)
    .lineFeed()

  b.separator('=')
    .left()
    .normalText()

  // Čas in številka
  b.text(`Racun #${data.orderNumber}`)
    .tab()
    .text(new Date(data.timestamp).toLocaleString('sl-SI'))
    .lineFeed()

  b.separator('-')

  // Artikli
  for (const item of data.items) {
    const nameStr = `${item.quantity}x ${item.name}`
    const priceStr = `${(item.price * item.quantity).toFixed(2)} EUR`
    const padding = Math.max(1, 48 - nameStr.length - priceStr.length)
    b.text(nameStr + ' '.repeat(padding) + priceStr).lineFeed()
  }

  b.separator('-')

  // Vmesna vsota
  b.text('Vmesna vsota:').tab().text(`${data.subtotal.toFixed(2)} EUR`).lineFeed()

  // DDV po stopnjah
  for (const vb of data.vatBreakdown) {
    b.smallText()
      .text(`  DDV ${vb.rate}%: osnova ${vb.base.toFixed(2)}, DDV ${vb.vat.toFixed(2)}`)
      .normalText()
      .lineFeed()
  }

  // Popust
  if (data.discount > 0) {
    b.text(`Popust: -${data.discount.toFixed(2)} EUR`).lineFeed()
  }

  b.separator('=')

  // Skupaj
  b.bold(true)
    .largeText()
    .text(`SKUPAJ: ${data.total.toFixed(2)} EUR`)
    .normalText()
    .bold(false)
    .lineFeed()

  // Napitnina
  if (data.tip > 0) {
    b.text(`Napitnina: ${data.tip.toFixed(2)} EUR`).lineFeed()
    b.bold(true).text(`SKUPAJ Z NAPITNINO: ${(data.total + data.tip).toFixed(2)} EUR`).bold(false).lineFeed()
  }

  // Način plačila
  const paymentLabels: Record<string, string> = {
    cash: 'Gotovina',
    card: 'Kartica',
    mobile: 'Mobilno',
  }
  b.text(`Nacin placila: ${paymentLabels[data.paymentMethod] || data.paymentMethod}`).lineFeed()

  b.separator('-')

  // FURS podatki
  b.smallText()
  .lineFeed()

  if (data.zoi) {
    b.text(`ZOI: ${data.zoi}`).lineFeed()
  }
  if (data.eor) {
    b.text(`EOR: ${data.eor}`).lineFeed()
  }

  b.normalText()

  // Noga računa
  if (data.receiptFooter) {
    b.lineFeed().center().smallText().text(data.receiptFooter).normalText()
  }

  b.lineFeed(3).cut()

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
    .text('Slovenski znaki: c, s, z, C, S, Z')
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
