'use client'

import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { StatsCard } from './StatsCard'
import { DollarSign, ShoppingBag, TrendingUp, UtensilsCrossed } from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useState } from 'react'
import { format, subDays } from 'date-fns'
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'

const PIE_COLORS = ['#f59e0b', '#ef4444', '#10b981', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16']

export function ReportsView() {
  const [dateRange, setDateRange] = useState('7')

  const startDate = format(subDays(new Date(), parseInt(dateRange)), 'yyyy-MM-dd')
  const endDate = format(new Date(), 'yyyy-MM-dd')

  const { data: salesData, isLoading: salesLoading } = useQuery({
    queryKey: ['reports-sales', startDate, endDate],
    queryFn: async () => {
      const res = await fetch(`/api/reports/sales?startDate=${startDate}&endDate=${endDate}`)
      return res.json()
    },
  })

  const { data: popularData, isLoading: popularLoading } = useQuery({
    queryKey: ['reports-popular', startDate, endDate],
    queryFn: async () => {
      const res = await fetch(`/api/reports/popular?startDate=${startDate}&endDate=${endDate}`)
      return res.json()
    },
  })

  const isLoading = salesLoading || popularLoading

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Poročila</h2>
          <p className="text-muted-foreground">Analitika prodaje in vpogledi v učinkovitost</p>
        </div>
        <Select value={dateRange} onValueChange={setDateRange}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">Zadnjih 7 dni</SelectItem>
            <SelectItem value="14">Zadnjih 14 dni</SelectItem>
            <SelectItem value="30">Zadnjih 30 dni</SelectItem>
            <SelectItem value="90">Zadnjih 90 dni</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          title="Skupni prihodek"
          value={`€${(salesData?.totalRevenue || 0).toFixed(2)}`}
          icon={DollarSign}
        />
        <StatsCard
          title="Skupno naročil"
          value={salesData?.totalOrders || 0}
          icon={ShoppingBag}
        />
        <StatsCard
          title="Povpr. vrednost naročila"
          value={`€${(salesData?.avgOrderValue || 0).toFixed(2)}`}
          icon={TrendingUp}
        />
        <StatsCard
          title="Top artikli"
          value={popularData?.popularItems?.length || 0}
          icon={UtensilsCrossed}
        />
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Skeleton className="h-72" />
          <Skeleton className="h-72" />
        </div>
      ) : (
        <>
          {/* Revenue Line Chart */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Trend prihodka</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={salesData?.dailyRevenue || []}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="date" tickFormatter={(v) => format(new Date(v), 'MMM dd')} tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `€${v}`} />
                    <Tooltip
                      formatter={(value: number) => [`€${value.toFixed(2)}`, 'Prihodek']}
                      labelFormatter={(label) => format(new Date(label), 'MMM dd, yyyy')}
                      contentStyle={{ borderRadius: '8px', border: '1px solid var(--border)' }}
                    />
                    <Line type="monotone" dataKey="revenue" stroke="oklch(0.7 0.15 55)" strokeWidth={2} dot={{ fill: 'oklch(0.7 0.15 55)', r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Top Selling Items */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">Najbolj prodajani artikli</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={(popularData?.popularItems || []).slice(0, 8)} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis type="number" tick={{ fontSize: 11 }} />
                      <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 11 }} />
                      <Tooltip
                        formatter={(value: number) => [value, 'Prodana količina']}
                        contentStyle={{ borderRadius: '8px', border: '1px solid var(--border)' }}
                      />
                      <Bar dataKey="quantity" fill="oklch(0.7 0.15 55)" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Order Type Distribution */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">Porazdelitev po vrsti naročila</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={salesData?.typeBreakdown || []}
                        dataKey="revenue"
                        nameKey="type"
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        label={({ type, percent }: { type: string; percent: number }) => `${type} ${(percent * 100).toFixed(0)}%`}
                      >
                        {(salesData?.typeBreakdown || []).map((_entry: unknown, index: number) => (
                          <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: number) => [`€${value.toFixed(2)}`, 'Prihodek']} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Revenue by Category */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Prihodek po kategorijah</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={popularData?.categoryBreakdown || []}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="category" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `€${v}`} />
                    <Tooltip
                      formatter={(value: number) => [`€${value.toFixed(2)}`, 'Prihodek']}
                      contentStyle={{ borderRadius: '8px', border: '1px solid var(--border)' }}
                    />
                    <Bar dataKey="revenue" fill="oklch(0.7 0.15 55)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
