'use client'

import { useQuery } from '@tanstack/react-query'
import { StatsCard } from './StatsCard'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { DollarSign, ShoppingBag, Calculator, BarChartBig, Clock, ArrowRight } from 'lucide-react'
import { usePOSStore } from '@/lib/store'
import { format } from 'date-fns'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

export function Dashboard() {
  const { setActiveModule } = usePOSStore()

  const { data, isLoading } = useQuery({
    queryKey: ['dashboard'],
    queryFn: async () => {
      const res = await fetch('/api/dashboard')
      return res.json()
    },
  })

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
        <Skeleton className="h-72" />
        <Skeleton className="h-48" />
      </div>
    )
  }

  const statusColors: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
    'in-progress': 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
    ready: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
    completed: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400',
    cancelled: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Dashboard</h2>
        <p className="text-muted-foreground">Today&apos;s overview and key metrics</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          title="Today's Revenue"
          value={`$${(data?.todayRevenue || 0).toFixed(2)}`}
          subtitle={data?.pendingOrders > 0 ? `${data.pendingOrders} pending orders` : undefined}
          icon={DollarSign}
          trend="up"
        />
        <StatsCard
          title="Total Orders"
          value={data?.totalOrders || 0}
          subtitle={data?.inProgressOrders > 0 ? `${data.inProgressOrders} in progress` : undefined}
          icon={ShoppingBag}
        />
        <StatsCard
          title="Avg Order Value"
          value={`$${(data?.avgOrderValue || 0).toFixed(2)}`}
          icon={Calculator}
        />
        <StatsCard
          title="Active Tables"
          value={`${data?.activeTables || 0}/${data?.totalTables || 0}`}
          icon={BarChartBig}
        />
      </div>

      {/* Revenue Chart */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Revenue (Last 7 Days)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data?.dailyRevenue || []}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis
                  dataKey="date"
                  tickFormatter={(v) => format(new Date(v), 'EEE')}
                  className="text-xs"
                  tick={{ fontSize: 12 }}
                />
                <YAxis className="text-xs" tick={{ fontSize: 12 }} tickFormatter={(v) => `$${v}`} />
                <Tooltip
                  formatter={(value: number) => [`$${value.toFixed(2)}`, 'Revenue']}
                  labelFormatter={(label) => format(new Date(label), 'MMM dd, yyyy')}
                  contentStyle={{ borderRadius: '8px', border: '1px solid var(--border)' }}
                />
                <Bar dataKey="revenue" fill="oklch(0.7 0.15 55)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Recent Orders + Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Recent Orders</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-72 overflow-y-auto custom-scrollbar">
              {(data?.recentOrders || []).map((order: {
                id: string
                orderNumber: number
                type: string
                status: string
                total: number
                customerName: string
                createdAt: string
              }) => (
                <div key={order.id} className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-muted/50">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <Clock className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">#{order.orderNumber} - {order.customerName || 'Walk-in'}</p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(order.createdAt), 'HH:mm')} · {order.type}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={statusColors[order.status] || ''}>
                      {order.status}
                    </Badge>
                    <span className="text-sm font-semibold">${order.total.toFixed(2)}</span>
                  </div>
                </div>
              ))}
              {(data?.recentOrders || []).length === 0 && (
                <p className="text-center text-muted-foreground py-8">No orders yet today</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button className="w-full justify-start gap-2" onClick={() => setActiveModule('orders')}>
              <ShoppingBag className="h-4 w-4" />
              New Order
              <ArrowRight className="h-3 w-3 ml-auto" />
            </Button>
            <Button variant="outline" className="w-full justify-start gap-2" onClick={() => setActiveModule('tables')}>
              <BarChartBig className="h-4 w-4" />
              View Tables
              <ArrowRight className="h-3 w-3 ml-auto" />
            </Button>
            <Button variant="outline" className="w-full justify-start gap-2" onClick={() => setActiveModule('menu')}>
              <Calculator className="h-4 w-4" />
              Manage Menu
              <ArrowRight className="h-3 w-3 ml-auto" />
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Low Stock Alerts */}
      {data?.lowStockItems?.length > 0 && (
        <Card className="border-red-200 dark:border-red-900/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg text-red-600">⚠️ Low Stock Alerts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {data.lowStockItems.map((item: { id: string; name: string; quantity: number; minQuantity: number }) => (
                <Badge key={item.id} variant="destructive" className="text-xs">
                  {item.name}: {item.quantity}/{item.minQuantity}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
