'use client'

// ═══════════════════════════════════════════════════════════════
// RestaurantOS — Sledenje naročila za stranke
// Domino's Pizza Tracker standard
// Real-time status: Prejeto → V pripravi → V peči → Pripravljeno → Na poti → Dostavljeno
// ═══════════════════════════════════════════════════════════════

import dynamic from 'next/dynamic'
import { useParams } from 'next/navigation'
import { useOrderStatus } from './use-order-status'

// Leno nalaganje podkomponent (ssr: false za client-only interaktivnost)
const LoadingState = dynamic(
  () => import('./components/LoadingState').then((m) => m.LoadingState),
  { ssr: false }
)
const ErrorState = dynamic(
  () => import('./components/ErrorState').then((m) => m.ErrorState),
  { ssr: false }
)
const OrderHeader = dynamic(
  () => import('./components/OrderHeader').then((m) => m.OrderHeader),
  { ssr: false }
)
const OrderInfoCard = dynamic(
  () => import('./components/OrderInfoCard').then((m) => m.OrderInfoCard),
  { ssr: false }
)
const ProgressTracker = dynamic(
  () => import('./components/ProgressTracker').then((m) => m.ProgressTracker),
  { ssr: false }
)
const OrderItemsList = dynamic(
  () => import('./components/OrderItemsList').then((m) => m.OrderItemsList),
  { ssr: false }
)

export default function OrderStatusPage() {
  const params = useParams()
  const orderId = params?.orderId as string
  const { order, loading, error, lastRefresh, fetchOrder } = useOrderStatus(orderId)

  if (loading) {
    return <LoadingState />
  }

  if (error || !order) {
    return <ErrorState error={error} />
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-amber-50 dark:from-gray-950 dark:to-gray-900">
      {/* Glava */}
      <OrderHeader onRefresh={fetchOrder} />

      <div className="max-w-lg mx-auto px-4 py-6 space-y-6">
        {/* Kartica s podatki naročila */}
        <OrderInfoCard order={order} />

        {/* Sledilnik napredka */}
        <ProgressTracker order={order} />

        {/* Seznam artiklov */}
        <OrderItemsList items={order.orderItems} />

        {/* Obvestilo o samodejni osvežitvi */}
        <p className="text-center text-xs text-muted-foreground pb-6">
          Samodejna osvežitev vsakih 15 sekund · Zadnja osvežitev: {lastRefresh.toLocaleTimeString('sl-SI')}
        </p>
      </div>
    </div>
  )
}
