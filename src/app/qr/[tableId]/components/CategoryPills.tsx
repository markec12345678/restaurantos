'use client'

import { memo } from 'react'
import type { MenuType } from '../types'

// =====================================================================
// QR Menu — Category Pills Component
// =====================================================================

interface CategoryPillsProps {
  categories: MenuType['categories']
  isSearching: boolean
  activeCategoryId: string
  setActiveCategoryIdDirect: (_id: string) => void
}

export const CategoryPills = memo(function CategoryPills({
  categories,
  isSearching,
  activeCategoryId,
  setActiveCategoryIdDirect,
}: CategoryPillsProps) {
  if (categories.length <= 1 || isSearching) return null

  return (
    <div className="max-w-3xl mx-auto px-4 pb-2">
      <div className="flex gap-2 overflow-x-auto scrollbar-hide">
        {categories.map(cat => (
          <button
            key={cat.id}
            onClick={() => setActiveCategoryIdDirect(cat.id)}
            className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all whitespace-nowrap ${
              activeCategoryId === cat.id
                ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
            }`}
          >
            {cat.icon} {cat.name}
          </button>
        ))}
      </div>
    </div>
  )
})
