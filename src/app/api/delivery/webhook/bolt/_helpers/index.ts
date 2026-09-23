// ============================================
// BOLT WEBHOOK HELPERS — Schema, mapping, utilities
// Bolt Food delivery platform (popular in Slovenia/Croatia/Baltics)
// ============================================

import { z } from 'zod'
import type { Prisma } from '@prisma/client'

// Bolt signature header name
export const BOLT_SIGNATURE_HEADER = 'x-bolt-signature'

// Bolt order schema — validacija vhodnega webhook payload-a
export const boltOrderSchema = z.object({
  order_id: z.string().min(1, 'Bolt order ID je obvezen'),
  status: z.string().default('pending'),
  created_at: z.string().optional(),
  pickup_time: z.string().optional(),

  // Stranka
  customer: z.object({
    name: z.string().default('Bolt stranka'),
    phone: z.string().default(''),
  }).default({ name: 'Bolt stranka', phone: '' }),

  // Dostava
  delivery_address: z.string().default(''),
  delivery_notes: z.string().default(''),
  delivery_fee: z.number().min(0).default(0),

  // Artikli
  items: z.array(z.object({
    id: z.string(),
    name: z.string(),
    quantity: z.number().int().min(1),
    price: z.number().min(0), // cena v centih ali EUR (odvisno od Bolt API)
    notes: z.string().default(''),
    options: z.array(z.object({
      id: z.string().optional(),
      name: z.string(),
      price: z.number().min(0).default(0),
    })).default([]),
  })).min(1, 'Naročilo mora vsebovati vsaj en artikel'),

  // Skupni znesek
  total_price: z.number().min(0),
  currency: z.string().default('EUR'),
})

export type BoltOrderPayload = z.infer<typeof boltOrderSchema>

// Map Bolt artikli v RestaurantOS OrderItem
// FIX R112 (WEBHOOK-3, MED): klicatelj podaja SAMO lokacijsko-scoped seznam
// artiklov (category → menu → locationId veriga, glej bolt/route.ts) — prej
// je bila preslikava pognana nad globalnim seznamom VSEH artiklov in je
// lahko zadela artikel TUJEGA tenanta (napačna cena/DDV).
export function mapBoltItemsToOrderItems(
  items: BoltOrderPayload['items'],
  menuItems: Array<{ id: string; name: string; price: unknown; vatRate: unknown }>
) {
  return items.map((item, idx) => {
    // Poskusi najdi artikel po imenu (Bolt pošlja ime, ne ID-ja iz našega sistema)
    const menuItem = menuItems.find(mi =>
      mi.name.toLowerCase().includes(item.name.toLowerCase()) ||
      item.name.toLowerCase().includes(mi.name.toLowerCase())
    )

    // FIX R112 (WEBHOOK-4, MED): brez ujemanja zavrnemo — NI vec fallbacka na
    // menuItems[0] (prvi artikel katerega koli tenanta) in NI zaupanja wire
    // ceni iz Bolt payloada. Strukturirana 400 'Neznana pozicija' z imenom
    // artikla (isti { error, status } kontrakt kot structuredErrorResponse);
    // cena/DDV prihajajo izključno iz lokacijsko-scoped baze (WEBHOOK-3).
    if (!menuItem) {
      throw { error: `Neznana pozicija: ${item.name}`, status: 400 }
    }

    const optionsJson = JSON.stringify(
      item.options.map(opt => ({ name: opt.name, price: opt.price }))
    )

    return {
      menuItemId: menuItem.id,
      menuItemName: item.name,
      quantity: item.quantity,
      price: Number(menuItem.price),
      vatRate: Number(menuItem.vatRate),
      notes: item.notes || '',
      modifiersJson: optionsJson,
      sortOrder: idx,
    }
  })
}

// Preveri ali Bolt naročilo že obstaja (idempotentnost)
// FIX R112 (WEBHOOK-1, MED-HIGH): opcionalen tx klient — AVTORITATIVNA dedup
// preverba teče tx-fresh ZNOTRAJ transakcije pod advisory lock-om
// 'delivery-webhook:{integrationId}:{boltOrderId}' (glej bolt/route.ts);
// brez klienta ostane hitri pregled nad db (samo fast-path, ni vezava).
export async function findExistingBoltOrder(
  boltOrderId: string,
  client?: Prisma.TransactionClient,
) {
  const { db } = await import('@/lib/db')
  return (client ?? db).order.findFirst({
    where: {
      customerName: { contains: `Bolt:${boltOrderId}` },
    },
    select: { id: true, orderNumber: true, status: true },
  })
}
