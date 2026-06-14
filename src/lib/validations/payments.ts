// ============================================
// PLAČILA (Payments) — Ustvarjanje, kartični terminal, odzivi
// ============================================

import { z } from 'zod'
import { cuid } from './shared'

// ============================================
// PLAČILA (Payments)
// ============================================

export const createPaymentSchema = z.object({
  checkId: cuid,
  amount: z.number().positive('Znesek plačila mora biti pozitiven'),
  tipAmount: z.number().min(0).default(0),
  type: z.enum(['cash', 'card', 'mobile', 'voucher', 'loyalty', 'giftcard', 'alternate']),
  alternatePaymentTypeId: z.string().nullable().optional(),
  cardType: z.string().max(30).default(''),
  cardLast4: z.string().max(4).default(''),
  authorizationCode: z.string().max(50).default(''),
  giftCardId: z.string().nullable().optional(),
  loyaltyAccountId: z.string().nullable().optional(),
  loyaltyPointsUsed: z.number().int().min(0).default(0),
  employeeId: z.string().nullable().optional(),
  // FIX HIGH: Idempotency key — prepreči duplikatna plačila ob double-click
  idempotencyKey: z.string().max(100).optional(),
})

// ============================================
// KARTIČNI TERMINAL (Card Terminal) — FIX HIGH: Input validation
// ============================================

export const cardTerminalPaymentSchema = z.object({
  amount: z.number().positive('Znesek mora biti večji od 0').max(100000, 'Znesek ne more preseči 100.000'),
  currency: z.enum(['EUR', 'USD', 'GBP', 'CHF', 'HRK', 'RSD', 'BAM']).default('EUR'),
  orderId: z.string().min(1, 'OrderId je obvezen').max(100),
  orderNumber: z.number().int().min(1).optional(),
  tipAmount: z.number().min(0).max(10000).default(0),
  paymentType: z.enum(['sale', 'refund', 'void', 'preauth', 'capture']).default('sale'),
  referenceId: z.string().max(100).optional(),
})

// ============================================
// ODZIVNE SHEME — Plačila
// ============================================

// ─── Plačilo odziv (POST /api/payments) ───
export const paymentResponseSchema = z.object({
  id: z.string(),
  checkId: z.string(),
  amount: z.number(),
  tipAmount: z.number(),
  type: z.string(),
  status: z.string(),
  giftCardId: z.string().nullable(),
  loyaltyAccountId: z.string().nullable(),
  loyaltyPointsUsed: z.number(),
  employeeId: z.string().nullable(),
  idempotencyKey: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  check: z.object({
    id: z.string(),
    checkNumber: z.number().nullable(),
    orderId: z.string().nullable(),
  }).nullable().optional(),
  alternatePaymentType: z.unknown().nullable().optional(),
  giftCard: z.unknown().nullable().optional(),
  loyaltyAccount: z.unknown().nullable().optional(),
})

// ─── Plačila seznam odziv (GET /api/payments) ───
export const paymentsListResponseSchema = z.object({
  payments: z.array(z.unknown()),
  total: z.number(),
  limit: z.number(),
  offset: z.number(),
})
