'use client'

import { memo } from 'react'
import { DollarSign, ShoppingBag, Wallet, UtensilsCrossed } from 'lucide-react'

interface TableRevenueSummaryCardsProps {
  activeTables: number
  totalRevenue: number
  totalOrders: number
  totalTips: number
  fmt: (_n: number) => string
}

export const TableRevenueSummaryCards = memo(function TableRevenueSummaryCards({
  activeTables,
  totalRevenue,
  totalOrders,
  totalTips,
  fmt,
}: TableRevenueSummaryCardsProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <div className="text-center p-4 rounded-lg bg-blue-50 dark:bg-blue-900/20 border">
        <UtensilsCrossed className="h-5 w-5 mx-auto text-blue-600 mb-1" />
        <p className="text-xs text-muted-foreground mb-1">Aktivne mize</p>
        <p className="text-2xl font-bold text-blue-600">{activeTables}</p>
      </div>
      <div className="text-center p-4 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border">
        <DollarSign className="h-5 w-5 mx-auto text-emerald-600 mb-1" />
        <p className="text-xs text-muted-foreground mb-1">Prihodek mize</p>
        <p className="text-2xl font-bold text-emerald-600">{fmt(totalRevenue)}</p>
      </div>
      <div className="text-center p-4 rounded-lg bg-purple-50 dark:bg-purple-900/20 border">
        <ShoppingBag className="h-5 w-5 mx-auto text-purple-600 mb-1" />
        <p className="text-xs text-muted-foreground mb-1">Naročila</p>
        <p className="text-2xl font-bold text-purple-600">{totalOrders}</p>
      </div>
      <div className="text-center p-4 rounded-lg bg-amber-50 dark:bg-amber-900/20 border">
        <Wallet className="h-5 w-5 mx-auto text-amber-600 mb-1" />
        <p className="text-xs text-muted-foreground mb-1">Napitnine</p>
        <p className="text-2xl font-bold text-amber-600">{fmt(totalTips)}</p>
      </div>
    </div>
  )
})
