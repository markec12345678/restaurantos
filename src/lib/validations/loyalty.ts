// ============================================
// ZVESTOBA IN DARILNE KARTICE — Loyalty, gift cards, popusti
// ============================================

import { z } from 'zod'

// ============================================
// DARILNE KARTICE
// ============================================

export const createGiftCardSchema = z.object({
  cardNumber: z.string().min(1, 'Številka kartice je obvezna').max(50),
  balance: z.number().min(0).default(0),
  initialBalance: z.number().min(0).optional(),
  status: z.enum(['active', 'depleted', 'expired', 'suspended']).default('active'),
  ownerName: z.string().max(100).default(''),
  expiresAt: z.string().nullable().optional(),
})

export const updateGiftCardSchema = z.object({
  balance: z.number().min(0).optional(),
  status: z.enum(['active', 'depleted', 'expired', 'suspended']).optional(),
  ownerName: z.string().max(100).optional(),
  expiresAt: z.string().nullable().optional(),
  transaction: z.object({
    type: z.enum(['load', 'redeem', 'adjust', 'transfer']),
    amount: z.number().positive('Znesek transakcije mora biti pozitiven'),
    balanceAfter: z.number().optional(),
    orderId: z.string().nullable().optional(),
    checkId: z.string().nullable().optional(),
    note: z.string().default(''),
  }).optional(),
})

// ============================================
// ZVESTOBNI RAČUNI
// ============================================

export const createLoyaltySchema = z.object({
  customerName: z.string().max(100).default(''),
  customerPhone: z.string().max(30).default(''),
  customerEmail: z.string().email().optional().or(z.literal('')),
  // FIX MEDIUM: pointsBalance in lifetimePoints se nastavijo strežniško na 0
  // Klient NE sme nastavljati začetnih točk — točke se pridobijo samo skozi loyalty earn API
  isActive: z.boolean().default(true),
})

export const updateLoyaltySchema = z.object({
  customerName: z.string().max(100).optional(),
  customerPhone: z.string().max(30).optional(),
  customerEmail: z.string().email().optional().or(z.literal('')).optional(),
  pointsBalance: z.number().int().min(0).optional(),
  lifetimePoints: z.number().int().min(0).optional(),
  tier: z.enum(['bronze', 'silver', 'gold', 'platinum']).optional(),
  isActive: z.boolean().optional(),
  transaction: z.object({
    type: z.enum(['earn', 'redeem', 'adjust', 'expire']),
    points: z.number().int(),
    reason: z.string().default(''),
    orderId: z.string().nullable().optional(),
    checkId: z.string().nullable().optional(),
    monetaryValue: z.number().min(0).default(0),
  }).optional(),
})

// ============================================
// POPUSTI (Discounts)
// ============================================

export const createDiscountSchema = z.object({
  name: z.string().min(1, 'Ime je obvezno').max(200),
  type: z.enum(['percentage', 'fixed_amount', 'buy_x_get_y']),
  amount: z.number().min(0.01, 'Znesek mora biti pozitiven'),
  appliesTo: z.enum(['check', 'item', 'category']).default('check'),
  triggerType: z.enum(['manual', 'auto', 'promo_code']).default('manual'),
  promoCode: z.string().max(50).default(''),
  maxUses: z.number().int().min(0).nullable().optional(),
  validFrom: z.string().nullable().optional(),
  validTo: z.string().nullable().optional(),
  isActive: z.boolean().default(true),
}).refine(data => {
  // FIX BUG-8: Odstotkov popust ne sme biti > 100%
  if (data.type === 'percentage' && data.amount > 100) {
    return false
  }
  return true
}, { message: 'Odstotek popusta ne sme preseči 100%', path: ['amount'] })
