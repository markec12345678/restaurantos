// Tip za order podatke za webhooks

export interface OrderWebhookData {
  id: string
  orderNumber: number
  total: number // already toNum'd
  tip: number // already toNum'd
  paymentMethod: string
  paymentStatus: string
  type: string
  status: string
  tableId: string | null
  notes: string
  deliveryInfo: { address: string } | null
  employeeId: string | null
  customerName: string | null
  // R83: tenant kontekst za webhook delivery (per-location matching)
  locationId: string | null
}
