// Glovo Product Mapping — mapiranje Glovo izdelkov na interne menijske artikle

import { db } from '@/lib/db'
import { toNum, calcVat } from '@/lib/decimal'
import type { Prisma } from '@prisma/client'
import { z } from 'zod'
import { glovoOrderSchema } from './glovo-schema'
import type { WebhookOrderItem } from './glovo-schema'

// FIX R112 (WEBHOOK-3, MED): lookup je bil NESCOPECAN
// (findFirst isAvailable + OR[id, name] brez lokacije) → artikel TUJEGA
// tenanta se je lahko ujemale po imenu/ID (napačna cena/DDV). Sedaj je
// locationId OBVEZEN parameter in lookup je scoped prek MODEL A verige
// category → menu → locationId. Tx-fresh (klicatelj poda tx klienta).
export async function mapGlovoProductsToOrderItems(
  products: z.infer<typeof glovoOrderSchema>['products'],
  locationId: string,
  client: Prisma.TransactionClient = db,
): Promise<WebhookOrderItem[]> {
  const orderItems: WebhookOrderItem[] = []
  for (const product of products) {
    const menuItem = await client.menuItem.findFirst({
      where: {
        isAvailable: true,
        category: { menu: { locationId } },
        OR: [{ id: product.product_id }, { name: product.name }],
      },
    })
    if (menuItem) {
      orderItems.push({
        menuItemId: menuItem.id,
        quantity: product.quantity,
        price: toNum(menuItem.price),
        vatRate: toNum(menuItem.vatRate),
        vatAmount: calcVat(toNum(menuItem.price), menuItem.vatRate),
        discountAmount: 0,
        notes: product.description || '',
        status: 'pending' as const,
      })
    }
  }
  return orderItems
}
