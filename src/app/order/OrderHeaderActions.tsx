'use client'

import { memo } from 'react'
import type { CheckoutStep } from './types'

interface OrderHeaderActionsProps {
  isDark: boolean
  setIsDark: (_dark: boolean) => void
  step: CheckoutStep
  setStep: (_step: CheckoutStep) => void
  cartItemCount: number
}

export const OrderHeaderActions = memo(function OrderHeaderActions({
  isDark, setIsDark, step, setStep, cartItemCount,
}: OrderHeaderActionsProps) {
  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => setIsDark(!isDark)}
        className={`p-2 rounded-xl ${isDark ? 'bg-gray-800 text-gray-400' : 'bg-blue-50 text-blue-700'} transition`}
      >
        {isDark ? '☀️' : '🌙'}
      </button>
      {/* Gumb za košarico */}
      <button
        onClick={() => setStep(step === 'cart' ? 'menu' : 'cart')}
        className="relative bg-blue-600 text-white p-3 rounded-xl shadow-lg hover:bg-blue-700 transition"
        aria-label={step === 'cart' ? 'Zapri košarico' : 'Odpri košarico'}
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z" />
        </svg>
        {cartItemCount > 0 && (
          <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center animate-bounce">
            {cartItemCount}
          </span>
        )}
      </button>
    </div>
  )
})
