'use client'

import { memo } from 'react'
import type { OrderResultRow } from '@/lib/types'
import type { OrderType, DeliveryDetails } from './types'

// =====================================================================
// POTRDITEV NAROČILA
// =====================================================================

interface ConfirmationViewProps {
  isDark: boolean
  orderResult: OrderResultRow | null
  orderType: OrderType
  deliveryDetails: DeliveryDetails
  total: number
  paymentMethod: 'card' | 'cash' | 'mobile'
  resetAfterConfirmation: () => void
  ESTIMATED_DELIVERY_MIN: number
  ESTIMATED_TAKEOUT_MIN: number
}

export const ConfirmationView = memo(function ConfirmationView({
  isDark, orderResult, orderType, deliveryDetails, total,
  paymentMethod, resetAfterConfirmation, ESTIMATED_DELIVERY_MIN, ESTIMATED_TAKEOUT_MIN,
}: ConfirmationViewProps) {
  if (!orderResult) return null
  return (
    <div className={`min-h-screen flex items-center justify-center ${isDark ? 'bg-gray-950' : 'bg-gradient-to-b from-green-50 to-emerald-50'}`}>
      <div className={`max-w-md mx-auto p-8 rounded-3xl shadow-2xl text-center ${isDark ? 'bg-gray-900' : 'bg-white'}`}>
        <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
          <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-2xl font-bold text-green-700 mb-2">Naročilo sprejeto!</h2>
        <p className="text-gray-600 mb-1">Številka naročila:</p>
        <p className="text-3xl font-mono font-bold text-blue-600 mb-3">#{orderResult.order?.orderNumber}</p>
        <p className="text-gray-500 text-sm mb-2">
          {orderType === 'delivery'
            ? `Predviden čas dostave: ${ESTIMATED_DELIVERY_MIN}-${ESTIMATED_DELIVERY_MIN + 15} min`
            : `Prevzem čez: ${ESTIMATED_TAKEOUT_MIN}-${ESTIMATED_TAKEOUT_MIN + 10} min`}
        </p>
        {orderType === 'delivery' && (
          <p className="text-gray-500 text-sm">Dostava na: {deliveryDetails.address}, {deliveryDetails.city}</p>
        )}
        <p className="text-lg font-bold text-green-700 mt-4">Skupaj: €{total.toFixed(2)}</p>
        <div className="mt-2 text-sm text-gray-500">
          {paymentMethod === 'card' && 'Plačilo s kartico ✓'}
          {paymentMethod === 'cash' && 'Plačilo ob prevzemu (gotovina)'}
          {paymentMethod === 'mobile' && 'Plačilo z mobilno napravo ✓'}
        </div>
        <a href={`/order/${orderResult.order?.id}`}
          className="mt-4 block bg-indigo-600 text-white px-8 py-3 rounded-2xl font-semibold hover:bg-indigo-700 transition text-center"
        >
          📍 Sledi naročilu
        </a>
        <button onClick={resetAfterConfirmation}
          className="mt-3 bg-blue-600 text-white px-8 py-3 rounded-2xl font-semibold hover:bg-blue-700 transition"
        >
          Naroči še
        </button>
      </div>
    </div>
  )
})
