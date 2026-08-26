// Delivery tracker constants and types

export interface DeliveryTrackingData {
  id: string
  deliveryInfoId: string
  status: string
  driverName?: string
  driverPhone?: string
  vehicleInfo?: string
  assignedAt?: string
  deliveredAt?: string
  [key: string]: unknown
}

export const STATUS_FLOW = ['pending', 'assigned', 'picked_up', 'on_the_way', 'delivered'] as const
