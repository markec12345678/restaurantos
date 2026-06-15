'use client'

import { memo } from 'react'
import type { TranslationValue } from '../translations'
import type { MenuType } from '../types'

// =====================================================================
// QR Menu — Menu Tabs Component (food/drinks switcher)
// =====================================================================

interface MenuTabsProps {
  t: TranslationValue
  menus: MenuType[]
  activeMenuId: string
  setActiveMenuId: (_id: string) => void
  setActiveSuperGroup: (_group: string) => void
  setSearchQuery: (_query: string) => void
  setActiveCategoryId: (_id: string) => void
}

export const MenuTabs = memo(function MenuTabs({
  t,
  menus,
  activeMenuId,
  setActiveMenuId,
  setActiveSuperGroup,
  setSearchQuery,
  setActiveCategoryId,
}: MenuTabsProps) {
  if (menus.length <= 1) return null

  return (
    <div className="flex gap-2 mt-3">
      {menus.map(menu => (
        <button
          key={menu.id}
          onClick={() => {
            setActiveMenuId(menu.id)
            setActiveSuperGroup('all')
            setSearchQuery('')
            const firstCat = menu.categories?.[0]
            if (firstCat) setActiveCategoryId(firstCat.id)
          }}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-all ${
            activeMenuId === menu.id
              ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/25'
              : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-amber-50 dark:hover:bg-gray-700'
          }`}
        >
          <span>{menu.icon}</span>
          {menu.name === 'Hrana' ? t.food : menu.name === 'Pijača' ? t.drinks : menu.name}
        </button>
      ))}
    </div>
  )
})
