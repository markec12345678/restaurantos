'use client'

// ═══════════════════════════════════════════════════════════════
// RestaurantOS — Sledenje naročila za stranke
// Domino's Pizza Tracker standard
// Real-time status: Prejeto → V pripravi → V peči → Pripravljeno → Na poti → Dostavljeno
// ═══════════════════════════════════════════════════════════════

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { CheckCircle2, Clock, ChefHat, Package, PartyPopper, Phone, MapPin, UtensilsCrossed, Loader2, RefreshCw } from 'lucide-react'

// ─── Tipi ──────────────────────────────────────────────────────
interface OrderItem {
  id: string
  menuItem: { name: string }
  quantity: number
  status: string
}

interface OrderData {
  id: string
  orderNumber: number
  type: string
  status: string
  total: number
  customerName: string
  createdAt: string
  estimatedReady?: string
  orderItems: OrderItem[]
  table?: { number: number }
  location?: { name: string; address: string; phone: string }
}

// ─── Status koraki ─────────────────────────────────────────────
// FIX: Aligned with actual backend statuses: pending, in-progress, ready, completed
// FIX BUG-04 HIGH: Dinamični Tailwind razredi (bg-${color}-500) ne delujejo v produkciji
// Namesto tega uporabimo statično preslikavo barv
const STEP_COLORS: Record<string, { bg: string; shadow: string }> = {
  blue:    { bg: 'bg-blue-500',    shadow: 'shadow-blue-500/30' },
  amber:   { bg: 'bg-amber-500',   shadow: 'shadow-amber-500/30' },
  emerald: { bg: 'bg-emerald-500', shadow: 'shadow-emerald-500/30' },
  green:   { bg: 'bg-green-500',   shadow: 'shadow-green-500/30' },
}

const STATUS_STEPS = [
  { key: 'pending', label: 'Prejeto', labelEn: 'Received', icon: CheckCircle2, color: 'blue' },
  { key: 'in-progress', label: 'V pripravi', labelEn: 'Preparing', icon: ChefHat, color: 'amber' },
  { key: 'ready', label: 'Pripravljeno', labelEn: 'Ready', icon: Package, color: 'emerald' },
  { key: 'completed', label: 'Zaključeno', labelEn: 'Completed', icon: PartyPopper, color: 'green' },
]

// Map order status to step index
const STATUS_TO_STEP: Record<string, number> = {
  'pending': 0,
  'in-progress': 1,
  'preparing': 1,
  'ready': 2,
  'completed': 3,
  'delivered': 3,
}

function getStepIndex(status: string): number {
  return STATUS_TO_STEP[status] ?? 0
}

function getElapsedTime(createdAt: string): string {
  const now = new Date().getTime()
  const created = new Date(createdAt).getTime()
  const diffMin = Math.floor((now - created) / 60000)

  if (diffMin < 1) return 'Pravkar'
  if (diffMin < 60) return `Pred ${diffMin} min`
  const h = Math.floor(diffMin / 60)
  const m = diffMin % 60
  return `${h}h ${m}min`
}

function getEstimatedTime(createdAt: string, type: string): string {
  const created = new Date(createdAt)
  const prepMinutes = type === 'delivery' ? 45 : type === 'takeout' ? 25 : 20
  const estimated = new Date(created.getTime() + prepMinutes * 60000)
  return estimated.toLocaleTimeString('sl-SI', { hour: '2-digit', minute: '2-digit' })
}

