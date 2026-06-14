// ============================================
// ODZIVNE SHEME — Računi (Receipts)
// Varnostna validacija odzivov za račun API rute
// ============================================

import { z } from 'zod'

// ─── Račun odziv (GET /api/receipts/[id]) ───
export const receiptResponseSchema = z.object({
  receiptNumber: z.string(),
  receiptDate: z.string(),
  registerId: z.string(),
  businessName: z.string(),
  businessAddress: z.string(),
  businessId: z.string(),
  taxId: z.string(),
  zoi: z.string(),
  eor: z.string(),
  fiscalVerified: z.boolean(),
  orderNumber: z.number(),
  type: z.string(),
  status: z.string(),
  paymentStatus: z.string(),
  paymentMethod: z.string().nullable(),
  customerName: z.string().nullable(),
  table: z.object({ number: z.number(), area: z.string() }).nullable(),
  notes: z.string().nullable(),
  items: z.array(z.object({
    id: z.string(),
    name: z.string(),
    quantity: z.number(),
    unitPrice: z.number(),
    vatRate: z.number(),
    basePrice: z.number(),
    vatAmount: z.number(),
    totalWithVat: z.number(),
    modifiers: z.array(z.unknown()),
    notes: z.string().nullable(),
    category: z.string(),
  })),
  subtotal: z.number(),
  vatBreakdown: z.record(z.string(), z.object({ base: z.number(), vat: z.number(), total: z.number() })),
  totalVat: z.number(),
  discount: z.number(),
  total: z.number(),
  tip: z.number(),
  totalWithTip: z.number(),
  receiptFooter: z.string(),
  isCopy: z.boolean(),
  isStorno: z.boolean(),
  stornoOf: z.string(),
})

// ─── Račun ustvarjen odziv (POST /api/receipts/[id]) ───
export const receiptCreatedResponseSchema = z.object({
  id: z.string(),
  receiptNumber: z.string(),
  orderId: z.string(),
  businessName: z.string(),
  total: z.number(),
  tip: z.number(),
  totalWithTip: z.number(),
  fiscalVerified: z.boolean(),
  isStorno: z.boolean(),
  createdAt: z.string(),
})
