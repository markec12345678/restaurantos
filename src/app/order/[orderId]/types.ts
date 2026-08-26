// =====================================================================
// RESTAURANTOS ORDER TRACKING — Types
// =====================================================================

export interface TimelineStep {
  status: string
  label: string
  time?: string
  completed: boolean
}

export interface TrackingData {
  order: {
    id: string
    orderNumber: string
    status: string
    type: string
    customerName: string
    subtotal: number
    tax: number
    total: number
    createdAt: string
    items: Array<{ name: string; quantity: number; notes: string }>
    delivery: {
      address: string
      city: string
      estimatedTime?: string
      status: string
    } | null
  }
  timeline: TimelineStep[]
  estimatedMinutes: number
}
