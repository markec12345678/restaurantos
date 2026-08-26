'use client'

import { memo } from 'react'
import { testimonials } from './pricing-data'

// =====================================================================
// RESTAURANTOS PRICING — Testimonials Section Component
// =====================================================================

export const TestimonialsSection = memo(function TestimonialsSection() {
  return (
    <section className="max-w-6xl mx-auto px-6 py-16">
      <h3 className="text-3xl font-bold text-center mb-12">Kaj pravijo uporabniki</h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {testimonials.map((t, i) => (
          <div key={i} className="bg-white rounded-xl border border-gray-100 p-6">
            <div className="flex items-center gap-1 mb-3">
              {[...Array(t.rating)].map((_, j) => (
                <span key={j} className="text-amber-400">★</span>
              ))}
            </div>
            <p className="text-sm text-gray-700 mb-4 italic">&ldquo;{t.text}&rdquo;</p>
            <div>
              <p className="font-semibold text-sm">{t.name}</p>
              <p className="text-xs text-gray-500">{t.location}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
})
