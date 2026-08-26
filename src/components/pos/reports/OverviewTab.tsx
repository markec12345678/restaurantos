'use client'

import { safeToFixed, safeNum } from '@/lib/safe-format'
import { memo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { StatsCard } from '../StatsCard'
import { DollarSign, ShoppingBag, TrendingUp, BarChart3 } from 'lucide-react'
import { format } from 'date-fns'
import { PIE_COLORS, orderTypeLabels } from './constants'
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'

// ============================================
// ZAVIHEK PREGLED — grafikon prihodka in porazdelitev
// ============================================
export const OverviewTab = memo(function OverviewTab({
  salesData,
  popularData,
  salesLoading,
}: {
  salesData: {
    totalRevenue?: number
    totalOrders?: number
    avgOrderValue?: number
    dailyRevenue?: { date: string; revenue: number }[]
    typeBreakdown?: { type: string; revenue: number }[]
  } | undefined
  popularData: {
    popularItems?: { name: string; quantity: number }[]
  } | undefined
  salesLoading: boolean
}) {
  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          title="Prihodek (30 dni)"
          value={`€${safeToFixed(salesData?.totalRevenue || 0, 2)}`}
          icon={DollarSign}
        />
        <StatsCard
          title="Naročila (30 dni)"
          value={salesData?.totalOrders || 0}
          icon={ShoppingBag}
        />
        <StatsCard
          title="Povpr. naročilo"
          value={`€${safeToFixed(salesData?.avgOrderValue || 0, 2)}`}
          icon={TrendingUp}
        />
        <StatsCard
          title="Top artikli"
          value={popularData?.popularItems?.length || 0}
          icon={BarChart3}
        />
      </div>
      {salesLoading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Skeleton className="h-72" />
          <Skeleton className="h-72" />
        </div>
      ) : (
        <>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Trend prihodka (30 dni)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={salesData?.dailyRevenue || []}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="date" tickFormatter={(v) => format(new Date(v), 'MMM dd')} tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `€${v}`} />
                    <Tooltip formatter={(value: number) => [`€${safeToFixed(value, 2)}`, 'Prihodek']} labelFormatter={(label) => format(new Date(label), 'MMM dd, yyyy')} contentStyle={{ borderRadius: '8px', border: '1px solid var(--border)' }} />
                    <Line type="monotone" dataKey="revenue" stroke="oklch(0.7 0.15 55)" strokeWidth={2} dot={{ fill: 'oklch(0.7 0.15 55)', r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">Najbolj prodajani</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={(popularData?.popularItems || []).slice(0, 8)} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis type="number" tick={{ fontSize: 11 }} />
                      <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 11 }} />
                      <Tooltip formatter={(value: number) => [value, 'Količina']} contentStyle={{ borderRadius: '8px', border: '1px solid var(--border)' }} />
                      <Bar dataKey="quantity" fill="oklch(0.7 0.15 55)" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">Porazdelitev po vrsti</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={salesData?.typeBreakdown || []} dataKey="revenue" nameKey="type" cx="50%" cy="50%" outerRadius={80} label={({ type, percent }: { type: string; percent: number }) => `${orderTypeLabels[type] || type} ${safeToFixed(percent * 100, 0)}%`}>
                        {(salesData?.typeBreakdown || []).map((_entry: unknown, index: number) => (
                          <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: number) => [`€${safeToFixed(value, 2)}`, 'Prihodek']} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </>
  )
})
