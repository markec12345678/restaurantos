// Glovo Zod Schema + Tipi + Konstante

import { z } from 'zod'

// ---- Constants ----
export const GLOVO_SIGNATURE_HEADER = 'x-glovo-signature'

// ---- Types ----
export interface WebhookOrderItem {
  menuItemId: string
  quantity: number
  price: number
  vatRate: number
  vatAmount: number
  discountAmount: number
  notes: string
  status: string
}

// ---- Zod Schema ----
export const glovoOrderSchema = z.object({
  order_id: z.string(),
  store_id: z.string().optional(),
  status: z.string().default('pending'),
  delivery_address: z.object({
    street: z.string().optional(),
    city: z.string().optional(),
    lat: z.number().optional(),
    lng: z.number().optional(),
    details: z.string().optional(),
  }).optional(),
  customer: z.object({
    name: z.string().optional(),
    phone: z.string().optional(),
  }).optional(),
  products: z.array(z.object({
    product_id: z.string(),
    name: z.string(),
    quantity: z.number().min(1),
    price: z.number().optional(),
    description: z.string().optional(),
  })).min(1),
  payment: z.object({
    method: z.string().optional(),
    amount: z.number().optional(),
  }).optional(),
  comment: z.string().optional(),
})
