'use client'

import { memo } from 'react'
import dynamic from 'next/dynamic'
import type { FinancialData } from './types'

// Lazy-loaded podkomponente
const CategoryBreakdownTable = dynamic(() => import('./CategoryBreakdownTable').then(m => ({ default: m.CategoryBreakdownTable })), { ssr: false })
const ItemBreakdownTable = dynamic(() => import('./ItemBreakdownTable').then(m => ({ default: m.ItemBreakdownTable })), { ssr: false })

// ============================================
// STATISTIKA NAROČIL
// ============================================
const OrderStats = memo(function OrderStats({
  fin,
  fmt,
}: {
  fin: FinancialData
  fmt: (_n: number) => string
}) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <div className="text-center p-3 rounded-lg border">
        <p className="text-xs text-muted-foreground">Vseh naročil</p>
        <p className="text-xl font-bold">{fin.summary.totalOrdersCount}</p>
      </div>
      <div className="text-center p-3 rounded-lg border">
        <p className="text-xs text-muted-foreground">Zaključenih</p>
        <p className="text-xl font-bold text-green-600">{fin.summary.completedCount}</p>
      </div>
      <div className="text-center p-3 rounded-lg border">
        <p className="text-xs text-muted-foreground">Preklicanih</p>
        <p className="text-xl font-bold text-red-600">{fin.summary.cancelledCount}</p>
      </div>
      <div className="text-center p-3 rounded-lg border">
        <p className="text-xs text-muted-foreground">Povpr. vrednost</p>
        <p className="text-xl font-bold">{fmt(fin.summary.avgOrderValue)}</p>
      </div>
    </div>
  )
})

// ============================================
// IZPISKOVI PO KATEGORIJAH IN ARTIKLIH
// ============================================

interface BreakdownTablesProps {
  fin: FinancialData
  fmt: (_n: number) => string
  fmtPct: (_n: number) => string
}

export const BreakdownTables = memo(function BreakdownTables({ fin, fmt, fmtPct }: BreakdownTablesProps) {
  return (
    <>
      <CategoryBreakdownTable
        categories={fin.categoryBreakdown}
        totalRevenue={fin.summary.totalRevenue}
        fmt={fmt}
        fmtPct={fmtPct}
      />
      <ItemBreakdownTable
        items={fin.itemBreakdown}
        fmt={fmt}
      />
      <OrderStats fin={fin} fmt={fmt} />
    </>
  )
})
