// ═══════════════════════════════════════════════════════════════
// RestaurantOS — Delivery Tracker skupne tipi, konstante
// ═══════════════════════════════════════════════════════════════

import type { LucideIcon } from 'lucide-react'
import { User, Package, Truck, Navigation, CheckCircle2, AlertTriangle } from 'lucide-react'

export interface DeliveryTrackingData {
  id: string
  deliveryInfoId: string
  driverName: string
  driverPhone: string
  vehicleInfo: string
  currentLat: number | null
  currentLng: number | null
  lastUpdateAt: string | null
  status: string
  estimatedArrival: string | null
  assignedAt: string | null
  pickedUpAt: string | null
  onTheWayAt: string | null
  deliveredAt: string | null
  customerRating: number | null
  customerFeedback: string
  deliveryInfo?: {
    id: string
    address: string
    city: string
    postCode: string
    recipientName: string
    recipientPhone: string
    deliveryInstructions: string
    status: string
    order?: {
      id: string
      orderNumber: number
      total: number
      type: string
      orderItems: { id: string; menuItem: { name: string }; quantity: number }[]
    }
  }
}

export const STATUS_CONFIG: Record<string, { label: string; color: string; icon: LucideIcon; step: number }> = {
  assigned: { label: 'Dodeljeno', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400', icon: User, step: 1 },
  picked_up: { label: 'Prevzeto', color: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400', icon: Package, step: 2 },
  on_the_way: { label: 'Na poti', color: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400', icon: Truck, step: 3 },
  arriving: { label: 'Prihaja', color: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400', icon: Navigation, step: 4 },
  delivered: { label: 'Dostavljeno', color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400', icon: CheckCircle2, step: 5 },
  failed: { label: 'Neuspelo', color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400', icon: AlertTriangle, step: 0 },
}

export const STATUS_FLOW = ['assigned', 'picked_up', 'on_the_way', 'arriving', 'delivered'] as const

export interface DeliveryStatsCardsProps {
  activeCount: number
  deliveredCount: number
  avgDeliveryTime: string
}

export interface DeliveryCardProps {
  tracking: DeliveryTrackingData
  nextStatus: string | null
  onUpdateStatus: (_params: { deliveryInfoId: string; status: string }) => void
  isStatusUpdatePending: boolean
}

export interface AssignDriverDialogProps {
  open: boolean
  onOpenChange: (_open: boolean) => void
  driverName: string
  onDriverNameChange: (_value: string) => void
  driverPhone: string
  onDriverPhoneChange: (_value: string) => void
  vehicleInfo: string
  onVehicleInfoChange: (_value: string) => void
  isPending: boolean
  onAssign: () => void
}
