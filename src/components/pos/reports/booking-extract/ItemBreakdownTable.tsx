'use client'

import { memo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { ItemBreakdown } from './types'

// ============================================
// ITEM BREAKDOWN TABLE — Izpisek po artiklih
// ============================================

interface ItemBreakdownTableProps {
  items: ItemBreakdown[]
  fmt: (_n: number) => string
}

export const ItemBreakdownTable = memo(function ItemBreakdownTable({
  items,
  fmt,
}: ItemBreakdownTableProps) {
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
