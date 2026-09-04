// ============================================
// BOLT WEBHOOK HELPERS — Schema, mapping, utilities
// Bolt Food delivery platform (popular in Slovenia/Croatia/Baltics)
// ============================================

import { z } from 'zod'

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

    const optionsJson = JSON.stringify(
      item.options.map(opt => ({ name: opt.name, price: opt.price }))
    )

    return {
      menuItemId: menuItem?.id || menuItems[0]?.id || '',
      menuItemName: item.name,
      quantity: item.quantity,
      price: menuItem ? Number(menuItem.price) : item.price,
      vatRate: menuItem ? Number(menuItem.vatRate) : 22.0,
      notes: item.notes || '',
      modifiersJson: optionsJson,
      sortOrder: idx,
    }
  })
}

// Preveri ali Bolt naročilo že obstaja (idempotentnost)
export async function findExistingBoltOrder(boltOrderId: string) {
  const { db } = await import('@/lib/db')
  return db.order.findFirst({
    where: {
      customerName: { contains: `Bolt:${boltOrderId}` },
    },
    select: { id: true, orderNumber: true, status: true },
  })
}
