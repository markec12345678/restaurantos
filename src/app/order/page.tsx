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
const MenuStep = dynamic(() => import('./MenuStep').then(m => ({ default: m.MenuStep })), { ssr: false })
const CartStep = dynamic(() => import('./CartStep').then(m => ({ default: m.CartStep })), { ssr: false })
const DetailsStep = dynamic(() => import('./CheckoutViews').then(m => ({ default: m.DetailsStep })), { ssr: false })
const PaymentStep = dynamic(() => import('./CheckoutViews').then(m => ({ default: m.PaymentStep })), { ssr: false })
const ConfirmationView = dynamic(() => import('./CheckoutViews').then(m => ({ default: m.ConfirmationView })), { ssr: false })
const ItemDetailModal = dynamic(() => import('./CheckoutViews').then(m => ({ default: m.ItemDetailModal })), { ssr: false })

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

      {hook.step === 'menu' && (
        <MenuStep
          isDark={hook.isDark}
          isOpenNow={hook.isOpenNow}
          orderType={hook.orderType}
          deliveryZone={hook.deliveryZone}
          currentMenu={hook.currentMenu}
          activeCategory={hook.activeCategory}
          setActiveCategory={hook.setActiveCategory}
          filteredItems={hook.filteredItems}
          cart={hook.cart}
          addToCart={hook.addToCart}
          setShowItemDetail={hook.setShowItemDetail}
          setItemNotes={hook.setItemNotes}
          setSelectedMods={hook.setSelectedMods}
          getDeliveryFee={hook.getDeliveryFee}
          getMinOrderAmount={hook.getMinOrderAmount}
          getEstimatedMinutes={hook.getEstimatedMinutes}
          total={hook.total}
          cartItemCount={hook.cartItemCount}
          setStep={hook.setStep}
        />
      )}

      {hook.step === 'cart' && (
        <CartStep
          isDark={hook.isDark}
          cart={hook.cart}
          removeFromCart={hook.removeFromCart}
          updateQuantity={hook.updateQuantity}
          subtotal={hook.subtotal}
          orderType={hook.orderType}
          deliveryZone={hook.deliveryZone}
          getDeliveryFee={hook.getDeliveryFee}
          promoResult={hook.promoResult}
          total={hook.total}
          getMinOrderAmount={hook.getMinOrderAmount}
          setStep={hook.setStep}
        />
      )}

      {hook.step === 'details' && (
        <DetailsStep
          isDark={hook.isDark}
          orderType={hook.orderType}
          deliveryDetails={hook.deliveryDetails}
          setDeliveryDetails={hook.setDeliveryDetails}
          takeoutDetails={hook.takeoutDetails}
          setTakeoutDetails={hook.setTakeoutDetails}
          deliveryZone={hook.deliveryZone}
          deliveryZoneChecked={hook.deliveryZoneChecked}
          checkDeliveryZone={hook.checkDeliveryZone}
          setStep={hook.setStep}
        />
      )}

      {hook.step === 'payment' && (
        <PaymentStep
          isDark={hook.isDark}
          cart={hook.cart}
          orderType={hook.orderType}
          deliveryZone={hook.deliveryZone}
          getDeliveryFee={hook.getDeliveryFee}
          promoResult={hook.promoResult}
          total={hook.total}
          promoCode={hook.promoCode}
          setPromoCode={hook.setPromoCode}
          setPromoResult={hook.setPromoResult}
          promoLoading={hook.promoLoading}
          checkPromoCode={hook.checkPromoCode}
          paymentMethod={hook.paymentMethod}
          setPaymentMethod={hook.setPaymentMethod}
          orderSending={hook.orderSending}
          placeOrder={hook.placeOrder}
          setStep={hook.setStep}
        />
      )}

      {hook.showItemDetail && (
        <ItemDetailModal
          isDark={hook.isDark}
          showItemDetail={hook.showItemDetail}
          itemNotes={hook.itemNotes}
          setItemNotes={hook.setItemNotes}
          selectedMods={hook.selectedMods}
          toggleModifier={hook.toggleModifier}
          addToCart={hook.addToCart}
          setShowItemDetail={hook.setShowItemDetail}
        />
      )}
    </div>
  )
}
