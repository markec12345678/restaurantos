'use client'

import { memo } from 'react'
import { HeaderTopBar } from './HeaderTopBar'
import { MenuTabs } from './MenuTabs'
import { HeaderSearchBar } from './HeaderSearchBar'
import { SuperGroupTabs } from './SuperGroupTabs'
import { CategoryPills } from './CategoryPills'
import type { TranslationValue } from '../translations'
import type { Locale } from '../translations'
import type { MenuType } from '../types'

// =====================================================================
// QR Menu — Menu Header (slim shell composing sub-components)
// =====================================================================

interface MenuHeaderProps {
  t: TranslationValue
  locale: Locale
  setLocale: (_locale: Locale) => void
  localeOpen: boolean
  setLocaleOpen: (_open: boolean) => void
  restaurantName: string | undefined
  tableId: string
  menus: MenuType[]
  activeMenuId: string
  setActiveMenuId: (_id: string) => void
  setActiveSuperGroup: (_group: string) => void
  setSearchQuery: (_query: string) => void
  setActiveCategoryId: (_id: string) => void
  callWaiter: () => void
  waiterCooldown: boolean
  searchQuery: string
  setSearchQueryDirect: (_query: string) => void
  isDrinksMenu: boolean
  isSearching: boolean
  activeSuperGroup: string
  allCategories: MenuType['categories']
  categories: MenuType['categories']
  activeCategoryId: string
  setActiveCategoryIdDirect: (_id: string) => void
  getSuperGroupForCategory: (_catName: string) => string | null
}

export const MenuHeader = memo(function MenuHeader({
  t,
  locale,
  setLocale,
  localeOpen,
  setLocaleOpen,
  restaurantName,
  tableId,
  menus,
  activeMenuId,
  setActiveMenuId,
  setActiveSuperGroup,
  setSearchQuery,
  setActiveCategoryId,
  callWaiter,
  waiterCooldown,
  searchQuery,
  setSearchQueryDirect,
  isDrinksMenu,
  isSearching,
  activeSuperGroup,
  allCategories,
  categories,
  activeCategoryId,
  setActiveCategoryIdDirect,
  getSuperGroupForCategory,
}: MenuHeaderProps) {
  return (
    <header className="sticky top-0 z-40 bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl border-b border-amber-200/50 dark:border-gray-800">
      <div className="max-w-3xl mx-auto px-4 py-3">
        <HeaderTopBar
          t={t}
          locale={locale}
          setLocale={setLocale}
          localeOpen={localeOpen}
          setLocaleOpen={setLocaleOpen}
          restaurantName={restaurantName}
          tableId={tableId}
          callWaiter={callWaiter}
          waiterCooldown={waiterCooldown}
        />

        <MenuTabs
          t={t}
          menus={menus}
          activeMenuId={activeMenuId}
          setActiveMenuId={setActiveMenuId}
          setActiveSuperGroup={setActiveSuperGroup}
          setSearchQuery={setSearchQuery}
          setActiveCategoryId={setActiveCategoryId}
        />

        <HeaderSearchBar
          t={t}
          searchQuery={searchQuery}
          setSearchQueryDirect={setSearchQueryDirect}
        />
      </div>

      <SuperGroupTabs
        t={t}
        isDrinksMenu={isDrinksMenu}
        isSearching={isSearching}
        activeSuperGroup={activeSuperGroup}
        setActiveSuperGroup={setActiveSuperGroup}
        allCategories={allCategories}
        setActiveCategoryIdDirect={setActiveCategoryIdDirect}
        getSuperGroupForCategory={getSuperGroupForCategory}
      />

      <CategoryPills
        categories={categories}
        isSearching={isSearching}
        activeCategoryId={activeCategoryId}
        setActiveCategoryIdDirect={setActiveCategoryIdDirect}
      />
    </header>
  )
})
