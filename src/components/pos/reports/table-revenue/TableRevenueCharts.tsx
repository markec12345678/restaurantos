'use client'

import { memo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { UtensilsCrossed } from 'lucide-react'
import { PIE_COLORS } from '../constants'
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'

interface AreaInfo {
  area: string
  tables: unknown[]
  revenue: number
}

interface TableRevenueChartsProps {
  tables: Array<{ tableNumber: number; revenue: number }>
  areas: Record<string, AreaInfo>
  areaLabels: Record<string, string>
}

export const TableRevenueCharts = memo(function TableRevenueCharts({
  tables,
  areas,
  areaLabels,
}: TableRevenueChartsProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <UtensilsCrossed className="h-4 w-4" />
            Prihodek po mizah
          </CardTitle>
        </CardHeader>
        <CardContent>
          {tables.length > 0 ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={tables.slice(0, 15)}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="tableNumber" tick={{ fontSize: 11 }} label={{ value: 'Miza', position: 'insideBottom', offset: -5, fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `€${v}`} />
                  <Tooltip formatter={(value: number) => [`€${value.toFixed(2)}`, 'Prihodek']} contentStyle={{ borderRadius: '8px', border: '1px solid var(--border)' }} />
                  <Bar dataKey="revenue" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="text-center py-12 text-muted-foreground">Ni naročil za mizami v tem obdobju</p>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Prihodek po conah</CardTitle>
        </CardHeader>
        <CardContent>
          {Object.values(areas).length > 0 ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={Object.values(areas)}
                    dataKey="revenue"
                    nameKey="area"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    label={({ area, percent }: { area: string; percent: number }) => `${areaLabels[area] || area} ${(percent * 100).toFixed(0)}%`}
                  >
                    {Object.values(areas).map((_entry: unknown, index: number) => (
                      <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => [`€${value.toFixed(2)}`, 'Prihodek']} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="text-center py-12 text-muted-foreground">Ni podatkov po conah</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
})
