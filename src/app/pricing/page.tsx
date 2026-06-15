'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import { plans } from './pricing-data'

// Lazy-load sub-components
const PricingCard = dynamic(() => import('./PricingCard').then(m => ({ default: m.PricingCard })), { ssr: false })
const FeaturesSection = dynamic(() => import('./FeaturesSection').then(m => ({ default: m.FeaturesSection })), { ssr: false })
const TestimonialsSection = dynamic(() => import('./TestimonialsSection').then(m => ({ default: m.TestimonialsSection })), { ssr: false })
const CTASection = dynamic(() => import('./CTASection').then(m => ({ default: m.CTASection })), { ssr: false })

// =====================================================================
// RESTAURANTOS PRICING PAGE — Javna stran s ceniki
// Za trženje SaaS naročnine restavracijam
// =====================================================================

export default function PricingPage() {
  const [annual, setAnnual] = useState(false)

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 via-white to-blue-50">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-xl sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl flex items-center justify-center text-white font-bold text-lg">R</div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">RestaurantOS</h1>
              <p className="text-xs text-gray-500">POS za slovenske restavracije</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <a href="/order" className="text-sm text-blue-600 hover:text-blue-800 font-medium">Online naročanje</a>
            <a href="/qr-menu" className="text-sm text-gray-600 hover:text-gray-800 font-medium">QR meni</a>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-6 py-16 text-center">
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-amber-100 text-amber-800 rounded-full text-sm font-medium mb-6">
          🇸🇮 Edini POS z vgrajenim FURS potrjevanjem
        </div>
        <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
          POS sistem, ki razume<br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-500 to-orange-600">slovenske predpise</span>
        </h2>
        <p className="text-lg text-gray-600 max-w-2xl mx-auto mb-8">
          Od FURS potrjevanja do HACCP dnevnikov, od QR menija do AI napovedi — vse v enem sistemu.
          10-15x cenejše od Toast ali Square, z lokalno podporo.
        </p>
        <div className="flex items-center justify-center gap-4 mb-8">
          <button
            onClick={() => setAnnual(!annual)}
            className="flex items-center gap-3 text-sm"
          >
            <span className={!annual ? 'font-bold text-gray-900' : 'text-gray-500'}>Mesečno</span>
            <div className={`w-12 h-6 rounded-full transition-colors ${annual ? 'bg-green-500' : 'bg-gray-300'} relative`}>
              <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-transform ${annual ? 'translate-x-6' : 'translate-x-0.5'}`} />
            </div>
            <span className={annual ? 'font-bold text-gray-900' : 'text-gray-500'}>
              Letno <span className="text-green-600 text-xs font-medium">-20%</span>
            </span>
          </button>
        </div>
      </section>

      {/* Pricing cards */}
      <section className="max-w-6xl mx-auto px-6 pb-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {plans.map(plan => (
            <PricingCard key={plan.key} plan={plan} annual={annual} />
          ))}
        </div>
      </section>

      <FeaturesSection />
      <TestimonialsSection />
      <CTASection />
    </div>
  )
}
