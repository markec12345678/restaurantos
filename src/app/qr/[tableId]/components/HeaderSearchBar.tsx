'use client'

import { memo } from 'react'
import { Search, X } from 'lucide-react'
import type { TranslationValue } from '../translations'

// =====================================================================
// QR Menu — Search Bar Component
// =====================================================================

interface HeaderSearchBarProps {
  t: TranslationValue
  searchQuery: string
  setSearchQueryDirect: (_query: string) => void
}

export const HeaderSearchBar = memo(function HeaderSearchBar({
  t,
  searchQuery,
  setSearchQueryDirect,
}: HeaderSearchBarProps) {
  return (
    <div className="mt-3 relative">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
      <input
        type="text"
        value={searchQuery}
        onChange={e => setSearchQueryDirect(e.target.value)}
        placeholder={t.search}
        className="w-full pl-9 pr-9 py-2 text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-shadow"
      />
      {searchQuery && (
        <button
          onClick={() => setSearchQueryDirect('')}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  )
})
