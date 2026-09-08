// Wolt webhook — Konstante, tipi in Zod shema

import { z } from 'zod'
import { wsBroadcastEvent } from '@/lib/ws-server-broadcast'

// ---- Constants ----

export const WOLT_SIGNATURE_HEADER = 'x-wolt-signature'

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

export const woltOrderSchema = z.object({
  order_id: z.string(),
  order_number: z.string().optional(),
  status: z.string().default('pending'),
  pickup: z.object({
    location: z.object({ formatted_address: z.string() }).optional(),
  }).optional(),
  delivery: z.object({
    location: z.object({ formatted_address: z.string() }),
    recipient: z.object({ name: z.string(), phone: z.string().optional() }).optional(),
    comment: z.string().optional(),
  }).optional(),
  items: z.array(z.object({
    item_id: z.string(),
    name: z.string(),
    count: z.number().min(1),
    unit_price: z.number().optional(),
    options: z.array(z.object({ id: z.string().optional(), name: z.string().optional() })).optional(),
  })).min(1),
  payment: z.object({ method: z.string().optional(), total: z.number().optional() }).optional(),
  notes: z.string().optional(),
})

// ---- WebSocket Broadcast ----
// WS AUDIT 2026-09-09: prej HTTP fetch na /api/ws-broadcast (401 — brez
// Authorization glave). Zdaj: direkten globalThis.__wsBroadcast klic.
export function broadcastWS(type: string, payload: unknown) {
  wsBroadcastEvent(type, (payload ?? null) as Record<string, unknown> | null)
}
