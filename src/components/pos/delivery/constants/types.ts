// --- TIPI ---

export interface DeliveryInfoData {
  id: string
  address: string
  city: string
  postCode: string
  recipientName: string
  recipientPhone: string
  deliveryInstructions: string
  promisedTime: string | null
  estimatedTime: string | null
  actualTime: string | null
  courierName: string
  courierPhone: string
  status: string
  packagingFee: number
  deliveryFee: number
  latitude: number | null
  longitude: number | null
  order?: { id: string; orderNumber: number; customerName: string; total: number } | null
  createdAt: string
}

export interface OnlineOrder {
  id: string
  orderNumber: number
  type: string
  status: string
  customerName: string
  customerPhone: string
  customerEmail: string
  subtotal: number
  tax: number
  discount: number
  total: number
  paymentMethod: string
  paymentStatus: string
  notes: string
  createdAt: string
  orderItems: Array<{ id: string; menuItemId: string; quantity: number; price: number; notes: string }>
}

export interface DeliveryFormData {
  address: string
  city: string
  postCode: string
  recipientName: string
  recipientPhone: string
  deliveryInstructions: string
  courierName: string
  courierPhone: string
  status: string
  packagingFee: string
  deliveryFee: string
}

// --- PROPS INTERFACI ZA POD-KOMPONENTE ---

export interface DeliveryCardProps {
  delivery: DeliveryInfoData
  onAdvanceStatus: (_d: DeliveryInfoData) => void
  onEdit: (_d: DeliveryInfoData) => void
}

export interface CompletedDeliveryCardProps {
  delivery: DeliveryInfoData
}

export interface DeliveryEditDialogProps {
  open: boolean
  onOpenChange: (_open: boolean) => void
  formData: DeliveryFormData
  onFormDataChange: (_data: DeliveryFormData) => void
  onUpdate: () => void
  isPending: boolean
}

export interface OnlineOrderCardProps {
  order: OnlineOrder
  onNextStatus: (_id: string, _status: string) => void
  onShowDetail: (_order: OnlineOrder) => void
}

export interface OnlineOrderDetailDialogProps {
  open: boolean
  onOpenChange: (_open: boolean) => void
  order: OnlineOrder | null
}
