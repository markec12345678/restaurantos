'use client'

import { memo } from 'react'
import type { RestaurantSettingsRow, WeeklyHoursRow } from '@/lib/types'
import type { LocationInfo, OrderType, CheckoutStep } from './types'

interface OrderHeaderProps {
  settings: RestaurantSettingsRow | null
  isDark: boolean
  setIsDark: (_dark: boolean) => void
  step: CheckoutStep
  setStep: (_step: CheckoutStep) => void
  cartItemCount: number
  orderType: OrderType
  setOrderType: (_type: OrderType) => void
  locations: LocationInfo[]
  selectedLocation: string
  setSelectedLocation: (_id: string) => void
  isOpenNow: boolean
  showHours: boolean
  setShowHours: (_show: boolean) => void
  weeklyHours: WeeklyHoursRow[]
  searchQuery: string
  setSearchQuery: (_q: string) => void
}

export const OrderHeader = memo(function OrderHeader({
  settings, isDark, setIsDark, step, setStep, cartItemCount,
  orderType, setOrderType, locations, selectedLocation, setSelectedLocation,
  isOpenNow, showHours, setShowHours, weeklyHours,
  searchQuery, setSearchQuery,
}: OrderHeaderProps) {
  return (
    <header className={`sticky top-0 z-40 ${isDark ? 'bg-gray-900/90' : 'bg-white/80'} backdrop-blur-xl border-b ${isDark ? 'border-gray-800' : 'border-blue-100'} shadow-sm`}>
      <div className="max-w-4xl mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className={`text-xl font-bold ${isDark ? 'text-blue-400' : 'text-blue-900'}`}>
              {settings?.name || 'RestaurantOS'}
            </h1>
            <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>Online naročanje</p>
          </div>
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
        </div>

        {/* Izbira vrste naročila */}
        {step === 'menu' && (
          <div className="mt-3 flex gap-2">
            <button
              onClick={() => setOrderType('delivery')}
              className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition ${
                orderType === 'delivery'
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                  : `${isDark ? 'bg-gray-800 text-gray-400' : 'bg-blue-50 text-blue-600'}`
              }`}
            >
              🚗 Dostava
            </button>
            <button
              onClick={() => setOrderType('takeout')}
              className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition ${
                orderType === 'takeout'
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                  : `${isDark ? 'bg-gray-800 text-gray-400' : 'bg-blue-50 text-blue-600'}`
              }`}
            >
              🛍 Prevzem
            </button>
          </div>
        )}

        {/* Izbira lokacije */}
        {step === 'menu' && locations.length > 1 && (
          <div className="mt-2">
            <select
              value={selectedLocation}
              onChange={e => setSelectedLocation(e.target.value)}
              className={`w-full px-4 py-2 rounded-xl text-sm ${isDark ? 'bg-gray-800 border-gray-700 text-white' : 'bg-white border-blue-200'} border`}
            >
              {locations.map(loc => (
                <option key={loc.id} value={loc.id}>
                  📍 {loc.name} — {loc.address}, {loc.city} {loc.isOpen ? '(Odprto)' : '(Zaprto)'}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Indikator delovnega časa */}
        {step === 'menu' && (
          <div className="mt-2 flex items-center gap-2">
            <span className={`w-2.5 h-2.5 rounded-full ${isOpenNow ? 'bg-green-500' : 'bg-red-500'}`} />
            <span className={`text-xs font-medium ${isOpenNow ? 'text-green-700' : 'text-red-600'}`}>
              {isOpenNow ? 'Trenutno odprto' : 'Trenutno zaprto'}
            </span>
            <button
              onClick={() => setShowHours(!showHours)}
              className="text-xs text-blue-600 underline ml-1"
            >
              Delovni čas
            </button>
          </div>
        )}

        {/* Delovni čas popup */}
        {showHours && (
          <div className={`mt-2 p-3 rounded-xl text-xs ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} border`}>
            {weeklyHours.map((h, idx) => (
              <div key={idx} className="flex justify-between py-1">
                <span className={h.isClosed ? 'text-gray-400' : 'font-medium'}>{h.day}</span>
                <span className={h.isClosed ? 'text-red-400' : 'text-gray-600'}>
                  {h.isClosed ? 'Zaprto' : `${h.openTime} - ${h.closeTime}`}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Iskanje */}
        {step === 'menu' && (
          <div className="mt-3 relative">
            <svg className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${isDark ? 'text-gray-500' : 'text-blue-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="search"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Išči po meniju..."
              className={`w-full pl-9 pr-4 py-2.5 rounded-xl text-sm ${isDark ? 'bg-gray-800 border-gray-700 text-white' : 'bg-white/80 border-blue-200 text-gray-900'} border focus:outline-none focus:ring-2 focus:ring-blue-500/50`}
            />
          </div>
        )}

        {/* Indikator napredka */}
        {step !== 'menu' && step !== 'confirmation' && (
          <div className="mt-3 flex items-center gap-1 text-xs">
            {['menu', 'cart', 'details', 'payment'].map((s, i) => (
              <div key={s} className="flex items-center gap-1">
                {i > 0 && <div className={`w-6 h-0.5 ${step === s || ['cart','details','payment'].indexOf(step) >= i ? 'bg-blue-600' : 'bg-gray-300'}`} />}
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${
                  step === s ? 'bg-blue-600 text-white' : ['cart','details','payment'].indexOf(step) > i ? 'bg-green-500 text-white' : `${isDark ? 'bg-gray-700 text-gray-400' : 'bg-gray-200 text-gray-500'}`
                }`}>
                  {['cart','details','payment'].indexOf(step) > i ? '✓' : i + 1}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </header>
  )
})
