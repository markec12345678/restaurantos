'use client'

import { memo } from 'react'
import dynamic from 'next/dynamic'

// Lazy-load podkomponente
const MenuStep = dynamic(() => import('./MenuStep').then(m => ({ default: m.MenuStep })), { ssr: false })
const CartStep = dynamic(() => import('./CartStep').then(m => ({ default: m.CartStep })), { ssr: false })
const DetailsStep = dynamic(() => import('./CheckoutViews').then(m => ({ default: m.DetailsStep })), { ssr: false })
const PaymentStep = dynamic(() => import('./CheckoutViews').then(m => ({ default: m.PaymentStep })), { ssr: false })
const ItemDetailModal = dynamic(() => import('./CheckoutViews').then(m => ({ default: m.ItemDetailModal })), { ssr: false })

import type { useOnlineOrder } from './useOnlineOrder'

type OnlineOrderHook = ReturnType<typeof useOnlineOrder>

interface OrderStepContentProps {
  hook: OnlineOrderHook
}

export const OrderStepContent = memo(function OrderStepContent({ hook }: OrderStepContentProps) {
  return (
    <>
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
    </>
  )
})
