'use client'

import { memo } from 'react'

// =====================================================================
// RESTAURANTOS ORDER TRACKING — Search Form Component
// =====================================================================

interface SearchFormProps {
  orderNumber: string
  phone: string
  loading: boolean
  error: string
  onOrderNumberChange: (_val: string) => void
  onPhoneChange: (_val: string) => void
  onSearch: () => void
}

export const SearchForm = memo(function SearchForm({
  orderNumber,
  phone,
  loading,
  error,
  onOrderNumberChange,
  onPhoneChange,
  onSearch,
}: SearchFormProps) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
      <div className="text-center">
        <span className="text-4xl block mb-2">📦</span>
        <h2 className="text-xl font-bold text-gray-900">Sledi svojemu naročilu</h2>
        <p className="text-sm text-gray-500 mt-1">Vnesi številko naročila in telefonsko številko</p>
      </div>
      <div className="space-y-3">
        <input
          type="text"
          placeholder="Številka naročila (npr. 42)"
          value={orderNumber}
          onChange={e => onOrderNumberChange(e.target.value)}
          className="w-full px-4 py-3 rounded-xl text-sm bg-white border border-gray-200 focus:ring-2 focus:ring-blue-500/50 focus:outline-none"
        />
        <input
          type="tel"
          placeholder="Telefonska številka"
          value={phone}
          onChange={e => onPhoneChange(e.target.value)}
          className="w-full px-4 py-3 rounded-xl text-sm bg-white border border-gray-200 focus:ring-2 focus:ring-blue-500/50 focus:outline-none"
        />
      </div>
      <button
        onClick={onSearch}
        disabled={!orderNumber || !phone || loading}
        className="w-full py-3 rounded-xl font-semibold bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            Iskanje...
          </span>
        ) : 'Poišči naročilo'}
      </button>
      {error && (
        <p className="text-center text-sm text-red-600 bg-red-50 rounded-xl p-3">{error}</p>
      )}
    </div>
  )
})
