'use client'

import { useQuery } from '@tanstack/react-query'
import { StatsCard } from './StatsCard'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { DollarSign, ShoppingBag, Calculator, BarChartBig, Clock, ArrowRight, ChefHat, Users, TrendingUp, Receipt, Truck, Package, AlertTriangle, XCircle, Shield, Wallet, CreditCard, Banknote, PiggyBank } from 'lucide-react'
import { usePOSStore } from '@/lib/store'
import { format } from 'date-fns'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts'
import { authFetch } from '@/components/pos/PinLogin'

const PIE_COLORS = ['#f59e0b', '#3b82f6', '#10b981', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16']

export function Dashboard() {
  const { setActiveModule } = usePOSStore()

  const { data, isLoading } = useQuery({
    queryKey: ['dashboard'],
    queryFn: async () => {
      const res = await authFetch('/api/dashboard')
      return res.json()
    },
  })

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (<Skeleton key={i} className="h-28" />))}
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
  const statusLabels: Record<string, string> = {
    pending: 'Čakajoče', 'in-progress': 'V obdelavi', ready: 'Pripravljeno', completed: 'Zaključeno', cancelled: 'Preklicano',
  }
  const typeLabels: Record<string, string> = { 'dine-in': 'Na mestu', takeout: 'Za s seboj', delivery: 'Dostava' }

  return (
    <div className="space-y-6 overflow-y-auto h-full p-1 custom-scrollbar">
      <div>
        <h2 className="text-2xl font-bold">Nadzorna plošča</h2>
        <p className="text-muted-foreground">Pregled dneva in ključni kazalniki</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatsCard title="Današnji prihodek" value={`€${(data?.todayRevenue || 0).toFixed(2)}`} subtitle={data?.pendingOrders > 0 ? `${data.pendingOrders} čakajočih` : undefined} icon={DollarSign} trend="up" />
        <StatsCard title="Skupno naročil" value={data?.totalOrders || 0} subtitle={`${data?.completedOrders || 0} končanih · ${data?.cancelledOrders || 0} preklicanih`} icon={ShoppingBag} />
        <StatsCard title="Povpr. naročilo" value={`€${(data?.avgOrderValue || 0).toFixed(2)}`} subtitle={data?.todayTips > 0 ? `Napitnine: €${(data?.todayTips || 0).toFixed(2)}` : undefined} icon={Calculator} />
        <StatsCard title="Zasedene mize" value={`${data?.activeTables || 0}/${data?.totalTables || 0}`} subtitle={data?.readyOrders > 0 ? `${data.readyOrders} pripravljenih` : undefined} icon={BarChartBig} />
        <StatsCard title="Bruto dobiček" value={`€${(data?.grossProfit || 0).toFixed(2)}`} subtitle={data?.grossMargin > 0 ? `Marža: ${data.grossMargin}%` : undefined} icon={PiggyBank} trend={data?.grossMargin > 50 ? 'up' : 'down'} />
        <StatsCard title="FURS overjeno" value={data?.fursStatus?.todayVerified || 0} subtitle={data?.fursStatus?.todayUnverified > 0 ? `${data.fursStatus.todayUnverified} brez overjanja` : 'Vse overjeno'} icon={Shield} trend={data?.fursStatus?.todayUnverified === 0 ? 'up' : 'down'} />
      </div>

      {/* Aktivna izmena + FURS status */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className={`${data?.activeShift ? 'border-emerald-200 dark:border-emerald-900/50' : 'border-amber-200 dark:border-amber-900/50'}`}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`h-10 w-10 rounded-full flex items-center justify-center ${data?.activeShift ? 'bg-emerald-100 dark:bg-emerald-900/30' : 'bg-amber-100 dark:bg-amber-900/30'}`}>
                  <Wallet className={`h-5 w-5 ${data?.activeShift ? 'text-emerald-600' : 'text-amber-600'}`} />
                </div>
                <div>
                  <p className="font-bold text-sm">{data?.activeShift ? 'Izmena odprta' : 'Ni odprte izmene'}</p>
                  <p className="text-xs text-muted-foreground">
                    {data?.activeShift
                      ? `Od: ${format(new Date(data.activeShift.openedAt), 'HH:mm')} · Začetna blagajna: €${data.activeShift.startingCash.toFixed(2)}`
                      : 'Odprite izmeno za sledenje prodaje'}
                  </p>
                </div>
              </div>
              {data?.activeShift && (
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div>
                    <p className="text-[10px] text-muted-foreground">Gotovina</p>
                    <p className="font-bold text-sm flex items-center justify-center gap-1"><Banknote className="h-3 w-3" />€{(data.activeShift.cashSales || 0).toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground">Kartice</p>
                    <p className="font-bold text-sm flex items-center justify-center gap-1"><CreditCard className="h-3 w-3" />€{(data.activeShift.cardSales || 0).toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground">Skupaj</p>
                    <p className="font-bold text-sm text-primary">€{(data.activeShift.totalSales || 0).toFixed(2)}</p>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className={`${data?.fursStatus?.todayUnverified > 0 ? 'border-amber-200 dark:border-amber-900/50' : 'border-blue-200 dark:border-blue-900/50'}`}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`h-10 w-10 rounded-full flex items-center justify-center ${data?.fursStatus?.configured ? 'bg-blue-100 dark:bg-blue-900/30' : 'bg-red-100 dark:bg-red-900/30'}`}>
                  <Shield className={`h-5 w-5 ${data?.fursStatus?.configured ? 'text-blue-600' : 'text-red-600'}`} />
                </div>
                <div>
                  <p className="font-bold text-sm">FURS davčno potrjevanje</p>
                  <p className="text-xs text-muted-foreground">
                    {data?.fursStatus?.configured
                      ? `Okolje: ${data.fursStatus.environment === 'production' ? 'PRODUKCIJA' : 'TEST'} · Certifikat nameščen`
                      : 'Certifikat ni nastavljen — overjanje v simulaciji'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-center">
                  <p className="text-xl font-bold text-emerald-600">{data?.fursStatus?.todayVerified || 0}</p>
                  <p className="text-[10px] text-muted-foreground">Overjenih</p>
                </div>
                {(data?.fursStatus?.todayUnverified || 0) > 0 && (
                  <div className="text-center">
                    <p className="text-xl font-bold text-amber-600">{data?.fursStatus?.todayUnverified}</p>
                    <p className="text-[10px] text-muted-foreground">Brez overjanja</p>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Revenue Chart + Category Pie */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Prihodek (zadnjih 7 dni)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data?.dailyRevenue || []}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="date" tickFormatter={(v) => format(new Date(v), 'EEE')} className="text-xs" tick={{ fontSize: 12 }} />
                  <YAxis className="text-xs" tick={{ fontSize: 12 }} tickFormatter={(v) => `€${v}`} />
                  <Tooltip formatter={(value: number) => [`€${value.toFixed(2)}`, 'Prihodek']} labelFormatter={(label) => format(new Date(label), 'MMM dd, yyyy')} contentStyle={{ borderRadius: '8px', border: '1px solid var(--border)' }} />
                  <Bar dataKey="revenue" fill="oklch(0.7 0.15 55)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2"><TrendingUp className="h-4 w-4" /> Po kategorijah</CardTitle>
          </CardHeader>
          <CardContent>
            {data?.categoryBreakdown?.length > 0 ? (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={data.categoryBreakdown} dataKey="revenue" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                      {data.categoryBreakdown.map((_: unknown, index: number) => <Cell key={index} fill={PIE_COLORS[index % PIE_COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(value: number) => [`€${value.toFixed(2)}`, 'Prihodek']} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">Ni podatkov</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Hourly Revenue + Order Type + DDV */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Hourly Revenue */}
        <Card className="md:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2"><Clock className="h-4 w-4" /> Urni pregled</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data?.hourlyRevenue?.filter((h: { hour: number }) => h.hour >= 6 && h.hour <= 23) || []}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `€${v}`} />
                  <Tooltip formatter={(value: number) => [`€${value.toFixed(2)}`, 'Prihodek']} />
                  <Line type="monotone" dataKey="revenue" stroke="oklch(0.7 0.15 55)" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Order Type Breakdown */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2"><Receipt className="h-4 w-4" /> Vrsta naročila</CardTitle>
          </CardHeader>
          <CardContent>
            {data?.orderTypeBreakdown?.length > 0 ? (
              <div className="space-y-3">
                {data.orderTypeBreakdown.map((item: { type: string; revenue: number; count: number }) => (
                  <div key={item.type} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{item.type === 'dine-in' ? '🍽️' : item.type === 'takeout' ? '📦' : item.type === 'delivery' ? '🚚' : '❓'}</span>
                      <div>
                        <p className="text-sm font-medium">{typeLabels[item.type] || item.type}</p>
                        <p className="text-xs text-muted-foreground">{item.count} naročil</p>
                      </div>
                    </div>
                    <span className="font-bold text-sm">€{item.revenue.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">Ni podatkov</div>
            )}
          </CardContent>
        </Card>

        {/* DDV Breakdown */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2"><Calculator className="h-4 w-4" /> DDV po stopnjah</CardTitle>
          </CardHeader>
          <CardContent>
            {data?.vatBreakdown?.length > 0 ? (
              <div className="space-y-3">
                {data.vatBreakdown.map((item: { rate: string; base: number; vat: number }) => (
                  <div key={item.rate} className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="font-medium">DDV {item.rate}%</span>
                      <span className="font-bold">€{item.vat.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Osnova: €{item.base.toFixed(2)}</span>
                      <span>Skupaj: €{(item.base + item.vat).toFixed(2)}</span>
                    </div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-primary rounded-full" style={{ width: `${Math.min(100, (item.base / (data.todayRevenue || 1)) * 100)}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">Ni podatkov</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Orders + Quick Actions + Top Items */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Zadnja naročila</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-72 overflow-y-auto custom-scrollbar">
              {(data?.recentOrders || []).slice(0, 5).map((order: {
                id: string; orderNumber: number; type: string; status: string; total: number; customerName: string; createdAt: string
              }) => (
                <div key={order.id} className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-muted/50">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <Clock className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">#{order.orderNumber} - {order.customerName || 'Hodič'}</p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(order.createdAt), 'HH:mm')} · {typeLabels[order.type] || order.type}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={statusColors[order.status] || ''}>
                      {statusLabels[order.status] || order.status}
                    </Badge>
                    <span className="text-sm font-semibold">€{order.total.toFixed(2)}</span>
                  </div>
                </div>
              ))}
              {(data?.recentOrders || []).length === 0 && (
                <p className="text-center text-muted-foreground py-8">Danes še ni naročil</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Top Selling Items */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2"><TrendingUp className="h-4 w-4" /> Najbolj prodajani</CardTitle>
          </CardHeader>
          <CardContent>
            {data?.topSellingItems?.length > 0 ? (
              <div className="space-y-2">
                {data.topSellingItems.map((item: { name: string; quantity: number; revenue: number }, idx: number) => (
                  <div key={idx} className="flex items-center justify-between py-1.5">
                    <div className="flex items-center gap-2">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold">{idx + 1}</span>
                      <span className="text-sm truncate max-w-[120px]">{item.name}</span>
                    </div>
                    <div className="flex items-center gap-3 text-sm">
                      <span className="text-muted-foreground">{item.quantity}x</span>
                      <span className="font-semibold">€{item.revenue.toFixed(2)}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">Ni podatkov</div>
            )}
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Hitri dostop</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button className="w-full justify-start gap-2" onClick={() => setActiveModule('orders')}>
              <ShoppingBag className="h-4 w-4" /> Novo naročilo <ArrowRight className="h-3 w-3 ml-auto" />
            </Button>
            <Button variant="outline" className="w-full justify-start gap-2" onClick={() => setActiveModule('kitchen')}>
              <ChefHat className="h-4 w-4" /> Kuhinjski zaslon <ArrowRight className="h-3 w-3 ml-auto" />
            </Button>
            <Button variant="outline" className="w-full justify-start gap-2" onClick={() => setActiveModule('tables')}>
              <BarChartBig className="h-4 w-4" /> Pregled miz <ArrowRight className="h-3 w-3 ml-auto" />
            </Button>
            <Button variant="outline" className="w-full justify-start gap-2" onClick={() => setActiveModule('delivery')}>
              <Truck className="h-4 w-4" /> Dostava <ArrowRight className="h-3 w-3 ml-auto" />
            </Button>
            <Button variant="outline" className="w-full justify-start gap-2" onClick={() => setActiveModule('employees')}>
              <Users className="h-4 w-4" /> Zaposleni <ArrowRight className="h-3 w-3 ml-auto" />
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Low Stock Alerts — Izboljšan Stock Health */}
      <Card className={`${(data?.lowStockItems?.length || 0) > 0 ? 'border-red-200 dark:border-red-900/50' : 'border-emerald-200 dark:border-emerald-900/50'}`}>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Package className="h-4 w-4" />
              Stanje zaloge
            </CardTitle>
            <Button variant="outline" size="sm" onClick={() => setActiveModule('inventory')} className="text-xs gap-1">
              Upravljaj <ArrowRight className="h-3 w-3" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {(data?.lowStockItems?.length || 0) > 0 ? (
            <div className="space-y-2">
              {/* Kritično — brez zaloge */}
              {data.lowStockItems.filter((i: { quantity: number }) => i.quantity <= 0).length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold text-red-600 flex items-center gap-1"><XCircle className="h-3 w-3" /> Ni na zalogi</p>
                  <div className="flex flex-wrap gap-1.5">
                    {data.lowStockItems.filter((i: { quantity: number }) => i.quantity <= 0).map((item: { id: string; name: string; quantity: number; minQuantity: number }) => (
                      <Badge key={item.id} variant="destructive" className="text-xs cursor-pointer" onClick={() => setActiveModule('inventory')}>
                        {item.name}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
              {/* Nizka zaloga */}
              {data.lowStockItems.filter((i: { quantity: number }) => i.quantity > 0).length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold text-amber-600 flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> Nizka zaloga</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    {data.lowStockItems.filter((i: { quantity: number }) => i.quantity > 0).map((item: { id: string; name: string; quantity: number; minQuantity: number; unit?: string }) => {
                      const pct = item.minQuantity > 0 ? Math.min((item.quantity / item.minQuantity) * 100, 100) : 100
                      return (
                        <div key={item.id} className="flex items-center gap-2 p-2 rounded-lg bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-900/30">
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium truncate">{item.name}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                                <div className={`h-full rounded-full ${pct <= 25 ? 'bg-red-500' : pct <= 50 ? 'bg-amber-500' : 'bg-amber-400'}`} style={{ width: `${pct}%` }} />
                              </div>
                              <span className="text-[10px] text-muted-foreground whitespace-nowrap">{item.quantity}/{item.minQuantity} {item.unit || ''}</span>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
              <p className="text-[10px] text-muted-foreground text-center mt-2">Kliknite na artikel za hitro vnašanje nabave</p>
            </div>
          ) : (
            <div className="flex items-center justify-center gap-3 py-6 text-emerald-600">
              <Package className="h-8 w-8 opacity-30" />
              <div>
                <p className="font-semibold">Vse zaloge so v redu</p>
                <p className="text-xs text-muted-foreground">Ni artiklov pod minimalno količino</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Kitchen Display */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <span className="inline-block h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            Kuhinjski zaslon
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {(data?.recentOrders || [])
              .filter((o: { status: string }) => o.status === 'pending' || o.status === 'in-progress')
              .map((order: {
                id: string; orderNumber: number; status: string; type: string;
                table?: { number: number };
                orderItems: { id: string; menuItem: { name: string }; quantity: number; status: string }[];
                createdAt: string;
              }) => (
                <div key={order.id} className={`p-3 rounded-lg border-2 ${
                  order.status === 'pending'
                    ? 'border-yellow-400 bg-yellow-50 dark:bg-yellow-900/20 dark:border-yellow-800'
                    : 'border-blue-400 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-800'
                }`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-sm">#{order.orderNumber}</span>
                    <Badge variant="outline" className={statusColors[order.status]}>{statusLabels[order.status]}</Badge>
                  </div>
                  <div className="text-xs text-muted-foreground mb-2">
                    {typeLabels[order.type] || order.type}
                    {order.type === 'dine-in' && order.table ? ` · Miza ${order.table.number}` : ''}
                    {' · '}{format(new Date(order.createdAt), 'HH:mm')}
                  </div>
                  <div className="space-y-1">
                    {order.orderItems.map((oi) => (
                      <div key={oi.id} className="flex items-center gap-2 text-sm">
                        <span className={`h-1.5 w-1.5 rounded-full ${oi.status === 'ready' ? 'bg-emerald-500' : oi.status === 'preparing' ? 'bg-blue-500' : 'bg-yellow-500'}`} />
                        <span>{oi.quantity}x {oi.menuItem.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            {(data?.recentOrders || []).filter((o: { status: string }) => o.status === 'pending' || o.status === 'in-progress').length === 0 && (
              <div className="col-span-full text-center py-6 text-muted-foreground text-sm">V kuhinji ni aktivnih naročil</div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
