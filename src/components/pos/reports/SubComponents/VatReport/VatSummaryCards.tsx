'use client'

import { memo } from 'react'

// ============================================
// DDV POVZETEK — Skupna osnova, DDV, z DDV, naročila
// ============================================

interface VatSummaryCardsProps {
  summary: {
    totalBase: number
    totalVat: number
    totalWithVat: number
    completedOrders: number
  }
  fmt: (_n: number) => string
}

export const VatSummaryCards = memo(function VatSummaryCards({ summary, fmt }: VatSummaryCardsProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <div className="text-center p-4 rounded-lg bg-blue-50 dark:bg-blue-900/20 border">
        <p className="text-xs text-muted-foreground mb-1">Skupna osnova</p>
        <p className="text-xl font-bold text-blue-600">{fmt(summary.totalBase)}</p>
      </div>
      <div className="text-center p-4 rounded-lg bg-red-50 dark:bg-red-900/20 border">
        <p className="text-xs text-muted-foreground mb-1">Skupni DDV</p>
        <p className="text-xl font-bold text-red-600">{fmt(summary.totalVat)}</p>
      </div>
      <div className="text-center p-4 rounded-lg bg-green-50 dark:bg-green-900/20 border">
        <p className="text-xs text-muted-foreground mb-1">Z DDV</p>
        <p className="text-xl font-bold text-green-600">{fmt(summary.totalWithVat)}</p>
      </div>
      <div className="text-center p-4 rounded-lg bg-purple-50 dark:bg-purple-900/20 border">
        <p className="text-xs text-muted-foreground mb-1">Naročila</p>
        <p className="text-xl font-bold text-purple-600">{summary.completedOrders}</p>
      </div>
    </div>
  )
})
