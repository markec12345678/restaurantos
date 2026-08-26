// Tipi in konstante za račune

import { type DecimalLike } from '@/lib/decimal'

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

// ─── Tip za order items v buildReceiptItems ───
export interface ReceiptOrderItemInput {
  id: string
  price: DecimalLike
  quantity: number
  vatRate: DecimalLike
  modifiersJson: string | null
  notes: string | null
  voided: boolean
  discountAmount: DecimalLike
  menuItem: { name: string; vatRate: DecimalLike; category: { name: string } | null }
}

// ─── Tip za order items v calculateVatBreakdownForReceipt ───
export interface VatCalcOrderItemInput {
  price: DecimalLike
  quantity: number
  vatRate: DecimalLike
  vatAmount: DecimalLike
  voided: boolean
  menuItem: { vatRate: DecimalLike } | null
}
