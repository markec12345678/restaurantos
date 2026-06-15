'use client'

import { memo } from 'react'
import { drinkSuperGroups } from '../types'
import type { TranslationValue } from '../translations'
import type { MenuType } from '../types'

// =====================================================================
// QR Menu — Super-Group Tabs Component (drinks sub-categories)
// =====================================================================

interface SuperGroupTabsProps {
  t: TranslationValue
  isDrinksMenu: boolean
  isSearching: boolean
  activeSuperGroup: string
  setActiveSuperGroup: (_group: string) => void
  allCategories: MenuType['categories']
  setActiveCategoryIdDirect: (_id: string) => void
  getSuperGroupForCategory: (_catName: string) => string | null
}

export const SuperGroupTabs = memo(function SuperGroupTabs({
  t,
  isDrinksMenu,
  isSearching,
  activeSuperGroup,
  setActiveSuperGroup,
  allCategories,
  setActiveCategoryIdDirect,
  getSuperGroupForCategory,
}: SuperGroupTabsProps) {
  if (!isDrinksMenu || isSearching) return null

  return (
    <div className="max-w-3xl mx-auto px-4 pb-1">
      <div className="flex gap-2 overflow-x-auto scrollbar-hide">
        <button
          onClick={() => {
            setActiveSuperGroup('all')
            const firstCat = allCategories?.[0]
            if (firstCat) setActiveCategoryIdDirect(firstCat.id)
          }}
          className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all whitespace-nowrap ${
            activeSuperGroup === 'all'
              ? 'bg-amber-500 text-white'
              : 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 hover:bg-amber-200 dark:hover:bg-amber-900/50'
          }`}
        >
          {t.menu}
        </button>
        {drinkSuperGroups.map(sg => (
          <button
            key={sg.id}
            onClick={() => {
              setActiveSuperGroup(sg.id)
              const filtered = allCategories.filter(cat => getSuperGroupForCategory(cat.name) === sg.id)
              if (filtered.length > 0) setActiveCategoryIdDirect(filtered[0].id)
            }}
            className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all whitespace-nowrap ${
              activeSuperGroup === sg.id
                ? 'bg-amber-500 text-white'
                : 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 hover:bg-amber-200 dark:hover:bg-amber-900/50'
            }`}
          >
            {t[sg.id as keyof typeof t] as string}
          </button>
        ))}
      </div>
    </div>
  )
})
