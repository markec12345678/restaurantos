// Pomožne funkcije za račune
// GET/POST/PUT /api/receipts/[id] — pomožni modul za izračune, DDV razdelitev in ZOI

import { toNum, round2, multiply, divide, type DecimalLike } from '@/lib/decimal'
import crypto from 'crypto'

// ─── Tipi ───
export interface ReceiptItemCalc {
  id: string
  name: string
  quantity: number
  unitPrice: number
  vatRate: number
  basePrice: number
  vatAmount: number
  totalWithVat: number
  modifiers: { name: string; price?: number }[]
  notes: string | null
  category: string
}

export interface VatBreakdownEntry {
  base: number
  vat: number
  total: number
}

// ─── Privzete nastavitve restavracije (GET predogled) ───
export const DEFAULT_SETTINGS = {
  name: 'RestaurantOS',
  address: 'Podčetrtk 97',
  city: 'Podčetrtk',
  postCode: '3254',
  phone: '+386 3 818 30 00',
  email: '',
  taxId: 'SI12345678',
  businessId: '12345678',
  registerNumber: 'BLG-001',
  receiptFooter: 'Hvala za obisk!',
}

// ─── Privzete nastavitve (POST — minimalni nabor) ───
export const MINIMAL_SETTINGS = {
  name: 'RestaurantOS',
  address: '',
  postCode: '',
  city: '',
  businessId: '',
  taxId: '',
  registerNumber: 'BLG-001',
}

// ─── ZOI placeholder generator (pravi ZOI potrebuje FURS certifikat in digitalni podpis) ───
// FIX CRITICAL: Determinističen ZOI placeholder — ESM import namesto require('crypto')
export function generateZOIPlaceholder(orderNumber: number, receiptNumber: string): string {
  // Deterministični hash iz številke naročila + številke računa — vedno enak za isti račun
  const hash = crypto.createHash('sha256')
    .update(`ZOI-PLACEHOLDER-${orderNumber}-${receiptNumber}`)
    .digest('hex')
  // Vzamemo prvih 32 hex znakov (16 bajtov) in formatiramo
  return hash.substring(0, 32).toUpperCase()
}

// ─── Izračunaj postavke računa (za GET predogled) ───
// FIX MEDIUM: Izključi voidane artikle iz računa
export function buildReceiptItems(
  orderItems: Array<{
    id: string
    price: DecimalLike
    quantity: number
    vatRate: DecimalLike
    modifiersJson: string | null
    notes: string | null
    voided: boolean
    discountAmount: DecimalLike
    menuItem: { name: string; vatRate: DecimalLike; category: { name: string } | null }
  }>,
): ReceiptItemCalc[] {
  return orderItems
    .filter(oi => !oi.voided)
    .map(oi => {
      let modifiers: { name: string; price?: number }[] = []
      try {
        modifiers = JSON.parse(oi.modifiersJson || '[]')
      } catch { /* empty */ }

      const vatRate = toNum(oi.vatRate) || toNum(oi.menuItem?.vatRate) || 22.0
      // FIX MEDIUM: Vključi ceno modifikatorjev v skupno ceno artikla
      let modifiersTotal = 0
      for (const mod of modifiers) {
        modifiersTotal += mod.price || 0
      }
      // FIX BUG2: Subtract discountAmount from basePrice — previously discount was not deducted per-item
      const basePrice = (toNum(oi.price) + modifiersTotal) * oi.quantity - toNum(oi.discountAmount)
      const vatAmount = basePrice * (vatRate / 100)
      const totalWithVat = basePrice + vatAmount

      return {
        id: oi.id,
        name: oi.menuItem.name,
        quantity: oi.quantity,
        unitPrice: toNum(oi.price),
        vatRate,
        basePrice,
        vatAmount,
        totalWithVat,
        modifiers,
        notes: oi.notes,
        category: oi.menuItem.category?.name || '',
      }
    })
}

// ─── Izračunaj DDV razdelitev za predogled računa (GET) ───
export function buildVatBreakdown(receiptItems: ReceiptItemCalc[]): Record<string, VatBreakdownEntry> {
  const vatBreakdown: Record<string, VatBreakdownEntry> = {}
  for (const item of receiptItems) {
    const rate = String(item.vatRate)
    if (!vatBreakdown[rate]) vatBreakdown[rate] = { base: 0, vat: 0, total: 0 }
    vatBreakdown[rate].base += item.basePrice
    vatBreakdown[rate].vat += item.vatAmount
    vatBreakdown[rate].total += item.totalWithVat
  }
  return vatBreakdown
}

// ─── Izračunaj DDV razdelitev za ustvarjanje računa (POST) s porazdelitvijo popusta ───
// FIX BUG: Porazdeli popust proporcionalno po DDV stopnjah — FURS skladno
export function calculateVatBreakdownForReceipt(
  orderItems: Array<{
    price: DecimalLike
    quantity: number
    vatRate: DecimalLike
    vatAmount: DecimalLike
    voided: boolean
    menuItem: { vatRate: DecimalLike } | null
  }>,
  totalDiscount: number,
): Record<string, { base: number; vat: number }> {
  const vatBreakdown: Record<string, { base: number; vat: number }> = {}
  for (const oi of orderItems.filter(item => !item.voided)) {
    const vatRate = toNum(oi.vatRate) || toNum(oi.menuItem?.vatRate) || 22.0
    const rate = String(vatRate)
    const base = toNum(oi.price) * oi.quantity
    // Uporabi že izračunani vatAmount (ki upošteva popust) če obstaja, sicer izračunaj
    const vat = toNum(oi.vatAmount) > 0 ? toNum(oi.vatAmount) : (base * (vatRate / 100))
    if (!vatBreakdown[rate]) vatBreakdown[rate] = { base: 0, vat: 0 }
    vatBreakdown[rate].base += base
    vatBreakdown[rate].vat += vat
  }

  // Porazdeli popust po DDV stopnjah (proporcionalno)
  if (totalDiscount > 0) {
    const totalBase = Object.values(vatBreakdown).reduce((s, d) => s + d.base, 0)
    let discountDistributed = 0
    for (const [rate, data] of Object.entries(vatBreakdown)) {
      const isLast = rate === Object.keys(vatBreakdown).at(-1)
      let rateDiscount: number
      if (isLast) {
        rateDiscount = Math.round((totalDiscount - discountDistributed) * 100) / 100
      } else if (totalBase > 0) {
        rateDiscount = Math.round((data.base / totalBase) * totalDiscount * 100) / 100
      } else {
        rateDiscount = 0
      }
      discountDistributed += rateDiscount
      data.base -= rateDiscount
      // Preračunaj DDV na novi osnovi
      data.vat = round2(multiply(data.base, divide(Number(rate), 100)))
    }
  }

  return vatBreakdown
}
