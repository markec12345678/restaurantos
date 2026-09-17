'use client'

import { memo } from 'react'

// --- Props ---

interface KitchenFilterTabsProps {
  filterStatus: 'all' | 'pending' | 'in-progress' | 'ready'
  onFilterStatusChange: (_status: 'all' | 'pending' | 'in-progress' | 'ready') => void
  filteredOrdersCount: number
  pendingOrdersCount: number
  inProgressOrdersCount: number
  /** R26-b: vidna ready naročila (pick-up shelf) */
  readyOrdersCount: number
}

// --- Komponenta ---

export const KitchenFilterTabs = memo(function KitchenFilterTabs({
  filterStatus,
  onFilterStatusChange,
  filteredOrdersCount,
  pendingOrdersCount,
  inProgressOrdersCount,
  readyOrdersCount,
}: KitchenFilterTabsProps) {
  return (
    <div className="px-4 pb-2 flex gap-1.5">
      {[
        { value: 'all', label: 'Vsa naročila', count: filteredOrdersCount },
        { value: 'pending', label: 'Čakajoča', count: pendingOrdersCount },
        { value: 'in-progress', label: 'V pripravi', count: inProgressOrdersCount },
        { value: 'ready', label: 'Pripravljeno', count: readyOrdersCount, accent: 'emerald' },
      ].map(tab => (
        <button
          key={tab.value}
          onClick={() => onFilterStatusChange(tab.value as 'all' | 'pending' | 'in-progress' | 'ready')}
          className={`px-3 py-1 rounded-md text-xs font-semibold transition-all touch-manipulation pointer-coarse:px-4 pointer-coarse:py-2.5 pointer-coarse:text-sm active:scale-95 ${
            filterStatus === tab.value
              ? tab.value === 'ready'
                ? 'bg-emerald-600 text-white'
                : 'bg-primary text-primary-foreground'
              : tab.value === 'ready' && tab.count > 0
                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 hover:bg-emerald-200 dark:hover:bg-emerald-900/60'
                : 'bg-muted text-muted-foreground hover:bg-accent'
          }`}
        >
          {tab.label} ({tab.count})
        </button>
      ))}
    </div>
  )
})
