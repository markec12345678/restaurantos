'use client'

import dynamic from 'next/dynamic'

// =====================================================================
// RESTAURANTOS ONLINE ORDERING PLATFORM
// Spletna naročilna platforma — dostava ali prevzem z online plačilom
// Ekvivalent Toast Online Ordering / Square Online za Slovenijo
// =====================================================================

import { useOnlineOrder } from './useOnlineOrder'
// R89: empty state "Naročanje po povezavi" — shadcn Card + lucide ikona
import { Card, CardContent, CardDescription, CardTitle } from '@/components/ui/card'
import { Link2 } from 'lucide-react'

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

  // ==================== R89: NAROČANJE PO POVEZAVI (empty state) ====================
  // Order-config je token-gated (R89): brez veljavnega deep-link konteksta
  // (?loc= + ?t=) je konfiguracija prazna (fail-closed) — submit flow je
  // SKRIT, pokaže se navodilo za uporabo restavracijske povezave / QR kode.
  // URL-izbrana lokacija (?loc=) ostane v stanju — o veljavnosti odloči POST.
  if (hook.needsOrderingLink && hook.locations.length === 0) {
    return (
      <div className={`min-h-screen flex items-center justify-center px-4 ${hook.isDark ? 'bg-gray-950 text-gray-100' : 'bg-gradient-to-b from-blue-50 via-white to-indigo-50 text-gray-900'}`}>
        <Card className={`w-full max-w-md text-center ${hook.isDark ? 'bg-gray-900 border-gray-800' : 'bg-white/90'}`}>
          <CardContent className="flex flex-col items-center gap-3 pt-6">
            <Link2 className={`h-10 w-10 ${hook.isDark ? 'text-blue-400' : 'text-blue-600'}`} aria-hidden="true" />
            <CardTitle className={`text-lg font-bold ${hook.isDark ? 'text-blue-300' : 'text-blue-900'}`}>
              Naročanje po povezavi
            </CardTitle>
            <CardDescription className={hook.isDark ? 'text-gray-400' : 'text-gray-600'}>
              Za spletno naročanje uporabi povezavo vaše restavracije (npr. z njihove spletne strani ali QR kode).
            </CardDescription>
          </CardContent>
        </Card>
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
