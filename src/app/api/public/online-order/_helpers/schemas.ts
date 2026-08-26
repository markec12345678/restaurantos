// Pomožne funkcije za online naročila — Sheme in konstante

import { z } from 'zod'

// ─── Sheme za validacijo ───
export const onlineOrderItemSchema = z.object({
  menuItemId: z.string().min(1),
  quantity: z.number().int().min(1).max(20),
  // FIX BUG-06: price in vatRate se IGNORIRAJO — strežnik uporabi ceno iz baze
  notes: z.string().max(500).default(''),
  modifiersJson: z.string().max(2000).default('[]'),
})

export const deliveryDetailsSchema = z.object({
  fullName: z.string().min(1, 'Ime je obvezno').max(100),
  phone: z.string().min(1, 'Telefon je obvezen').max(30),
  email: z.string().max(200).default(''),
  address: z.string().min(1, 'Naslov je obvezen').max(300),
  city: z.string().min(1, 'Mesto je obvezno').max(100),
  postCode: z.string().min(1, 'Poštna številka je obvezna').max(20),
  notes: z.string().max(1000).default(''),
  type: z.literal('delivery'),
})

export const takeoutDetailsSchema = z.object({
  fullName: z.string().min(1, 'Ime je obvezno').max(100),
  phone: z.string().min(1, 'Telefon je obvezen').max(30),
  email: z.string().max(200).default(''),
  notes: z.string().max(1000).default(''),
  preferredTime: z.string().max(10).default(''),
  type: z.literal('takeout'),
})

export const onlineOrderSchema = z.object({
  orderType: z.enum(['delivery', 'takeout']),
  items: z.array(onlineOrderItemSchema).min(1, 'Naročilo mora vsebovati vsaj en artikel').max(30),
  paymentMethod: z.enum(['card', 'cash', 'mobile']).default('card'),
  customer: z.union([deliveryDetailsSchema, takeoutDetailsSchema]),
  // FIX Q02 CRITICAL: deliveryFee ODSTRANJEN iz klientne sheme — strežnik izračuna iz cone dostave
  promoCode: z.string().max(50).optional(),
  locationId: z.string().optional(),
})

// ─── Konstante ───
export const DELIVERY_FEE = 2.50
export const DELIVERY_FEE_VAT_RATE = 22 // Slovenian standard VAT rate for delivery fees (EU/SI requirement)
export const MIN_ORDER_AMOUNT = 10.00
