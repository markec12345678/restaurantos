// Glovo Product Mapping — mapiranje Glovo izdelkov na interne menijske artikle

import { db } from '@/lib/db'
import { toNum, calcVat } from '@/lib/decimal'
import { z } from 'zod'
import { glovoOrderSchema } from './glovo-schema'
import type { WebhookOrderItem } from './glovo-schema'

export async function mapGlovoProductsToOrderItems(
  products: z.infer<typeof glovoOrderSchema>['products']
): Promise<WebhookOrderItem[]> {
  const orderItems: WebhookOrderItem[] = []
  for (const product of products) {
    const menuItem = await db.menuItem.findFirst({
      where: { isAvailable: true, OR: [{ id: product.product_id }, { name: product.name }] },
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
