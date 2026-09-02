// ============================================
// NAROČILA (Orders) — Ustvarjanje, posodabljanje, čeki, KDS
// ============================================

import { z } from 'zod'
import { cuid, positiveNumber } from './shared'

// ============================================
// NAROČILA (Orders)
// ============================================

export const createOrderItemSchema = z.object({
  menuItemId: cuid,
  quantity: z.number().int().min(1, 'Količina mora biti vsaj 1').max(99, 'Količina ne more preseči 99'),
  price: positiveNumber.optional(), // FIX HIGH: Price je opcijski — strežnik uporabi ceno iz baze (edini vir resnice)
  notes: z.string().max(500, 'Opombe ne smejo preseči 500 znakov').default(''),
  modifiersJson: z.string().default('[]').refine(val => {
    try { JSON.parse(val); return true } catch { return false }
  }, 'modifiersJson mora biti veljaven JSON'),
})

export const createOrderSchema = z.object({
  type: z.enum(['dine-in', 'takeout', 'delivery']).default('dine-in'),
  tableId: z.string().nullable().optional(),
  diningOptionId: z.string().nullable().optional(),
  revenueCenterId: z.string().nullable().optional(),
  customerName: z.string().max(100).default(''),
  customerPhone: z.string().max(30).default(''),
  customerEmail: z.string().max(200).default(''), // FIX MEDIUM: Manjkajoče polje za e-pošto stranke
  notes: z.string().max(1000).default(''),
  employeeId: z.string().nullable().optional(),
  discount: z.number().min(0).max(100000, 'Popust ne more preseči 100.000').default(0),
  tip: z.number().min(0).max(100000, 'Napitnina ne more preseči 100.000').default(0),
  orderItems: z.array(createOrderItemSchema).min(1, 'Naročilo mora vsebovati vsaj en artikel'),
  // FIX CRITICAL (Test 3.2): Idempotency key za preprečevanje duplikatov pri offline/retry
  // Scenarij: natakar naroči artikel, network pade, React Query retry-a request.
  // Brez idempotencyKey se ustvari duplikat. Z idempotencyKey dobimo isti Order ID.
  idempotencyKey: z.string().max(100).optional(),
})

export const updateOrderSchema = z.object({
  status: z.enum(['pending', 'in-progress', 'ready', 'completed', 'cancelled']).optional(),
  paymentStatus: z.enum(['unpaid', 'partial', 'paid', 'storno']).optional(), // FIX BUG 17: Dodan 'storno'
  paymentMethod: z.string().max(50).optional(),
  notes: z.string().max(1000).optional(),
  customerName: z.string().max(100).optional(),
  customerPhone: z.string().max(30).optional(),
  cancelReason: z.string().max(500).optional(),
  cancelledBy: z.string().max(100).optional(),
  // FIX: Allow tip and totalWithTip from PaymentDialog (set during payment processing)
  tip: z.number().min(0).optional(),
  totalWithTip: z.number().min(0).optional(),
  // FIX Test 9.2: Dodan discount in appliedDiscountId za aplikacijo popusta na obstoječe naročilo
  discount: z.number().min(0).optional(),
  appliedDiscountId: z.string().nullable().optional(),
})

export const addOrderItemsSchema = z.object({
  orderItems: z.array(createOrderItemSchema).min(1, 'Dodajte vsaj en artikel'),
})

// ============================================
// ČEKI (Checks)
// ============================================

export const createCheckSchema = z.object({
  orderId: cuid,
  orderItemIds: z.array(cuid).optional(), // ID-ji OrderItem-ov za ta ček
  appliedDiscountId: z.string().nullable().optional(),
  // Zneski se izračunajo strežniško iz povezanih OrderItem-ov
})

export const updateCheckSchema = z.object({
  paymentStatus: z.enum(['unpaid', 'partial', 'paid', 'storno']).optional(), // FIX BUG 17: Dodan 'storno'
  paymentMethod: z.string().max(50).optional(),
  appliedDiscountId: z.string().nullable().optional(),
  // Ostali zneski se izračunajo strežniško
})

// ============================================
// ORDER ITEM UPDATE
// ============================================

export const updateOrderItemSchema = z.object({
  status: z.enum(['pending', 'fired', 'preparing', 'ready', 'served', 'voided', 'cancelled']).optional(),
  notes: z.string().max(500).optional(),
  voided: z.boolean().optional(),
  voidReasonId: z.string().nullable().optional(),
  voidReasonText: z.string().max(200).optional(),
})

// ============================================
// ORDER PATCH ACTIONS (KDS)
// ============================================

export const orderPatchActionSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('item_status'),
    itemId: z.string().min(1, 'ID artikla je obvezen'),
    status: z.enum(['pending', 'fired', 'preparing', 'ready', 'served', 'cancelled']),
  }),
  z.object({
    action: z.literal('fire'),
  }),
])
