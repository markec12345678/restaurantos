'use client'

import { memo } from 'react'
import { motion } from 'framer-motion'
import { ShoppingCart, Plus, Minus, Trash2, ChevronRight, Loader2, User, Phone, MessageSquare, X } from 'lucide-react'
import { useFocusTrap } from '@/lib/use-focus-trap'
import type { TranslationValue } from '../translations'
import type { CartItem } from '../types'

// ============================================
// KOŠARICA - PLOVILNI GUMB
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
        <div className="flex items-center justify-between px-6 py-3">
          <h2 className="text-xl font-bold" id="cart-drawer-title">{t.cart}</h2>
          <button onClick={() => setCartOpen(false)} aria-label={t.close} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Cart Items */}
        <div className="flex-1 overflow-y-auto px-6 pb-4 custom-scrollbar">
          {cart.length === 0 ? (
            <div className="text-center py-8">
              <ShoppingCart className="h-12 w-12 text-gray-300 mx-auto mb-3" />
              <p className="text-muted-foreground">{t.empty}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {cart.map((c, i) => (
                <motion.div
                  key={`${c.menuItemId}-${c.notes}-${i}`}
                  layout
                  className="flex items-center gap-3 bg-gray-50 dark:bg-gray-800 rounded-xl p-3"
                >
                  {c.image && (
                    <img src={c.image} alt={c.name} className="w-12 h-12 rounded-lg object-cover flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-sm truncate">{c.name}</h4>
                    <p className="text-xs text-muted-foreground">{c.price.toFixed(2)} {t.currency}</p>
                    {c.notes && (
                      <p className="text-xs text-amber-600 mt-0.5">{c.notes}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => updateQuantity(c.menuItemId, c.notes, -1)}
                      className="w-7 h-7 flex items-center justify-center bg-white dark:bg-gray-700 rounded-full border border-gray-200 dark:border-gray-600"
                    >
                      <Minus className="h-3 w-3" />
                    </button>
                    <span className="font-bold text-sm w-5 text-center">{c.quantity}</span>
                    <button
                      onClick={() => updateQuantity(c.menuItemId, c.notes, 1)}
                      className="w-7 h-7 flex items-center justify-center bg-amber-500 text-white rounded-full"
                    >
                      <Plus className="h-3 w-3" />
                    </button>
                    <button
                      onClick={() => removeItem(c.menuItemId, c.notes)}
                      className="p-1 text-red-400 hover:text-red-600 ml-1"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          )}

          {/* Customer Info */}
          {cart.length > 0 && (
            <div className="space-y-3 mt-4 pt-4 border-t border-gray-200 dark:border-gray-800">
              <div className="flex gap-3">
                <div className="flex-1">
                  <label htmlFor="qr-customer-name" className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                    <User className="h-3 w-3" /> {t.name}
                  </label>
                  <input
                    id="qr-customer-name"
                    type="text"
                    value={customerName}
                    onChange={e => setCustomerName(e.target.value)}
                    placeholder={t.optional}
                    className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
                <div className="flex-1">
                  <label htmlFor="qr-customer-phone" className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                    <Phone className="h-3 w-3" /> {t.phone}
                  </label>
                  <input
                    id="qr-customer-phone"
                    type="tel"
                    value={customerPhone}
                    onChange={e => setCustomerPhone(e.target.value)}
                    placeholder="+386"
                    className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>
              <div>
                <label htmlFor="qr-order-notes" className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                  <MessageSquare className="h-3 w-3" /> {t.orderNotes}
                </label>
                <input
                  id="qr-order-notes"
                  type="text"
                  value={orderNotes}
                  onChange={e => setOrderNotes(e.target.value)}
                  placeholder={t.notePlaceholder}
                  className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
            </div>
          )}
        </div>

        {/* Cart Footer */}
        {cart.length > 0 && (
          <div className="border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-6 py-4">
            {/* Totals */}
            <div className="space-y-1 mb-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{t.subtotal}</span>
                <span>{(cartTotal - cartTax).toFixed(2)} {t.currency}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{t.vat}</span>
                <span>{cartTax.toFixed(2)} {t.currency}</span>
              </div>
              <div className="flex justify-between text-lg font-bold pt-1 border-t border-gray-200 dark:border-gray-800">
                <span>{t.total}</span>
                <span className="text-amber-600">{cartTotal.toFixed(2)} {t.currency}</span>
              </div>
            </div>

            {/* Order Button */}
            <button
              onClick={submitOrder}
              disabled={submitting}
              className="w-full py-3.5 bg-amber-500 hover:bg-amber-600 disabled:bg-amber-300 text-white rounded-xl font-semibold text-lg transition-colors flex items-center justify-center gap-2"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  {t.ordering}
                </>
              ) : (
                <>
                  {t.confirmOrder}
                  <ChevronRight className="h-5 w-5" />
                </>
              )}
            </button>
          </div>
        )}
      </motion.div>
    </>
  )
})
