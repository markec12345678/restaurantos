// ============================================
// WEBHOOK ENGINE — Test webhook
// Pošiljanje testnega webhooka na podan URL
// ============================================

import crypto from 'crypto'
import { signPayload } from './signing'
import { deliverWebhook } from './delivery'
import { type WebhookEventType, type WebhookPayload, type DeliveryResult } from './types'

/**
 * Pošlji testni webhook na podan URL
 */
export async function testWebhookDelivery(
  url: string,
  secret: string
): Promise<DeliveryResult & { deliveryId?: string }> {
  const testPayload: WebhookPayload = {
    id: crypto.randomUUID(),
    event: 'order.created' as WebhookEventType, // Testni dogodek
    timestamp: new Date().toISOString(),
    data: { message: 'Testni webhook iz RestaurantOS', version: '1.0' },
  }

  const payloadStr = JSON.stringify(testPayload)
  const signature = signPayload(payloadStr, secret)

  const result = await deliverWebhook(url, payloadStr, signature, secret)

  return result
}
