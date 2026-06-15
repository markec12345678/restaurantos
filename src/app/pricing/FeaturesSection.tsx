'use client'

import { memo } from 'react'
import { features } from './pricing-data'

// =====================================================================
// RESTAURANTOS PRICING — Features Section Component
// =====================================================================

export const FeaturesSection = memo(function FeaturesSection() {
  return (
    <section className="max-w-6xl mx-auto px-6 py-16">
      <h3 className="text-3xl font-bold text-center mb-12">Zakaj RestaurantOS?</h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {features.map((f, i) => (
          <div key={i} className="bg-white rounded-xl border border-gray-100 p-6 hover:shadow-md transition">
            <span className="text-3xl mb-3 block">{f.icon}</span>
            <h4 className="font-bold text-lg mb-2">{f.title}</h4>
            <p className="text-sm text-gray-600">{f.desc}</p>
          </div>
        ))}
      </div>
    </section>
  )
})
