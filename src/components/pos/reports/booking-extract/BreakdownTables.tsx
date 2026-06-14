'use client'

import { memo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { FinancialData, CategoryBreakdown, ItemBreakdown } from './types'

// ============================================
// IZPISKOVI PO KATEGORIJAH IN ARTIKLIH
// ============================================

interface BreakdownTablesProps {
  fin: FinancialData
  fmt: (_n: number) => string
  fmtPct: (_n: number) => string
}

/** Izpisek po kategorijah */
const CategoryBreakdownTable = memo(function CategoryBreakdownTable({
  categories,
  totalRevenue,
  fmt,
  fmtPct,
}: {
  categories: CategoryBreakdown[]
  totalRevenue: number
  fmt: (_n: number) => string
  fmtPct: (_n: number) => string
}) {
  const totalQty = categories.reduce((s, c) => s + c.quantity, 0)
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">Izpisek po kategorijah</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50 border-b">
                <th className="text-left p-3 font-medium">Kategorija</th>
                <th className="text-right p-3 font-medium">Količina</th>
                <th className="text-right p-3 font-medium">Prihodek</th>
                <th className="text-right p-3 font-medium">Delez</th>
              </tr>
            </thead>
            <tbody>
              {categories.map((cat, idx) => (
                <tr key={idx} className="border-b hover:bg-muted/30">
                  <td className="p-3">{cat.category}</td>
                  <td className="p-3 text-right">{cat.quantity}</td>
                  <td className="p-3 text-right font-medium">{fmt(cat.revenue)}</td>
                  <td className="p-3 text-right">{fmtPct(totalRevenue > 0 ? (cat.revenue / totalRevenue) * 100 : 0)}</td>
                </tr>
              ))}
              <tr className="bg-muted/50 font-bold">
                <td className="p-3">SKUPAJ</td>
                <td className="p-3 text-right">{totalQty}</td>
                <td className="p-3 text-right">{fmt(totalRevenue)}</td>
                <td className="p-3 text-right">100%</td>
              </tr>
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
})

/** Izpisek po artiklih */
const ItemBreakdownTable = memo(function ItemBreakdownTable({
  items,
  fmt,
}: {
  items: ItemBreakdown[]
  fmt: (_n: number) => string
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">Izpisek po artiklih</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="border rounded-lg overflow-hidden max-h-96 overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-muted/50">
              <tr className="border-b">
                <th className="text-left p-3 font-medium">Artikel</th>
                <th className="text-left p-3 font-medium">Kategorija</th>
                <th className="text-right p-3 font-medium">Kol.</th>
                <th className="text-right p-3 font-medium">Cena</th>
                <th className="text-right p-3 font-medium">Prihodek</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, idx) => (
                <tr key={idx} className="border-b hover:bg-muted/30">
                  <td className="p-3">{item.name}</td>
                  <td className="p-3 text-muted-foreground">{item.category}</td>
                  <td className="p-3 text-right">{item.quantity}</td>
                  <td className="p-3 text-right">{fmt(item.avgPrice)}</td>
                  <td className="p-3 text-right font-medium">{fmt(item.revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
})

/** Statistika naročil */
const OrderStats = memo(function OrderStats({
  fin,
  fmt,
}: {
  fin: FinancialData
  fmt: (_n: number) => string
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">Statistika naročil</CardTitle>
      </CardHeader>
      <CardContent>
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
      </CardContent>
    </Card>
  )
})

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
      <OrderStats
        fin={fin}
        fmt={fmt}
      />
    </>
  )
})
