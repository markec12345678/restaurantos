'use client'

import { memo } from 'react'
import { UtensilsCrossed, Bell } from 'lucide-react'
import { LanguageSelector } from './LanguageSelector'
import type { TranslationValue } from '../translations'
import type { Locale } from '../translations'

// =====================================================================
// QR Menu — Header Top Bar Component (logo + waiter + language)
// =====================================================================

interface HeaderTopBarProps {
  t: TranslationValue
  locale: Locale
  setLocale: (_locale: Locale) => void
  localeOpen: boolean
  setLocaleOpen: (_open: boolean) => void
  restaurantName: string | undefined
  tableId: string
  callWaiter: () => void
  waiterCooldown: boolean
}

export const HeaderTopBar = memo(function HeaderTopBar({
  t,
  locale,
  setLocale,
  localeOpen,
  setLocaleOpen,
  restaurantName,
  tableId,
  callWaiter,
  waiterCooldown,
}: HeaderTopBarProps) {
  return (
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

        <LanguageSelector
          locale={locale}
          setLocale={setLocale}
          localeOpen={localeOpen}
          setLocaleOpen={setLocaleOpen}
        />
      </div>
    </div>
  )
})
