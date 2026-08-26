'use client'

import { memo } from 'react'

// =====================================================================
// RESTAURANTOS PRICING — CTA + Footer Section Component
// =====================================================================

export const CTASection = memo(function CTASection() {
  return (
    <>
      {/* CTA */}
      <section className="max-w-6xl mx-auto px-6 py-16 text-center">
        <div className="bg-gradient-to-r from-amber-500 to-orange-600 rounded-3xl p-12 text-white">
          <h3 className="text-3xl font-bold mb-4">Pripravljeni na začetek?</h3>
          <p className="text-lg mb-6 text-amber-100">14-dnevni brezplačni preizkus. Brez kreditne kartice.</p>
          <button className="bg-white text-amber-700 px-8 py-3 rounded-xl font-bold text-lg hover:bg-amber-50 transition shadow-lg">
            Začni zdaj →
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t bg-gray-50 py-8">
        <div className="max-w-6xl mx-auto px-6 text-center text-sm text-gray-500">
          <p>© 2026 RestaurantOS — POS sistem za slovenske restavracije</p>
          <p className="mt-1">FURS potrjevanje • HACCP dnevniki • DDV 22%/9.5%/0% • PWA offline</p>
        </div>
      </footer>
    </>
  )
})
