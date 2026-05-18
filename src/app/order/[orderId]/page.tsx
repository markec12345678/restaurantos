'use client'

import { useState, useEffect, useCallback } from 'react'

// =====================================================================
// RESTAURANTOS ORDER TRACKING PAGE
// Javna stran za sledenje statusu online naročila
// =====================================================================

interface TimelineStep {
  status: string
  label: string
  time?: string
  completed: boolean
}

interface TrackingData {
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

const stepIcons: Record<string, string> = {
  pending: '📋',
  confirmed: '✅',
  'in-progress': '👨‍🍳',
  ready: '📦',
  delivered: '🎉',
  cancelled: '❌',
}

export default function OrderTrackingPage() {
  const [orderNumber, setOrderNumber] = useState('')
  const [phone, setPhone] = useState('')
  const [tracking, setTracking] = useState<TrackingData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [autoRefresh, setAutoRefresh] = useState(false)

  const fetchTracking = useCallback(async () => {
    if (!orderNumber || !phone) return
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/public/order-track?orderNumber=${orderNumber}&phone=${encodeURIComponent(phone)}`)
      const data = await res.json()
      if (res.ok && data.order) {
        setTracking(data)
        // Auto-refresh dokler ni končano
        const finalStatuses = ['delivered', 'cancelled', 'completed']
        if (!finalStatuses.includes(data.order.status)) {
          setAutoRefresh(true)
        } else {
          setAutoRefresh(false)
        }
      } else {
        setError(data.error || 'Naročilo ni bilo najdeno')
        setTracking(null)
      }
    } catch {
      setError('Povezava ni na voljo')
    } finally {
      setLoading(false)
    }
  }, [orderNumber, phone])

  useEffect(() => {
    if (!autoRefresh || !tracking) return
    const interval = setInterval(fetchTracking, 15000) // 15s refresh
    return () => clearInterval(interval)
  }, [autoRefresh, fetchTracking, tracking])

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 via-white to-indigo-50">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-xl border-b border-blue-100 shadow-sm">
        <div className="max-w-lg mx-auto px-4 py-3">
          <div className="flex items-center gap-3">
            <a href="/order" className="text-blue-600 hover:text-blue-800 text-sm font-medium">
              ← Naročanje
            </a>
            <h1 className="text-lg font-bold text-blue-900">Sledenje naročilu</h1>
          </div>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6 space-y-6">
        {/* Search form */}
        {!tracking && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
            <div className="text-center">
              <span className="text-4xl block mb-2">📦</span>
              <h2 className="text-xl font-bold text-gray-900">Sledi svojemu naročilu</h2>
              <p className="text-sm text-gray-500 mt-1">Vnesi številko naročila in telefonsko številko</p>
            </div>
            <div className="space-y-3">
              <input
                type="text"
                placeholder="Številka naročila (npr. 42)"
                value={orderNumber}
                onChange={e => setOrderNumber(e.target.value)}
                className="w-full px-4 py-3 rounded-xl text-sm bg-white border border-gray-200 focus:ring-2 focus:ring-blue-500/50 focus:outline-none"
              />
              <input
                type="tel"
                placeholder="Telefonska številka"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                className="w-full px-4 py-3 rounded-xl text-sm bg-white border border-gray-200 focus:ring-2 focus:ring-blue-500/50 focus:outline-none"
              />
            </div>
            <button
              onClick={fetchTracking}
              disabled={!orderNumber || !phone || loading}
              className="w-full py-3 rounded-xl font-semibold bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Iskanje...
                </span>
              ) : 'Poišči naročilo'}
            </button>
            {error && (
              <p className="text-center text-sm text-red-600 bg-red-50 rounded-xl p-3">{error}</p>
            )}
          </div>
        )}

        {/* Tracking result */}
        {tracking && (
          <>
            {/* Order header */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Naročilo</p>
                  <p className="text-3xl font-mono font-bold text-blue-600">#{tracking.order.orderNumber}</p>
                </div>
                <div className="text-right">
                  <span className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-bold ${
                    tracking.order.status === 'delivered' ? 'bg-green-100 text-green-700' :
                    tracking.order.status === 'cancelled' ? 'bg-red-100 text-red-700' :
                    tracking.order.status === 'in-progress' ? 'bg-orange-100 text-orange-700' :
                    'bg-blue-100 text-blue-700'
                  }`}>
                    {stepIcons[tracking.order.status]} {tracking.order.type === 'delivery' ? 'Dostava' : 'Prevzem'}
                  </span>
                </div>
              </div>

              {tracking.order.customerName && (
                <p className="text-sm text-gray-600 mt-2">Pozdravljeni, {tracking.order.customerName}!</p>
              )}

              {tracking.order.delivery && (
                <div className="mt-3 p-3 rounded-xl bg-blue-50 text-sm">
                  <p className="font-medium text-blue-800">📍 {tracking.order.delivery.address}, {tracking.order.delivery.city}</p>
                </div>
              )}

              <div className="mt-4 pt-3 border-t flex justify-between items-end">
                <div>
                  <p className="text-xs text-gray-500">Predviden čas</p>
                  <p className="text-lg font-bold text-blue-700">{tracking.estimatedMinutes} min</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-500">Skupaj</p>
                  <p className="text-lg font-bold">€{tracking.order.total.toFixed(2)}</p>
                </div>
              </div>

              {autoRefresh && (
                <p className="text-xs text-center text-gray-400 mt-2">
                  Samodejno osveževanje vsakih 15s...
                  <button onClick={() => setAutoRefresh(false)} className="ml-1 text-blue-500 underline">Ustavi</button>
                </p>
              )}
            </div>

            {/* Timeline */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <h3 className="font-bold mb-4">Status naročila</h3>
              <div className="space-y-0">
                {tracking.timeline.map((step, idx) => (
                  <div key={step.status} className="flex gap-3">
                    {/* Line + dot */}
                    <div className="flex flex-col items-center">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm flex-shrink-0 ${
                        step.completed
                          ? 'bg-green-500 text-white'
                          : 'bg-gray-100 text-gray-400'
                      }`}>
                        {step.completed ? '✓' : idx + 1}
                      </div>
                      {idx < tracking.timeline.length - 1 && (
                        <div className={`w-0.5 h-8 ${step.completed ? 'bg-green-300' : 'bg-gray-200'}`} />
                      )}
                    </div>
                    {/* Content */}
                    <div className="pb-4">
                      <p className={`font-medium text-sm ${step.completed ? 'text-gray-900' : 'text-gray-400'}`}>
                        {step.label}
                      </p>
                      {step.time && (
                        <p className="text-xs text-gray-400">
                          {new Date(step.time).toLocaleTimeString('sl-SI', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Items */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <h3 className="font-bold mb-3">Vsebina naročila</h3>
              <div className="space-y-2">
                {tracking.order.items.map((item, idx) => (
                  <div key={idx} className="flex justify-between text-sm">
                    <span>
                      <span className="font-medium">{item.quantity}×</span> {item.name}
                    </span>
                    {item.notes && <span className="text-gray-400 text-xs ml-2">({item.notes})</span>}
                  </div>
                ))}
              </div>
            </div>

            {/* Back */}
            <div className="flex gap-3">
              <button
                onClick={() => { setTracking(null); setAutoRefresh(false) }}
                className="flex-1 py-3 rounded-xl font-semibold bg-gray-100 text-gray-600 hover:bg-gray-200 transition"
              >
                Iskanje novega naročila
              </button>
              <a
                href="/order"
                className="flex-1 py-3 rounded-xl font-semibold bg-blue-600 text-white text-center hover:bg-blue-700 transition"
              >
                Naroči znova
              </a>
            </div>
          </>
        )}
      </main>
    </div>
  )
}
