'use client'

// ═══════════════════════════════════════════════════════════════
// RestaurantOS — Menu Engineering Matrix
// Profitability (gross profit %) vs Popularity (prodaja kolicina)
// 4 kvadranti: Star, Puzzle, Plowhorse, Dog
// Toast POS + Lightspeed standard za optimizacijo menija
// ═══════════════════════════════════════════════════════════════

import dynamic from 'next/dynamic'
import { Skeleton } from '@/components/ui/skeleton'
import { memo } from 'react'
import { useEngineeringData } from './menu-engineering/use-engineering-data'

// ─── Lazy-loaded podkomponente ─────────────────────────────────
const MatrixHeader = dynamic(
  () => import('./menu-engineering/MatrixHeader').then(m => m.MatrixHeader),
  { ssr: false },
)
const QuadrantSummaryCards = dynamic(
  () => import('./menu-engineering/QuadrantSummaryCards').then(m => m.QuadrantSummaryCards),
  { ssr: false },
)
const ScatterView = dynamic(
  () => import('./menu-engineering/ScatterView').then(m => m.ScatterView),
  { ssr: false },
)
const TableView = dynamic(
  () => import('./menu-engineering/TableView').then(m => m.TableView),
  { ssr: false },
)

export const MenuEngineeringMatrix = memo(function MenuEngineeringMatrix() {
  const {
    data,
    isLoading,
    categories,
    filteredItems,
    chartData,
    categoryFilter,
    setCategoryFilter,
    viewMode,
    setViewMode,
  } = useEngineeringData()

  // ─── Nalagalni skeleton ─────────────────────────────────────
  if (isLoading) {
    return (
      <div className="h-full p-4 space-y-4">
        <div className="grid grid-cols-4 gap-3">
          {[...Array(4)].map((_unused, i) => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-96" />
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <MatrixHeader
        totalItems={data?.totalItems || 0}
        categoryFilter={categoryFilter}
        onCategoryFilterChange={setCategoryFilter}
        categories={categories}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
      />

      {/* Kvadrant kartice */}
      <QuadrantSummaryCards data={data ?? undefined} />

      {/* Vsebina */}
      <div className="flex-1 overflow-y-auto px-4 pb-4">
        {viewMode === 'matrix' ? (
          <ScatterView
            chartData={chartData}
            medianProfitability={data?.medianProfitability || 50}
            medianPopularity={data?.medianPopularity || 5}
          />
        ) : (
          <TableView filteredItems={filteredItems} />
        )}
      </div>
    </div>
  )
})
