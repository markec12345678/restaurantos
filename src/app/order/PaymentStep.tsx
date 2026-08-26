'use client'

import { memo } from 'react'
import type { CartItem, OrderType, DeliveryZoneInfo, PromoResult } from './types'
import { safeToFixed, safeNum } from '@/lib/safe-format'

// =====================================================================
// PLAČILO
// =====================================================================

interface PaymentStepProps {
  isDark: boolean
  cart: CartItem[]
  orderType: OrderType
  deliveryZone: DeliveryZoneInfo | null
  getDeliveryFee: () => number
  promoResult: PromoResult | null
  total: number
  promoCode: string
  setPromoCode: (_code: string) => void
  setPromoResult: (_result: PromoResult | null) => void
  promoLoading: boolean
  checkPromoCode: () => void
  paymentMethod: 'card' | 'cash' | 'mobile'
  setPaymentMethod: (_method: 'card' | 'cash' | 'mobile') => void
  orderSending: boolean
  placeOrder: () => void
  setStep: (_step: 'menu' | 'cart' | 'details' | 'payment' | 'confirmation') => void
}

export const PaymentStep = memo(function PaymentStep({
  isDark, cart, orderType, deliveryZone, getDeliveryFee, promoResult, total,
  promoCode, setPromoCode, setPromoResult, promoLoading, checkPromoCode,
  paymentMethod, setPaymentMethod, orderSending, placeOrder, setStep,
}: PaymentStepProps) {
  const inputClass = `px-4 py-3 rounded-xl text-sm ${isDark ? 'bg-gray-800 border-gray-700 text-white' : 'bg-white border-gray-200'} border focus:ring-2 focus:ring-blue-500/50 focus:outline-none`

  return (
    <main className="max-w-4xl mx-auto px-4 py-4 space-y-4">
      <h2 className="text-lg font-bold">💳 Plačilo</h2>

      {/* Povzetek naročila */}
      <div className={`${isDark ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-100'} rounded-xl border p-4`}>
        <h3 className="font-semibold text-sm mb-2">Povzetek naročila</h3>
        {cart.map((item, idx) => {
          const modPrice = item.selectedModifiers.reduce((s, m) => s + (m.price || 0), 0)
          const priceWithVat = (item.menuItem.price + modPrice) * (1 + item.menuItem.vatRate / 100)
          return (
            <div key={idx} className="flex justify-between text-sm py-1">
              <span>{item.quantity}× {item.menuItem.name}</span>
              <span>€{safeToFixed(priceWithVat * item.quantity, 2)}</span>
            </div>
          )
        })}
        {orderType === 'delivery' && (
          <div className="flex justify-between text-sm py-1 text-gray-500">
            <span>Dostava{deliveryZone ? ` (${deliveryZone.name})` : ''}</span>
            <span>{getDeliveryFee() === 0 ? <span className="text-green-600">Brezplačno</span> : `€${getDeliveryFee().toFixed(2)}`}</span>
          </div>
        )}
        {promoResult?.valid && promoResult.discount && (
          <div className="flex justify-between text-sm py-1 text-green-600">
            <span>🏷 {promoResult.discount.description}</span>
            <span>-€{safeToFixed(promoResult.discount.discountAmount, 2)}</span>
          </div>
        )}
        <div className="flex justify-between font-bold text-lg pt-2 mt-2 border-t">
          <span>Skupaj</span>
          <span className="text-blue-600">€{safeToFixed(total, 2)}</span>
        </div>
      </div>

      {/* Promo koda */}
      <div className="space-y-2">
        <h3 className="font-semibold text-sm">Promo koda</h3>
        <div className="flex gap-2">
          <input type="text" placeholder="Vnesi kodo..." value={promoCode}
            onChange={e => { setPromoCode(e.target.value.toUpperCase()); setPromoResult(null) }}
            className={`flex-1 ${inputClass}`}
          />
          <button onClick={checkPromoCode} disabled={!promoCode.trim() || promoLoading}
            className="px-4 py-3 rounded-xl font-semibold bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:opacity-50 text-sm"
          >
            {promoLoading ? '...' : 'Uporabi'}
          </button>
        </div>
        {promoResult && (
          <p className={`text-xs ${promoResult.valid ? 'text-green-600' : 'text-red-500'}`}>
            {promoResult.valid ? `✓ ${promoResult.discount?.description} (-€${safeToFixed(promoResult.discount?.discountAmount, 2)})` : `✕ ${promoResult.message}`}
          </p>
        )}
      </div>

      {/* Način plačila */}
      <div className="space-y-2">
        <h3 className="font-semibold text-sm">Način plačila</h3>
        {[
          { value: 'card' as const, label: 'Kartica', icon: '💳', desc: 'Visa, Mastercard, Maestro' },
          { value: 'mobile' as const, label: 'Mobilno plačilo', icon: '📱', desc: 'Apple Pay, Google Pay' },
          { value: 'cash' as const, label: 'Gotovina', icon: '💵', desc: orderType === 'delivery' ? 'Plačilo ob dostavi' : 'Plačilo ob prevzemu' },
        ].map(pm => (
          <button
            key={pm.value}
            onClick={() => setPaymentMethod(pm.value)}
            className={`w-full p-3 rounded-xl border text-left flex items-center gap-3 transition ${
              paymentMethod === pm.value
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                : `${isDark ? 'border-gray-700' : 'border-gray-200'} hover:border-blue-300`
            }`}
          >
            <span className="text-2xl">{pm.icon}</span>
            <div>
              <p className="font-semibold text-sm">{pm.label}</p>
              <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{pm.desc}</p>
            </div>
            {paymentMethod === pm.value && <span className="ml-auto text-blue-600 font-bold">✓</span>}
          </button>
        ))}
      </div>

      <div className="flex gap-3">
        <button onClick={() => setStep('details')} className={`flex-1 py-3 rounded-xl font-semibold ${isDark ? 'bg-gray-800 text-gray-300' : 'bg-gray-100 text-gray-600'}`}>
          ← Podatki
        </button>
        <button onClick={placeOrder} disabled={orderSending}
          className="flex-1 py-3 rounded-xl font-semibold bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 transition"
        >
          {orderSending ? (
            <span className="flex items-center justify-center gap-2">
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Pošiljam...
            </span>
          ) : (
            `Potrdi naročilo • €${safeToFixed(total, 2)}`
          )}
        </button>
      </div>
    </main>
  )
})
