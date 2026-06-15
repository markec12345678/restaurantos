'use client'

import dynamic from 'next/dynamic'

// =====================================================================
// RESTAURANTOS ONLINE ORDERING PLATFORM
// Spletna naročilna platforma — dostava ali prevzem z online plačilom
// Ekvivalent Toast Online Ordering / Square Online za Slovenijo
// =====================================================================

import { useOnlineOrder } from './useOnlineOrder'

// Lazy-load podkomponente
const OrderHeader = dynamic(() => import('./OrderHeader').then(m => ({ default: m.OrderHeader })), { ssr: false })
const ConfirmationView = dynamic(() => import('./CheckoutViews').then(m => ({ default: m.ConfirmationView })), { ssr: false })
const OrderStepContent = dynamic(() => import('./OrderStepContent').then(m => ({ default: m.OrderStepContent })), { ssr: false })

export default function OnlineOrderPage() {
  const hook = useOnlineOrder()

  // ==================== LOADING ====================
  if (hook.loading) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${hook.isDark ? 'bg-gray-950' : 'bg-gradient-to-b from-blue-50 to-indigo-50'}`}>
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className={`text-lg font-semibold ${hook.isDark ? 'text-blue-400' : 'text-blue-800'}`}>Nalagam meni...</p>
        </div>
      </div>
    )
  }

  // ==================== CONFIRMATION ====================
  if (hook.step === 'confirmation' && hook.orderResult) {
    return (
      <ConfirmationView
        isDark={hook.isDark}
        orderResult={hook.orderResult}
        orderType={hook.orderType}
        deliveryDetails={hook.deliveryDetails}
        total={hook.total}
        paymentMethod={hook.paymentMethod}
        resetAfterConfirmation={hook.resetAfterConfirmation}
        ESTIMATED_DELIVERY_MIN={hook.ESTIMATED_DELIVERY_MIN}
        ESTIMATED_TAKEOUT_MIN={hook.ESTIMATED_TAKEOUT_MIN}
      />
    )
  }

  // ==================== MAIN APP ====================
  return (
    <div className={`min-h-screen ${hook.isDark ? 'bg-gray-950 text-gray-100' : 'bg-gradient-to-b from-blue-50 via-white to-indigo-50 text-gray-900'}`}>

      {hook.error && (
        <div className="mx-4 mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-center justify-between">
          <p className="text-sm text-red-700 dark:text-red-400">{hook.error}</p>
          <button onClick={() => hook.setError('')} className="text-red-500 hover:text-red-700 text-lg font-bold ml-2">&times;</button>
        </div>
      )}

      <OrderHeader
        settings={hook.settings}
        isDark={hook.isDark}
        setIsDark={hook.setIsDark}
        step={hook.step}
        setStep={hook.setStep}
        cartItemCount={hook.cartItemCount}
        orderType={hook.orderType}
        setOrderType={hook.setOrderType}
        locations={hook.locations}
        selectedLocation={hook.selectedLocation}
        setSelectedLocation={hook.setSelectedLocation}
        isOpenNow={hook.isOpenNow}
        showHours={hook.showHours}
        setShowHours={hook.setShowHours}
        weeklyHours={hook.weeklyHours}
        searchQuery={hook.searchQuery}
        setSearchQuery={hook.setSearchQuery}
      />

      <OrderStepContent hook={hook} />
    </div>
  )
}
