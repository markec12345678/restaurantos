// ============================================
// DOSTAVNI SISTEM — Skupne konstante in tipi
// ============================================

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

// --- STATUSNE MAPE ---

export const statusLabels: Record<string, string> = {
  pending: '\u010Caka',
  preparing: 'V pripravi',
  ready: 'Pripravljeno',
  picked_up: 'Prevzeto',
  delivered: 'Dostavljeno',
  failed: 'Neuspe\u0161no',
}

export const statusColors: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  preparing: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  ready: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  picked_up: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
  delivered: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400',
  failed: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
}

export const onlineStatusLabels: Record<string, string> = {
  pending: '\u010Caka',
  confirmed: 'Potrjeno',
  'in-progress': 'V pripravi',
  ready: 'Pripravljeno',
  completed: 'Zaklju\u010Deno',
  cancelled: 'Preklicano',
}

export const onlineStatusColors: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  confirmed: 'bg-blue-100 text-blue-800',
  'in-progress': 'bg-orange-100 text-orange-800',
  ready: 'bg-green-100 text-green-800',
  completed: 'bg-gray-100 text-gray-600',
  cancelled: 'bg-red-100 text-red-800',
}

// --- POMOŽNE FUNKCIJE ---

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
