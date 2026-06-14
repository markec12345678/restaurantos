'use client'

import { memo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { UtensilsCrossed, Globe, Check, Bell, Search, X } from 'lucide-react'
import { locales, drinkSuperGroups } from '../types'
import type { TranslationValue } from '../translations'
import type { Locale } from '../translations'
import type { MenuType } from '../types'

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
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-500 rounded-xl flex items-center justify-center">
              <UtensilsCrossed className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-lg leading-tight">
                {restaurantName || 'RestaurantOS'}
              </h1>
              <p className="text-xs text-muted-foreground">
                {t.forTable} {t.table.toLowerCase()} · <span className="font-semibold text-amber-600">#{tableId.slice(-4)}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Call Waiter Button */}
            <button
              onClick={callWaiter}
              disabled={waiterCooldown}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-full text-sm font-medium transition-colors ${
                waiterCooldown
                  ? 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500 cursor-not-allowed'
                  : 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 hover:bg-amber-200 dark:hover:bg-amber-900/50'
              }`}
              title={t.callWaiter}
            >
              <Bell className={`h-4 w-4 ${waiterCooldown ? 'animate-pulse' : ''}`} />
            </button>

            {/* Language Selector */}
            <div className="relative">
              <button
                onClick={() => setLocaleOpen(!localeOpen)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-sm font-medium hover:bg-amber-200 dark:hover:bg-amber-900/50 transition-colors"
              >
                <Globe className="h-4 w-4" />
                <span>{locales.find(l => l.code === locale)?.flag}</span>
              </button>

              <AnimatePresence>
                {localeOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -10, scale: 0.95 }}
                    className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-900 rounded-xl shadow-xl border border-gray-200 dark:border-gray-800 overflow-hidden z-50"
                  >
                    {locales.map(l => (
                      <button
                        key={l.code}
                        onClick={() => { setLocale(l.code); setLocaleOpen(false) }}
                        className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors ${locale === l.code ? 'bg-amber-50 dark:bg-amber-900/20 font-semibold' : ''}`}
                      >
                        <span className="text-lg">{l.flag}</span>
                        <span>{l.label}</span>
                        {locale === l.code && <Check className="h-4 w-4 ml-auto text-amber-500" />}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* Menu Tabs */}
        {menus.length > 1 && (
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
        )}

        {/* Search Bar */}
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
      </div>

      {/* Super-Group Tabs (drinks menu only) */}
      {isDrinksMenu && !isSearching && (
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
      )}

      {/* Category Pills */}
      {categories.length > 1 && !isSearching && (
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
      )}
    </header>
  )
})
