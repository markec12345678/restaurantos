// Pomožne funkcije za online naročila — Ustvarjanje dostavne informacije

import { db } from '@/lib/db'

export async function createDeliveryInfo(
  tx: Parameters<Parameters<typeof db.$transaction>[0]>[0],
  customer: Record<string, unknown>,
  actualDeliveryFee: number,
): Promise<string | undefined> {
  if (!('address' in customer)) return undefined

  const deliveryInfo = await tx.deliveryInfo.create({
    data: {
      address: customer.address as string,
      city: customer.city as string,
      postCode: customer.postCode as string,
      recipientName: customer.fullName as string,
      recipientPhone: customer.phone as string,
      deliveryInstructions: (customer.notes as string) || '',
      status: 'pending',
      deliveryFee: actualDeliveryFee,
      estimatedTime: new Date(Date.now() + 30 * 60 * 1000), // 30 min od zdaj
    },
  })
  return deliveryInfo.id
}