export default function OrderStatusPage() {
  const params = useParams()
  const orderId = params?.orderId as string
  const [order, setOrder] = useState<OrderData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [lastRefresh, setLastRefresh] = useState(new Date())

  const fetchOrder = useCallback(async () => {
    try {
      // FIX: Use orderNumber-based lookup instead of orderId + phone
      // The order-track API requires phone for security, but this page
      // is accessed via a link sent to the customer's phone already
      const phone = localStorage.getItem('order_phone') || ''
      const res = await fetch(`/api/public/order-track?orderId=${orderId}${phone ? `&phone=${encodeURIComponent(phone)}` : ''}`)
      if (!res.ok) throw new Error('Naročilo ni najdeno')
      const data = await res.json()
      setOrder(data)
      setError('')
    } catch {
      setError('Naročilo ni bilo mogoče najti. Preverite povezavo.')
    } finally {
      setLoading(false)
      setLastRefresh(new Date())
    }
  }, [orderId])

  // Initial fetch + polling every 15 seconds
  useEffect(() => {
    fetchOrder()
    const interval = setInterval(fetchOrder, 15000)
    return () => clearInterval(interval)
  }, [fetchOrder])

  // Auto-refresh elapsed time
  const [, setTick] = useState(0)
  useEffect(() => {
    const timer = setInterval(() => setTick(t => t + 1), 30000)
    return () => clearInterval(timer)
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 to-amber-50 dark:from-gray-950 dark:to-gray-900 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Iskanje naročila...</p>
        </div>
      </div>
    )
  }

  if (error || !order) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 to-amber-50 dark:from-gray-950 dark:to-gray-900 flex items-center justify-center">
        <div className="text-center max-w-md px-4">
          <UtensilsCrossed className="h-16 w-16 text-muted-foreground mx-auto mb-4 opacity-30" />
          <h1 className="text-2xl font-bold mb-2">Naročilo ni najdeno</h1>
          <p className="text-muted-foreground">{error || 'Preverite povezavo in poskusite znova.'}</p>
        </div>
      </div>
    )
  }

  const currentStep = getStepIndex(order.status)
  const isCancelled = order.status === 'cancelled'
  const typeLabel = order.type === 'dine-in' ? 'Na mestu' : order.type === 'takeout' ? 'Za s seboj' : 'Dostava'
  const isDelivery = order.type === 'delivery'

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-amber-50 dark:from-gray-950 dark:to-gray-900">
      {/* Header */}
      <div className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm border-b sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <UtensilsCrossed className="h-6 w-6 text-primary" />
            <span className="font-bold text-lg">RestaurantOS</span>
          </div>
          <button onClick={fetchOrder} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
            <RefreshCw className="h-3 w-3" />
            Osveži
          </button>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-6">
        {/* Order Info Card */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold">Naročilo #{order.orderNumber}</h1>
              <p className="text-sm text-muted-foreground">{typeLabel}</p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-primary">€{order.total.toFixed(2)}</p>
              <p className="text-xs text-muted-foreground">
                {getElapsedTime(order.createdAt)}
              </p>
            </div>
          </div>

          {/* Customer & Location info */}
          <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
            {order.customerName && (
              <span className="flex items-center gap-1">
                <Phone className="h-3 w-3" />
                {order.customerName}
              </span>
            )}
            {order.location && (
              <span className="flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {order.location.name}
              </span>
            )}
          </div>

          {/* Estimated time */}
          {!isCancelled && currentStep < 5 && (
            <div className="bg-primary/5 rounded-xl p-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">Predviden čas</span>
              </div>
              <span className="text-sm font-bold text-primary">
                {getEstimatedTime(order.createdAt, order.type)}
              </span>
            </div>
          )}
        </div>

        {/* Progress Tracker — Domino's Style */}
        {!isCancelled ? (
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6">
            <h2 className="font-bold text-lg mb-6">Status naročila</h2>
            <div className="space-y-0">
              {STATUS_STEPS.map((step, idx) => {
                // Skip delivery-specific steps for dine-in/takeout
                if ((step.key === 'on-the-way' || step.key === 'delivered') && !isDelivery) {
                  if (step.key === 'delivered' && !isDelivery) return null // Skip for non-delivery
                  if (step.key === 'on-the-way') return null // Skip for non-delivery
                }

                const isActive = idx === currentStep
                const isCompleted = idx < currentStep
                const isPending = idx > currentStep
                const StepIcon = step.icon

                return (
                  <div key={step.key} className="flex items-start gap-4">
                    {/* Timeline */}
                    <div className="flex flex-col items-center">
                      <div className={`flex items-center justify-center h-10 w-10 rounded-full transition-all duration-500 ${
                        isCompleted
                          ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/30'
                          : isActive
                            ? `${STEP_COLORS[step.color]?.bg || 'bg-blue-500'} text-white shadow-lg ${STEP_COLORS[step.color]?.shadow || 'shadow-blue-500/30'} animate-pulse`
                            : 'bg-gray-100 dark:bg-gray-700 text-gray-400'
                      }`}>
                        {isCompleted ? (
                          <CheckCircle2 className="h-5 w-5" />
                        ) : (
                          <StepIcon className="h-5 w-5" />
                        )}
                      </div>
                      {idx < (isDelivery ? 5 : 3) && (
                        <div className={`w-0.5 h-8 transition-all duration-500 ${
                          isCompleted ? 'bg-emerald-500' : isActive ? 'bg-gray-300 dark:bg-gray-600' : 'bg-gray-200 dark:bg-gray-700'
                        }`} />
                      )}
                    </div>

                    {/* Content */}
                    <div className={`pb-6 ${isPending ? 'opacity-40' : ''}`}>
                      <p className={`font-semibold ${isCompleted ? 'text-emerald-600' : isActive ? 'text-foreground' : 'text-muted-foreground'}`}>
                        {step.label}
                      </p>
                      {isActive && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {idx === 0 && 'Vaše naročilo je bilo sprejeto'}
                          {idx === 1 && 'Naša ekipa pripravlja vaše naročilo'}
                          {idx === 2 && 'Vaše naročilo je v peči'}
                          {idx === 3 && 'Vaše naročilo je pripravljeno za prevzem'}
                          {idx === 4 && 'Voznik je na poti k vam'}
                          {idx === 5 && 'Vaše naročilo je dostavljeno. Dober tek!'}
                        </p>
                      )}
                      {isCompleted && (
                        <p className="text-xs text-emerald-600 mt-0.5">Končano ✓</p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ) : (
          <div className="bg-red-50 dark:bg-red-900/20 rounded-2xl shadow-lg p-6 text-center">
            <div className="h-16 w-16 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mx-auto mb-3">
              <span className="text-2xl">❌</span>
            </div>
            <h2 className="text-xl font-bold text-red-700 dark:text-red-400">Naročilo je preklicano</h2>
            <p className="text-sm text-muted-foreground mt-1">Za več informacij kontaktirajte restavracijo.</p>
          </div>
        )}

        {/* Order Items */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6">
          <h2 className="font-bold text-lg mb-4">Vsebina naročila</h2>
          <div className="space-y-3">
            {order.orderItems?.map((item) => (
              <div key={item.id} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className={`h-2 w-2 rounded-full ${
                    item.status === 'ready' ? 'bg-emerald-500' :
                    item.status === 'preparing' ? 'bg-amber-500' :
                    'bg-gray-300'
                  }`} />
                  <span className="text-sm">{item.quantity}x {item.menuItem?.name || 'Artikel'}</span>
                </div>
                <span className="text-xs text-muted-foreground capitalize">{item.status}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Auto-refresh notice */}
        <p className="text-center text-xs text-muted-foreground pb-6">
          Samodejna osvežitev vsakih 15 sekund · Zadnja osvežitev: {lastRefresh.toLocaleTimeString('sl-SI')}
        </p>
      </div>
    </div>
  )
}
