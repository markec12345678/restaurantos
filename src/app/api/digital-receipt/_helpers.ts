// Pomožne funkcije za digital-receipt API — Token generacija in formatiranje odgovora

import { db } from '@/lib/db'
import { toNum } from '@/lib/decimal'
import { generateFursQRContent } from '@/lib/furs'

// SECURITY: HMAC žeton za digitalne račune — prepreči enumeracijo ID-jev
export function generateReceiptToken(receiptId: string): string {
  const secret = process.env.RECEIPT_TOKEN_SECRET || process.env.NEXTAUTH_SECRET || 'fallback-receipt-secret'
  const data = `${receiptId}:${secret}`
  // Uporabimo preprosto zgoščevanje — za produkcijo priporočamo crypto.subtle.sign()
  let hash = 0
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash |= 0 // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36)
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
  } | null,
) {
  // Pridobi nastavitve
  const settings = await db.restaurantSettings.findFirst({ where: { isActive: true } })

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

  // FIX BUG3: Fetch active location's premisesId
  let premisesId = settings?.businessId || ''
  try {
    const activeLocation = await db.location.findFirst({ where: { isActive: true } })
    if (activeLocation?.premisesId) {
      premisesId = activeLocation.premisesId
    }
  } catch {
    // Location model may not exist — fall back to businessId
  }

  // QR vsebina
  const qrContent = receipt.zoi ? generateFursQRContent({
    zoi: receipt.zoi,
    totalAmount: toNum(receipt.total),
    issueDateTime: receipt.createdAt,
    taxId: settings?.taxId || '',
    businessId: settings?.businessId || '',
    registerId: settings?.registerNumber || 'BLG-001',
    premisesId,
  }) : ''

  const s: { address?: string; city?: string; postCode?: string; phone?: string; businessId?: string; taxId?: string; registerNumber?: string; receiptFooter?: string } = settings || {}

  return {
    id: receipt.id,
    receiptNumber: receipt.receiptNumber,
    businessName: receipt.businessName,
    businessAddress: s.address || receipt.businessAddress,
    businessCity: s.city || '',
    businessPostCode: s.postCode || '',
    businessPhone: s.phone || '',
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
    receiptFooter: s.receiptFooter || '',
    tableNumber: order?.table?.number || null,
    orderType: order?.type || '',
  }
}
