'use client'

import { memo } from 'react'

// --- Props ---

interface KitchenFilterTabsProps {
  filterStatus: 'all' | 'pending' | 'in-progress'
  onFilterStatusChange: (_status: 'all' | 'pending' | 'in-progress') => void
  filteredOrdersCount: number
  pendingOrdersCount: number
  inProgressOrdersCount: number
}

// --- Komponenta ---

export const KitchenFilterTabs = memo(function KitchenFilterTabs({
  filterStatus,
  onFilterStatusChange,
  filteredOrdersCount,
  pendingOrdersCount,
  inProgressOrdersCount,
}: KitchenFilterTabsProps) {
  return (
    <div className="px-4 pb-2 flex gap-1.5">
      {[
        { value: 'all', label: 'Vsa naročila', count: filteredOrdersCount },
        { value: 'pending', label: 'Čakajoča', count: pendingOrdersCount },
        { value: 'in-progress', label: 'V pripravi', count: inProgressOrdersCount },
      ].map(tab => (
        <button
          key={tab.value}
          onClick={() => onFilterStatusChange(tab.value as 'all' | 'pending' | 'in-progress')}
          className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors ${
            filterStatus === tab.value
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted text-muted-foreground hover:bg-accent'
          }`}
        >
          {tab.label} ({tab.count})
        </button>
      ))}
    </div>
  )
})
