'use client'

import { memo } from 'react'
import type { Plan } from './pricing-data'
import { safeToFixed, safeNum } from '@/lib/safe-format'

// =====================================================================
// RESTAURANTOS PRICING — Pricing Card Component
// =====================================================================

interface PricingCardProps {
  plan: Plan
  annual: boolean
}

export const PricingCard = memo(function PricingCard({ plan, annual }: PricingCardProps) {
  const isCustom = plan.price < 0
  const monthlyPrice = isCustom ? 0 : (annual ? Math.round(plan.price * 0.8) : plan.price)
  return (
    <div className={`relative bg-white rounded-2xl border-2 ${plan.popular ? plan.borderColor : 'border-gray-100'} shadow-lg ${plan.popular ? 'shadow-amber-200/50 scale-105' : ''} overflow-hidden`}>
      {plan.popular && (
        <div className="absolute top-0 right-0 bg-gradient-to-r from-amber-500 to-orange-600 text-white text-xs font-bold px-3 py-1 rounded-bl-lg">
          NAJPOPULARNEJE
        </div>
      )}
      <div className={`h-2 bg-gradient-to-r ${plan.color}`} />
      <div className="p-6">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-2xl">{plan.icon}</span>
          <h3 className="text-xl font-bold">{plan.name}</h3>
        </div>
        <p className="text-sm text-gray-500 mb-4">{plan.description}</p>
        <div className="mb-6">
          {isCustom ? (
            <>
              <span className="text-3xl font-bold">Po ponudbi</span>
              <p className="text-xs text-gray-500 mt-1">Volume discounts na voljo</p>
            </>
          ) : (
            <>
              <span className="text-4xl font-bold">€{monthlyPrice}</span>
              <span className="text-gray-500 text-sm">/mesec</span>
              {annual && monthlyPrice > 0 && <p className="text-xs text-green-600 mt-1">Prihranek €{safeToFixed(plan.price * 12 - monthlyPrice * 12, 0)}/leto</p>}
              {monthlyPrice === 0 && <p className="text-xs text-green-600 mt-1">Brezplačno za vedno (AGPL-3.0)</p>}
            </>
          )}
        </div>
        <ul className="space-y-2.5 mb-6">
          {plan.features.map((f, i) => (
            <li key={i} className="flex items-center gap-2 text-sm">
              {f.included ? (
                <span className="w-5 h-5 rounded-full bg-green-100 text-green-600 flex items-center justify-center text-xs flex-shrink-0">✓</span>
              ) : (
                <span className="w-5 h-5 rounded-full bg-gray-100 text-gray-400 flex items-center justify-center text-xs flex-shrink-0">—</span>
              )}
              <span className={f.included ? 'text-gray-700' : 'text-gray-400'}>{f.text}</span>
            </li>
          ))}
        </ul>
        <button className={`w-full py-3 rounded-xl font-semibold transition ${
          plan.popular
            ? 'bg-gradient-to-r from-amber-500 to-orange-600 text-white hover:from-amber-600 hover:to-orange-700 shadow-lg shadow-amber-500/30'
            : isCustom
            ? 'bg-gradient-to-r from-purple-600 to-indigo-700 text-white hover:from-purple-700 hover:to-indigo-800'
            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
        }`}>
          {isCustom ? 'Kontaktiraj prodajo' : (plan.price === 0 ? 'Začni brezplačno' : 'Začni 14-dnevni preizkus')}
        </button>
        <p className="text-xs text-center text-gray-400 mt-2">
          {isCustom ? 'sales@restaurantos.app' : 'Brez kreditne kartice • Prekliči kadarkoli'}
        </p>
      </div>
    </div>
  )
})
