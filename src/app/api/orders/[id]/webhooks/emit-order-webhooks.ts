// Webhook emissions za naročila

import { emitEvent } from '@/lib/event-emitter'
import { logger } from '@/lib/logger'
import type { OrderWebhookData } from './types'

// Oddaj webhooks glede na spremembo statusa/plačila
export async function emitOrderWebhooks(
  id: string,
  existingOrder: OrderWebhookData,
  data: {
    status?: string
    paymentStatus?: string
    paymentMethod?: string
  },
) {
  // Webhook: order.paid — ko postane plačano
  if (data.paymentStatus === 'paid' && existingOrder.paymentStatus !== 'paid') {
    emitEvent('order.paid', {
      orderId: id, orderNumber: existingOrder.orderNumber,
      total: existingOrder.total,
      paymentMethod: data.paymentMethod || existingOrder.paymentMethod,
      tip: existingOrder.tip,
    }).catch(err => logger.error('API', '[Webhook] order.paid napaka:', err))
  }

  // Webhook: order.ready — ko postane pripravljeno
  if (data.status === 'ready' && existingOrder.status !== 'ready') {
    emitEvent('order.ready', {
      orderId: id, orderNumber: existingOrder.orderNumber,
    }).catch(err => logger.error('API', '[Webhook] order.ready napaka:', err))
  }

  // Webhook: order.delivered — ko je dostavljeno
  if (data.status === 'completed' && existingOrder.type === 'delivery') {
    const deliveryAddress = existingOrder.deliveryInfo?.address || existingOrder.notes || ''
    emitEvent('order.delivered', {
      orderId: id, orderNumber: existingOrder.orderNumber, deliveryAddress,
    }).catch(err => logger.error('API', '[Webhook] order.delivered napaka:', err))
  }

  // Webhook: order.updated — splošna posodobitev
  if (data.status && data.status !== 'cancelled') {
    emitEvent('order.updated', {
      orderId: id, changes: Object.keys(data), status: data.status,
    }).catch(err => logger.error('API', '[Webhook] order.updated napaka:', err))
  }
}
