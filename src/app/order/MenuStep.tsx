'use client'

import { memo } from 'react'
import type { Category, MenuItem, CartItem, OrderType, Modifier } from './types'
import { ALLERGEN_DATA, DEFAULT_DELIVERY_FEE, DEFAULT_MIN_ORDER, ESTIMATED_DELIVERY_MIN, ESTIMATED_TAKEOUT_MIN } from './constants'

interface MenuStepProps {
  isDark: boolean
  isOpenNow: boolean
  orderType: OrderType
  deliveryZone: { name: string; deliveryFee: number; freeDeliveryAbove: number; estimatedMinutes: number; minOrderAmount: number } | null
  currentMenu: { categories: Category[] } | undefined
  activeCategory: string
  setActiveCategory: (_id: string) => void
  filteredItems: MenuItem[]
  cart: CartItem[]
  addToCart: (_item: MenuItem, _modifiers?: Modifier[], _notes?: string) => void
  setShowItemDetail: (_item: MenuItem | null) => void
  setItemNotes: (_notes: string) => void
  setSelectedMods: (_mods: Modifier[]) => void
  getDeliveryFee: () => number
  getMinOrderAmount: () => number
  getEstimatedMinutes: () => number
  total: number
  cartItemCount: number
  setStep: (_step: 'menu' | 'cart' | 'details' | 'payment' | 'confirmation') => void
}

export const MenuStep = memo(function MenuStep({
  isDark, isOpenNow, orderType, deliveryZone, currentMenu, activeCategory, setActiveCategory,
  filteredItems, cart, addToCart, setShowItemDetail, setItemNotes, setSelectedMods,
  getDeliveryFee, getMinOrderAmount, getEstimatedMinutes, total, cartItemCount, setStep,
}: MenuStepProps) {
  return (
    <main className="max-w-4xl mx-auto px-4 pb-28">
      {/* Pasica za zaprto */}
      {!isOpenNow && (
        <div className={`mt-4 p-3 rounded-xl ${isDark ? 'bg-red-900/30 border border-red-800' : 'bg-red-50 border border-red-200'} text-sm`}>
          <div className="flex items-center gap-2">
            <span>🔴</span>
            <span className="font-bold text-red-700">Trenutno smo zaprti. Naročila bodo sprejeta ko odpremo.</span>
          </div>
        </div>
      )}

      {/* Info pasica */}
      <div className={`mt-4 p-3 rounded-xl ${isDark ? 'bg-blue-900/30 border border-blue-800' : 'bg-blue-50 border border-blue-200'} text-sm`}>
        <div className="flex items-center gap-2">
          <span>{orderType === 'delivery' ? '🚗' : '🛍'}</span>
          <span className={isDark ? 'text-blue-300' : 'text-blue-700'}>
            {orderType === 'delivery'
              ? deliveryZone
                ? `Dostava (${deliveryZone.name}) ${getDeliveryFee().toFixed(2)} € • Min. ${getMinOrderAmount().toFixed(2)} € • ${getEstimatedMinutes()}-${getEstimatedMinutes() + 15} min${deliveryZone.freeDeliveryAbove > 0 ? ` • Brezplačno nad €${deliveryZone.freeDeliveryAbove.toFixed(2)}` : ''}`
                : `Dostava ${DEFAULT_DELIVERY_FEE.toFixed(2)} € • Min. naročilo ${DEFAULT_MIN_ORDER.toFixed(2)} € • ${ESTIMATED_DELIVERY_MIN}-${ESTIMATED_DELIVERY_MIN + 15} min`
              : `Prevzem na lokaciji • ${ESTIMATED_TAKEOUT_MIN}-${ESTIMATED_TAKEOUT_MIN + 10} min`}
          </span>
        </div>
      </div>

      {/* Zavihki kategorij */}
      {currentMenu && (
        <nav className="mt-4 flex gap-2 overflow-x-auto pb-2" aria-label="Kategorije menija">
          {currentMenu.categories.map(cat => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`flex-shrink-0 px-4 py-2 rounded-xl text-sm font-semibold transition ${
                activeCategory === cat.id
                  ? 'bg-blue-600 text-white shadow-md'
                  : `${isDark ? 'bg-gray-800 text-gray-400' : 'bg-white text-gray-600 shadow-sm'}`
              }`}
            >
              {cat.icon} {cat.name}
            </button>
          ))}
        </nav>
      )}

      {/* Artikli menija */}
      <div className="mt-4 space-y-3">
        {filteredItems.map(item => {
          const allergenNums = item.allergens ? item.allergens.split(',').filter(Boolean) : []
          const inCart = cart.filter(c => c.menuItem.id === item.id).reduce((s, c) => s + c.quantity, 0)
          const priceWithVat = item.price * (1 + item.vatRate / 100)

          return (
            <div
              key={item.id}
              className={`${isDark ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-100'} rounded-2xl border shadow-sm flex overflow-hidden cursor-pointer hover:shadow-md transition`}
              onClick={() => { setShowItemDetail(item); setItemNotes(''); setSelectedMods([]) }}
            >
              {item.image ? (
                <div className="flex-shrink-0 w-24 h-28">
                  <img src={item.image} alt={item.name} className="w-full h-full object-cover" loading="lazy" />
                </div>
              ) : (
                <div className={`flex-shrink-0 w-24 h-28 flex items-center justify-center ${isDark ? 'bg-gray-800' : 'bg-blue-50'}`}>
                  <span className="text-3xl">🍽</span>
                </div>
              )}
              <div className="flex-1 p-3 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-bold text-sm leading-tight">{item.name}</h3>
                  {inCart > 0 && (
                    <span className="flex-shrink-0 bg-blue-600 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
                      {inCart}
                    </span>
                  )}
                </div>
                {item.description && (
                  <p className={`text-xs mt-0.5 line-clamp-2 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{item.description}</p>
                )}
                {allergenNums.length > 0 && (
                  <div className="flex flex-wrap gap-0.5 mt-1">
                    {allergenNums.slice(0, 5).map(a => {
                      const ad = ALLERGEN_DATA[a.trim()]
                      return ad ? <span key={a} className="text-[9px]" title={ad.label}>{ad.icon}</span> : null
                    })}
                  </div>
                )}
                <div className="flex items-end justify-between gap-2 mt-2">
                  <span className={`font-bold ${isDark ? 'text-blue-400' : 'text-blue-700'}`}>€{priceWithVat.toFixed(2)}</span>
                  <button
                    onClick={(e) => { e.stopPropagation(); addToCart(item) }}
                    className="bg-blue-600 text-white rounded-xl p-2 shadow-md hover:bg-blue-700 active:scale-90 transition"
                    aria-label={`Dodaj ${item.name} v košarico`}
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Plavajoča vrstica košarice */}
      {cartItemCount > 0 && (
        <div className="fixed bottom-4 left-4 right-4 z-30 max-w-4xl mx-auto">
          <button
            onClick={() => setStep('cart')}
            className="w-full bg-blue-600 text-white py-4 px-6 rounded-2xl shadow-2xl shadow-blue-600/30 flex items-center justify-between font-bold hover:bg-blue-700 transition"
          >
            <span className="flex items-center gap-2">
              <span className="bg-white/20 rounded-lg px-2 py-0.5 text-sm">{cartItemCount}</span>
              Košarica
            </span>
            <span>€{total.toFixed(2)}</span>
          </button>
        </div>
      )}
    </main>
  )
})
