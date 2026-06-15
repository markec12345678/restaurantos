'use client'

import { memo } from 'react'
import { MarginStatsCards } from './MarginStatsCards'
import { MarginTable } from './MarginTable'
import { MarginLegend } from './MarginLegend'
import { MarginFilters } from './MarginFilters'
import type { MarginItem, MarginStats } from './constants'

// ============================================
// TIPI PROPS
// ============================================
interface MarginsTabProps {
  /** Iskalni niz */
  search: string
  /** Posodobi iskalni niz */
  onSearchChange: (_value: string) => void
  /** Filter po meniju */
  filterMenu: string
  /** Posodobi filter po meniju */
  onFilterMenuChange: (_value: string) => void
  /** Filtrirani podatki o maržah */
  filteredMarginData: MarginItem[]
  /** Statistika marž */
  marginStats: MarginStats | null
}

// ============================================
// GLAVNI TAB: PREGLED MARŽ
// ============================================
export const MarginsTab = memo(function MarginsTab({
  search,
  onSearchChange,
  filterMenu,
  onFilterMenuChange,
  filteredMarginData,
  marginStats,
}: MarginsTabProps) {
  return (
    <div className="space-y-4">
      <MarginFilters search={search} onSearchChange={onSearchChange} filterMenu={filterMenu} onFilterMenuChange={onFilterMenuChange} />
      {marginStats && <MarginStatsCards stats={marginStats} />}
      <MarginTable data={filteredMarginData} />
      <MarginLegend />
    </div>
  )
})
