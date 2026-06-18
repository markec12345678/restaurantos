'use client'

import { memo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { TrendingUp } from 'lucide-react'
import { format } from 'date-fns'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import { PIE_COLORS } from './constants'
import type { ChartsSectionProps } from './constants'
import { safeToFixed, safeNum } from '@/lib/safe-format'

/**
 * ChartsSection — prihodek zadnjih 7 dni (stolpčni diagram)
 * in razdelitev po kategorijah (tortni diagram).
 */
export const ChartsSection = memo(function ChartsSection({ dailyRevenue, categoryBreakdown }: ChartsSectionProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* Stolpčni diagram — prihodek 7 dni */}
      <Card className="lg:col-span-2">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Prihodek (zadnjih 7 dni)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dailyRevenue || []}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="date" tickFormatter={(v) => format(new Date(v), 'EEE')} className="text-xs" tick={{ fontSize: 12 }} />
                <YAxis className="text-xs" tick={{ fontSize: 12 }} tickFormatter={(v) => `€${v}`} />
                <Tooltip formatter={(value: number) => [`€${safeToFixed(value, 2)}`, 'Prihodek']} labelFormatter={(label) => format(new Date(label), 'MMM dd, yyyy')} contentStyle={{ borderRadius: '8px', border: '1px solid var(--border)' }} />
                <Bar dataKey="revenue" fill="oklch(0.7 0.15 55)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Tortni diagram — po kategorijah */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2"><TrendingUp className="h-4 w-4" /> Po kategorijah</CardTitle>
        </CardHeader>
        <CardContent>
          {categoryBreakdown?.length > 0 ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={categoryBreakdown} dataKey="revenue" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name} ${safeToFixed(percent * 100, 0)}%`}>
                    {categoryBreakdown.map((_: unknown, index: number) => <Cell key={index} fill={PIE_COLORS[index % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(value: number) => [`€${safeToFixed(value, 2)}`, 'Prihodek']} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">Ni podatkov</div>
          )}
        </CardContent>
      </Card>
    </div>
  )
})
