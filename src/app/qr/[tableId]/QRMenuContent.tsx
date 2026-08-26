'use client'

import { memo } from 'react'
import { AnimatePresence } from 'framer-motion'
import dynamic from 'next/dynamic'
import type { useQROrdering } from './hooks/use-qr-ordering'

type QRState = ReturnType<typeof useQROrdering>

const MenuHeader = dynamic(() => import('./components/MenuHeader').then(m => ({ default: m.MenuHeader })), { ssr: false })
const MenuItemsList = dynamic(() => import('./components/MenuItemsList').then(m => ({ default: m.MenuItemsList })), { ssr: false })
const FloatingCartButton = dynamic(() => import('./components/FloatingCartButton').then(m => ({ default: m.FloatingCartButton })), { ssr: false })
const CartDrawer = dynamic(() => import('./components/CartDrawer').then(m => ({ default: m.CartDrawer })), { ssr: false })
const ItemDetailModal = dynamic(() => import('./components/ItemDetailModal').then(m => ({ default: m.ItemDetailModal })), { ssr: false })
const ErrorToast = dynamic(() => import('./components/Toasts').then(m => ({ default: m.ErrorToast })), { ssr: false })
const WaiterCalledToast = dynamic(() => import('./components/Toasts').then(m => ({ default: m.WaiterCalledToast })), { ssr: false })

interface QRMenuContentProps {
  state: QRState
}

export const QRMenuContent = memo(function QRMenuContent({ state }: QRMenuContentProps) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 to-orange-50 dark:from-gray-950 dark:to-gray-900 pb-24">
      {/* ====== HEADER ====== */}
      <MenuHeader
        t={state.t}
        locale={state.locale}
        setLocale={state.setLocale}
        localeOpen={state.localeOpen}
        setLocaleOpen={state.setLocaleOpen}
        restaurantName={state.restaurant?.name}
        tableId={state.tableId}
        menus={state.menus}
        activeMenuId={state.activeMenuId}
        setActiveMenuId={state.setActiveMenuId}
        setActiveSuperGroup={state.setActiveSuperGroup}
        setSearchQuery={state.setSearchQuery}
        setActiveCategoryId={state.setActiveCategoryId}
        callWaiter={state.callWaiter}
        waiterCooldown={state.waiterCooldown}
        searchQuery={state.searchQuery}
        setSearchQueryDirect={state.setSearchQuery}
        isDrinksMenu={state.isDrinksMenu}
        isSearching={state.isSearching}
        activeSuperGroup={state.activeSuperGroup}
        allCategories={state.allCategories}
        categories={state.categories}
        activeCategoryId={state.activeCategoryId}
        setActiveCategoryIdDirect={state.setActiveCategoryId}
        getSuperGroupForCategory={state.getSuperGroupForCategory}
      />

      {/* ====== MENU ITEMS ====== */}
      <MenuItemsList
        t={state.t}
        isSearching={state.isSearching}
        searchResults={state.searchResults}
        activeCategory={state.activeCategory}
        activeCategoryId={state.activeCategoryId}
        cart={state.cart}
        onAddToCart={state.addToCart}
        onUpdateQuantity={state.updateQuantity}
        onOpenDetail={state.setDetailItem}
      />

      {/* ====== FLOATING CART BUTTON ====== */}
      {state.cartCount > 0 && !state.cartOpen && (
        <FloatingCartButton
          cartCount={state.cartCount}
          cartTotal={state.cartTotal}
          onOpenCart={() => state.setCartOpen(true)}
          itemLabel={state.t.item}
          itemsLabel={state.t.items}
          currency={state.t.currency}
        />
      )}

      {/* ====== CART DRAWER ====== */}
      <AnimatePresence>
        {state.cartOpen && (
          <CartDrawer
            t={state.t}
            cart={state.cart}
            cartOpen={state.cartOpen}
            setCartOpen={state.setCartOpen}
            customerName={state.customerName}
            setCustomerName={state.setCustomerName}
            customerPhone={state.customerPhone}
            setCustomerPhone={state.setCustomerPhone}
            orderNotes={state.orderNotes}
            setOrderNotes={state.setOrderNotes}
            cartTotal={state.cartTotal}
            cartTax={state.cartTax}
            submitting={state.submitting}
            updateQuantity={state.updateQuantity}
            removeItem={state.removeItem}
            submitOrder={state.submitOrder}
          />
        )}
      </AnimatePresence>

      {/* ====== ITEM DETAIL MODAL ====== */}
      <AnimatePresence>
        {state.detailItem && (
          <ItemDetailModal
            t={state.t}
            detailItem={state.detailItem}
            detailNote={state.detailNote}
            setDetailNote={state.setDetailNote}
            cart={state.cart}
            onAddToCart={state.addToCart}
            onAddToCartWithNote={state.addToCartWithNote}
            onClose={() => { state.setDetailItem(null); state.setDetailNote('') }}
          />
        )}
      </AnimatePresence>

      {/* ====== ERROR TOAST ====== */}
      <ErrorToast error={state.error} onDismiss={() => state.setError(null)} t={state.t} />

      {/* ====== WAITER CALLED TOAST ====== */}
      <WaiterCalledToast waiterCalled={state.waiterCalled} t={state.t} />
    </div>
  )
})
