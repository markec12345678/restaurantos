'use client'

import { memo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { CategoryBreakdown } from './types'

// ============================================
// CATEGORY BREAKDOWN TABLE — Izpisek po kategorijah
// ============================================

interface CategoryBreakdownTableProps {
  categories: CategoryBreakdown[]
  totalRevenue: number
  fmt: (_n: number) => string
  fmtPct: (_n: number) => string
}

export const CategoryBreakdownTable = memo(function CategoryBreakdownTable({
  categories,
  totalRevenue,
  fmt,
  fmtPct,
}: CategoryBreakdownTableProps) {
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
