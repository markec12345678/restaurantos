// Pomožne funkcije za digital-receipt API — Token generacija in formatiranje odgovora

import crypto from 'crypto'
import { toNum } from '@/lib/decimal'
import { generateFursQRContent } from '@/lib/furs'
import { getRestaurantInfoForLocation } from '@/lib/furs/config-resolver'

// SECURITY: HMAC-SHA256 žeton za digitalne račune — prepreči enumeracijo ID-jev
//
// Prejšnja implementacija je uporabljala 32-bitni DJB2 hash (~2,1 × 10⁹ možnosti,
// izražen kot 6-7 znakov base36) — brute-force v minutah. Sedaj uporabljamo
// pravi HMAC-SHA256 (256-bit), ki je kriptografsko varen.
//
// POMEMBNO: `RECEIPT_TOKEN_SECRET` MORA biti nastavljen v produkciji.
// Če ni, je token še vedno (šibko) zaščiten z NEXTAUTH_SECRET, a če tudi ta manjka,
// sprožimo napako namesto da pademo na javno-known fallback.
export function generateReceiptToken(receiptId: string): string {
  const secret = process.env.RECEIPT_TOKEN_SECRET || process.env.NEXTAUTH_SECRET
  if (!secret) {
    throw new Error(
      'RECEIPT_TOKEN_SECRET ali NEXTAUTH_SECRET mora biti nastavljen za varne digitalne račune.'
    )
  }
  // Uporabi prvi del (16 bajtov = 32 hex znakov) za krajši URL, še vedno 128-bit varnosti
  return crypto.createHmac('sha256', secret).update(receiptId).digest('hex').slice(0, 32)
}

// Constant-time primerjava za preprečitev timing napadov
export function verifyReceiptToken(receiptId: string, providedToken: string): boolean {
  const expectedToken = generateReceiptToken(receiptId)
  const a = Buffer.from(expectedToken)
  const b = Buffer.from(providedToken)
  if (a.length !== b.length) return false
  return crypto.timingSafeEqual(a, b)
}

export interface ReceiptRow {
  id: string
  receiptNumber: string
  businessName: string
  businessAddress: string
  registerId: string
  businessId: string
  taxId: string
  zoi: string
  eor: string
  fiscalVerified: boolean
  isStorno: boolean
  orderId: string
  subtotal: Parameters<typeof toNum>[0]
  totalVat: Parameters<typeof toNum>[0]
  discount: Parameters<typeof toNum>[0]
  total: Parameters<typeof toNum>[0]
  tip: Parameters<typeof toNum>[0]
  totalWithTip: Parameters<typeof toNum>[0]
  paymentMethod: string
  vatBreakdown: string
  createdAt: Date
}

export async function buildDigitalReceiptResponse(
  receipt: ReceiptRow,
  order: {
    table: { number: number } | null
    orderItems: Array<{
      menuItem?: { name: string } | null
      quantity: number
      price: Parameters<typeof toNum>[0]
      vatRate: Parameters<typeof toNum>[0]
      voided: boolean
      modifiersJson: string | null
    }> | null
    type: string
    locationId?: string | null
  } | null,
) {
  // FIX P0-C3A: Pridobi poslovne podatke iz Location (vezano na order.locationId)
  // Prej: settings.findFirst({isActive:true}) + findFirst({isActive:true}) za premisesId
  // Sedaj: getRestaurantInfoForLocation(order.locationId) — pravi podatki za pravi račun
  // OPOMBA: receipt že vsebuje snapshot (receipt.businessName, receipt.taxId, itd.) ki je bil
  // zapisan ob kreaciji — te uporabljamo za prikaz. Location pa uporabljamo za QR content
  // (ki mora biti vezan na pravo lokacijo za FURS skladnost).
  const info = await getRestaurantInfoForLocation(order?.locationId)

  // Pripravi artikle
  const items = (order?.orderItems || []).map(oi => {
    let modifiers: Array<{ name: string; price: number }> = []
    try { modifiers = JSON.parse(oi.modifiersJson || '[]') } catch { modifiers = [] }

    return {
      name: oi.menuItem?.name || 'Neznan artikel',
      quantity: oi.quantity,
      price: oi.price,
      vatRate: oi.vatRate,
      isVoided: oi.voided,
      modifiers,
    }
  })

  // DDV po stopnjah
  const vatBreakdown: Array<{ rate: number; base: number; vat: number }> = []
  try {
    const parsed = JSON.parse(receipt.vatBreakdown as string || '{}')
    for (const [rate, amounts] of Object.entries(parsed)) {
      const a = amounts as { base: number; vat: number }
      vatBreakdown.push({ rate: Number(rate), base: a.base, vat: a.vat })
    }
  } catch {
    // Neveljavna JSON struktura DDV razdelitve — nadaljuj s praznim seznamom
  }

  // FIX P0-C3A: premisesId iz prave lokacije (ne findFirst({isActive:true}))
  const premisesId = info.businessId || receipt.registerId || ''

  // QR vsebina — uporabi podatke iz Location (prava lokacija) ali snapshot iz receipt
  const qrContent = receipt.zoi ? generateFursQRContent({
    zoi: receipt.zoi,
    totalAmount: toNum(receipt.total),
    issueDateTime: receipt.createdAt,
    taxId: info.taxId || receipt.taxId || '',
    businessId: info.businessId || receipt.businessId || '',
    registerId: info.registerNumber || receipt.registerId || 'BLG-001',
    premisesId,
  }) : ''

  return {
    id: receipt.id,
    receiptNumber: receipt.receiptNumber,
    businessName: receipt.businessName,
    businessAddress: receipt.businessAddress,
    businessCity: info.city || '',
    businessPostCode: info.postCode || '',
    businessPhone: info.phone || '',
    businessId: receipt.businessId,
    taxId: receipt.taxId,
    registerId: receipt.registerId,
    zoi: receipt.zoi,
    eor: receipt.eor,
    fiscalVerified: receipt.fiscalVerified,
    isStorno: receipt.isStorno,
    items,
    subtotal: receipt.subtotal,
    vatBreakdown,
    totalVat: receipt.totalVat,
    discount: receipt.discount,
    total: receipt.total,
    tip: receipt.tip,
    totalWithTip: receipt.totalWithTip,
    paymentMethod: receipt.paymentMethod,
    createdAt: receipt.createdAt.toISOString(),
    qrContent,
    receiptFooter: '',
    tableNumber: order?.table?.number || null,
    orderType: order?.type || '',
  }
}
