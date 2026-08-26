// ============================================
// FISKALNO — Računi, FURS, EOD (End of Day)
// ============================================

import { z } from 'zod'
import { cuid } from './shared'

// ============================================
// RAČUNI (Receipts)
// ============================================

export const createReceiptSchema = z.object({
  paymentMethod: z.string().max(50).default('gotovina'),
  isStorno: z.boolean().default(false),
  stornoOf: z.string().max(50).default(''),
})

// ============================================
// FURS
// ============================================

export const fursVerifySchema = z.object({
  orderId: cuid,
})

export const fursStornoSchema = z.object({
  orderId: cuid,
  reason: z.string().max(500).optional(),
  reasonCode: z.string().max(50).optional(),
}).refine(data => data.reason || data.reasonCode, {
  message: 'Razlog za storno je obvezen (FURS zahteva)',
})

// ============================================
// EOD (End of Day)
// ============================================

export const eodCloseSchema = z.object({
  date: z.string().min(1, 'Datum je obvezen').max(10)
    .refine(val => /^\d{4}-\d{2}-\d{2}$/.test(val), 'Datum mora biti v formatu YYYY-MM-DD'),
  actualCash: z.number().min(0, 'Dejanska gotovina ne more biti negativna').max(1000000, 'Znesek presega omejitev').optional(),
  closingCash: z.number().min(0).optional(),
  totalTips: z.number().min(0).optional(),
  notes: z.string().max(2000, 'Opombe ne smejo preseči 2000 znakov').default(''),
  locationId: z.string().max(100).optional(),
})
