// --- POMOŽNE FUNKCIJE ---

import type { DeliveryInfoData, DeliveryFormData } from './types'

export const getNextOnlineStatus = (current: string): string | undefined => {
  const flow: Record<string, string> = {
    pending: 'confirmed',
    confirmed: 'in-progress',
    'in-progress': 'ready',
    ready: 'completed',
  }
  return flow[current]
}

export const getNextDeliveryStatus = (current: string): string | undefined => {
  const flow: Record<string, string> = {
    pending: 'preparing',
    preparing: 'ready',
    ready: 'picked_up',
    picked_up: 'delivered',
  }
  return flow[current]
}

export const deliveryAdvanceLabel = (status: string): string => {
  const labels: Record<string, string> = {
    pending: 'Pripravi',
    preparing: 'Pripravljeno',
    ready: 'Prevzeto',
    picked_up: 'Dostavljeno',
  }
  return labels[status] || 'Naprej'
}

export const onlineAdvanceLabel = (status: string): string => {
  const labels: Record<string, string> = {
    pending: 'Potrdi',
    confirmed: 'Za\u010Dni pripravo',
    'in-progress': 'Pripravljeno',
    ready: 'Zaklju\u010Di',
  }
  return labels[status] || 'Naprej'
}

export const emptyFormData: DeliveryFormData = {
  address: '',
  city: '',
  postCode: '',
  recipientName: '',
  recipientPhone: '',
  deliveryInstructions: '',
  courierName: '',
  courierPhone: '',
  status: 'pending',
  packagingFee: '0',
  deliveryFee: '0',
}

export const deliveryToFormData = (d: DeliveryInfoData): DeliveryFormData => ({
  address: d.address,
  city: d.city,
  postCode: d.postCode,
  recipientName: d.recipientName,
  recipientPhone: d.recipientPhone,
  deliveryInstructions: d.deliveryInstructions,
  courierName: d.courierName,
  courierPhone: d.courierPhone,
  status: d.status,
  packagingFee: String(d.packagingFee),
  deliveryFee: String(d.deliveryFee),
})
