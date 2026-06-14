'use client'

import { memo } from 'react'
import type { CartItem, OrderType, DeliveryZoneInfo, PromoResult } from './types'

interface CartStepProps {
  isDark: boolean
  cart: CartItem[]
  removeFromCart: (_index: number) => void
  updateQuantity: (_index: number, _delta: number) => void
  subtotal: number
  orderType: OrderType
  deliveryZone: DeliveryZoneInfo | null
  getDeliveryFee: () => number
  promoResult: PromoResult | null
  total: number
  getMinOrderAmount: () => number
  setStep: (_step: 'menu' | 'cart' | 'details' | 'payment' | 'confirmation') => void
}

export const CartStep = memo(function CartStep({
  isDark, cart, removeFromCart, updateQuantity, subtotal,
  orderType, deliveryZone, getDeliveryFee, promoResult,
  total, getMinOrderAmount, setStep,
}: CartStepProps) {
  return (
    <main className="max-w-4xl mx-auto px-4 py-4 space-y-4">
      <h2 className="text-lg font-bold">Košarica</h2>
      {cart.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-4xl mb-2">🛒</p>
          <p className="text-gray-500">Košarica je prazna</p>
          <button onClick={() => setStep('menu')} className="mt-4 text-blue-600 font-semibold">Nazaj na meni</button>
        </div>
      ) : (
        <>
          {cart.map((item, idx) => {
            const modPrice = item.selectedModifiers.reduce((s, m) => s + (m.price || 0), 0)
            const priceWithVat = (item.menuItem.price + modPrice) * (1 + item.menuItem.vatRate / 100)
            return (
              <div key={idx} className={`${isDark ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-100'} rounded-xl border p-3`}>
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm">{item.menuItem.name}</p>
                    {item.selectedModifiers.length > 0 && (
                      <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                        + {item.selectedModifiers.map(m => m.name).join(', ')}
                      </p>
                    )}
                    {item.notes && <p className={`text-xs italic ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{item.notes}</p>}
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1">
                      <button onClick={() => updateQuantity(idx, -1)} className={`w-7 h-7 rounded-lg ${isDark ? 'bg-gray-800 text-gray-300' : 'bg-gray-100 text-gray-600'} flex items-center justify-center text-sm font-bold`}>-</button>
                      <span className="w-6 text-center font-bold text-sm">{item.quantity}</span>
                      <button onClick={() => updateQuantity(idx, 1)} className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center text-sm font-bold">+</button>
                    </div>
                    <span className="font-bold text-sm w-16 text-right">€{(priceWithVat * item.quantity).toFixed(2)}</span>
                    <button onClick={() => removeFromCart(idx)} className="text-red-400 hover:text-red-600 text-sm" aria-label="Odstrani iz košarice">✕</button>
                  </div>
                </div>
              </div>
            )
          })}

          {/* Povzetek */}
          <div className={`${isDark ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-100'} rounded-xl border p-4 space-y-2`}>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Vmesna vsota (z DDV)</span>
              <span>€{(subtotal + cart.reduce((sum, item) => {
                const modPrice = item.selectedModifiers.reduce((s, m) => s + (m.price || 0), 0)
                return sum + (item.menuItem.price + modPrice) * (item.menuItem.vatRate / 100) * item.quantity
              }, 0) - subtotal).toFixed(2)}</span>
            </div>
            {orderType === 'delivery' && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Dostava{deliveryZone ? ` (${deliveryZone.name})` : ''}</span>
                <span>{getDeliveryFee() === 0 ? <span className="text-green-600">Brezplačno</span> : `€${getDeliveryFee().toFixed(2)}`}</span>
              </div>
            )}
            {promoResult?.valid && promoResult.discount && (
              <div className="flex justify-between text-sm text-green-600">
                <span>🏷 {promoResult.discount.description}</span>
                <span>-€{promoResult.discount.discountAmount.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-lg pt-2 border-t">
              <span>Skupaj</span>
              <span className="text-blue-600">€{total.toFixed(2)}</span>
            </div>
            {orderType === 'delivery' && subtotal < getMinOrderAmount() && (
              <p className="text-xs text-amber-600">Min. naročilo za dostavo: €{getMinOrderAmount().toFixed(2)}</p>
            )}
          </div>

          <div className="flex gap-3">
            <button onClick={() => setStep('menu')} className={`flex-1 py-3 rounded-xl font-semibold ${isDark ? 'bg-gray-800 text-gray-300' : 'bg-gray-100 text-gray-600'}`}>
              ← Meni
            </button>
            <button
              onClick={() => setStep('details')}
              disabled={orderType === 'delivery' && subtotal < getMinOrderAmount()}
              className="flex-1 py-3 rounded-xl font-semibold bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Nadaljuj →
            </button>
          </div>
        </>
      )}
    </main>
  )
})
