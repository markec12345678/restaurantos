'use client'

import { memo } from 'react'
import { motion } from 'framer-motion'
import { X } from 'lucide-react'
import { useFocusTrap } from '@/lib/use-focus-trap'
import type { TranslationValue } from '../translations'
import type { CartItem } from '../types'
import { CartItemsList } from './CartItemsList'
import { CustomerInfoForm } from './CustomerInfoForm'
import { CartFooter } from './CartFooter'
import { EmptyCartView } from './EmptyCartView'

// ============================================
// CART DRAWER HEADER SUB-COMPONENT
// ============================================
interface CartDrawerHeaderProps {
  title: string
  closeLabel: string
  onClose: () => void
}

export const CartDrawerHeader = memo(function CartDrawerHeader({ title, closeLabel, onClose }: CartDrawerHeaderProps) {
  return (
    <div className="flex items-center justify-between px-6 py-3">
      <h2 className="text-xl font-bold" id="cart-drawer-title">{title}</h2>
      <button onClick={onClose} aria-label={closeLabel} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full">
        <X className="h-5 w-5" />
      </button>
    </div>
  )
})

// ============================================
// KOŠARICA - GLAVNA KOMPONENTA
// ============================================
interface CartDrawerProps {
  t: TranslationValue
  cart: CartItem[]
  cartOpen: boolean
  setCartOpen: (_open: boolean) => void
  customerName: string
  setCustomerName: (_name: string) => void
  customerPhone: string
  setCustomerPhone: (_phone: string) => void
  orderNotes: string
  setOrderNotes: (_notes: string) => void
  cartTotal: number
  cartTax: number
  submitting: boolean
  updateQuantity: (_menuItemId: string, _notes: string, _delta: number) => void
  removeItem: (_menuItemId: string, _notes: string) => void
  submitOrder: () => Promise<void>
}

export const CartDrawer = memo(function CartDrawer({
  t,
  cart,
  cartOpen,
  setCartOpen,
  customerName,
  setCustomerName,
  customerPhone,
  setCustomerPhone,
  orderNotes,
  setOrderNotes,
  cartTotal,
  cartTax,
  submitting,
  updateQuantity,
  removeItem,
  submitOrder,
}: CartDrawerProps) {
  const cartDrawerRef = useFocusTrap<HTMLDivElement>(cartOpen)

  if (!cartOpen) return null

  return (
    <>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={() => setCartOpen(false)}
        className="fixed inset-0 bg-black/50 z-50"
      />

      {/* Drawer */}
      <motion.div
        ref={cartDrawerRef}
        role="dialog"
        aria-modal="true"
        aria-label={t.cart}
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="fixed inset-x-0 bottom-0 z-50 max-h-[90vh] bg-white dark:bg-gray-900 rounded-t-3xl shadow-2xl overflow-hidden flex flex-col"
        onKeyDown={(e) => { if (e.key === 'Escape') setCartOpen(false) }}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 bg-gray-300 rounded-full" />
        </div>

        {/* Header */}
        <CartDrawerHeader title={t.cart} closeLabel={t.close} onClose={() => setCartOpen(false)} />

        {/* Cart Items */}
        <div className="flex-1 overflow-y-auto px-6 pb-4 custom-scrollbar">
          {cart.length === 0 ? (
            <EmptyCartView t={t} />
          ) : (
            <CartItemsList cart={cart} updateQuantity={updateQuantity} removeItem={removeItem} />
          )}

          {/* Customer Info */}
          {cart.length > 0 && (
            <CustomerInfoForm
              t={t}
              customerName={customerName}
              setCustomerName={setCustomerName}
              customerPhone={customerPhone}
              setCustomerPhone={setCustomerPhone}
              orderNotes={orderNotes}
              setOrderNotes={setOrderNotes}
            />
          )}
        </div>

        {/* Cart Footer */}
        {cart.length > 0 && (
          <CartFooter t={t} cartTotal={cartTotal} cartTax={cartTax} submitting={submitting} submitOrder={submitOrder} />
        )}
      </motion.div>
    </>
  )
})
