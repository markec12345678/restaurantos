'use client'

import { memo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface TableDetailRow {
  tableNumber: number
  area: string
  orderCount: number
  revenue: number
  avgOrder: number
  tips: number
}

interface TableRevenueDetailsTableProps {
  tables: TableDetailRow[]
  areaLabels: Record<string, string>
  fmt: (_n: number) => string
}

export const TableRevenueDetailsTable = memo(function TableRevenueDetailsTable({
  tables,
  areaLabels,
  fmt,
}: TableRevenueDetailsTableProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">Podrobnosti po mizah</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="border rounded-lg overflow-hidden max-h-96 overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-muted/50">
              <tr className="border-b">
                <th className="text-left p-3 font-medium">Miza</th>
                <th className="text-left p-3 font-medium">Cona</th>
                <th className="text-right p-3 font-medium">Naročila</th>
                <th className="text-right p-3 font-medium">Prihodek</th>
                <th className="text-right p-3 font-medium">Povp.</th>
                <th className="text-right p-3 font-medium">Napitnine</th>
              </tr>
            </thead>
            <tbody>
              {tables.map((t, idx) => (
                <tr key={idx} className="border-b hover:bg-muted/30">
                  <td className="p-3 font-bold">Miza {t.tableNumber}</td>
                  <td className="p-3">{areaLabels[t.area] || t.area}</td>
                  <td className="p-3 text-right">{t.orderCount}</td>
                  <td className="p-3 text-right font-semibold text-emerald-600">{fmt(t.revenue)}</td>
                  <td className="p-3 text-right">{fmt(t.avgOrder)}</td>
                  <td className="p-3 text-right text-amber-600">{fmt(t.tips)}</td>
                </tr>
              ))}
              {tables.length === 0 && (
                <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">Ni naročil za mizami</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
})
