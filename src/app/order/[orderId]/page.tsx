'use client'

import dynamic from 'next/dynamic'
import { useOrderTracking } from './useOrderTracking'

// Lazy-load sub-components
const SearchForm = dynamic(() => import('./SearchForm').then(m => ({ default: m.SearchForm })), { ssr: false })
const OrderHeaderCard = dynamic(() => import('./OrderHeaderCard').then(m => ({ default: m.OrderHeaderCard })), { ssr: false })
const OrderTimeline = dynamic(() => import('./OrderTimeline').then(m => ({ default: m.OrderTimeline })), { ssr: false })
const OrderItemsCard = dynamic(() => import('./OrderItemsCard').then(m => ({ default: m.OrderItemsCard })), { ssr: false })
const ActionButtons = dynamic(() => import('./ActionButtons').then(m => ({ default: m.ActionButtons })), { ssr: false })

// =====================================================================
// RESTAURANTOS ORDER TRACKING PAGE
// Javna stran za sledenje statusu online naročila
// =====================================================================

export default function OrderTrackingPage() {
  const {
    orderNumber, setOrderNumber,
    phone, setPhone,
    tracking,
    loading,
    error,
    autoRefresh, setAutoRefresh,
    fetchTracking,
    resetTracking,
  } = useOrderTracking()

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
          <SearchForm
            orderNumber={orderNumber}
            phone={phone}
            loading={loading}
            error={error}
            onOrderNumberChange={setOrderNumber}
            onPhoneChange={setPhone}
            onSearch={fetchTracking}
          />
        )}

        {/* Tracking result */}
        {tracking && (
          <>
            <OrderHeaderCard
              tracking={tracking}
              autoRefresh={autoRefresh}
              onStopRefresh={() => setAutoRefresh(false)}
            />
            <OrderTimeline tracking={tracking} />
            <OrderItemsCard tracking={tracking} />
            <ActionButtons onReset={resetTracking} />
          </>
        )}
      </main>
    </div>
  )
}
