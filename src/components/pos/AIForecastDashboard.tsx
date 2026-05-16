'use client'

// ============================================
// AI PREDIKTIVNA ANALÍTIKA ZALOGE
// Napovedi, pametna naročila, sezonski vzorci
// ============================================

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Progress } from '@/components/ui/progress'
import { toast } from 'sonner'
import { authFetch } from '@/components/pos/PinLogin'
import {
  TrendingUp, TrendingDown, Minus, AlertTriangle, ShieldCheck,
  Package, ShoppingCart, BarChart3, Brain, Zap, Clock, RefreshCw,
  CheckCircle2, XCircle, ArrowUpRight, ArrowDownRight,
} from 'lucide-react'
import { useState } from 'react'

// ============================================
// TIPI
// ============================================

interface ForecastItem {
  inventoryItemId: string
  itemName: string
  unit: string
  currentStock: number
  minStock: number
  avgDailyUsage: number
  forecast7d: number
  forecast14d: number
  forecast30d: number
  daysUntilEmpty: number | null
  needsReorder: boolean
  suggestedOrderQty: number
  confidence: number
  seasonalityFactor: number
  trend: 'increasing' | 'decreasing' | 'stable'
  riskLevel: 'low' | 'medium' | 'high' | 'critical'
  weekdayBreakdown: { day: string; avgUsage: number }[]
  lastRestockDate: string | null
  lastRestockQty: number
}

interface ReorderSuggestion {
  inventoryItemId: string
  itemName: string
  unit: string
  supplier: string
  currentStock: number
  suggestedQty: number
  costPerUnit: number
  totalCost: number
  urgency: 'critical' | 'high' | 'medium' | 'low'
  reason: string
  lastOrderDate: string | null
  avgDeliveryDays: number
  category: string
}

// ============================================
// KONSTANTE
// ============================================

const riskConfig: Record<string, { color: string; bgColor: string; icon: React.ReactNode; label: string }> = {
  critical: { color: 'text-red-700 dark:text-red-400', bgColor: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400', icon: <AlertTriangle className="h-4 w-4" />, label: 'Kritično' },
  high: { color: 'text-amber-700 dark:text-amber-400', bgColor: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400', icon: <Zap className="h-4 w-4" />, label: 'Visoko' },
  medium: { color: 'text-blue-700 dark:text-blue-400', bgColor: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400', icon: <Clock className="h-4 w-4" />, label: 'Zmerno' },
  low: { color: 'text-emerald-700 dark:text-emerald-400', bgColor: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400', icon: <ShieldCheck className="h-4 w-4" />, label: 'Nizko' },
}

const trendConfig: Record<string, { icon: React.ReactNode; color: string; label: string }> = {
  increasing: { icon: <TrendingUp className="h-4 w-4" />, color: 'text-amber-600', label: 'Narašča' },
  decreasing: { icon: <TrendingDown className="h-4 w-4" />, color: 'text-emerald-600', label: 'Pada' },
  stable: { icon: <Minus className="h-4 w-4" />, color: 'text-muted-foreground', label: 'Stabilen' },
}

const fmt = (n: number | null | undefined) => (n ?? 0).toFixed(2)
const fmtQty = (n: number | null | undefined) => { const v = n ?? 0; return v < 1 ? v.toFixed(3) : v.toFixed(1) }

// ============================================
// GLAVNA KOMPONENTA
// ============================================

export function AIForecastDashboard() {
  const queryClient = useQueryClient()
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set())

  // Fetch forecasts
  const { data: forecastData, isLoading: forecastLoading } = useQuery({
    queryKey: ['inventory-forecast'],
    queryFn: async () => {
      const res = await authFetch('/api/inventory/forecast')
      return res.json() as Promise<{ summary: Record<string, number>; forecasts: ForecastItem[] }>
    },
    refetchInterval: 60000,
  })

  // Fetch reorder suggestions
  const { data: reorderData, isLoading: reorderLoading } = useQuery({
    queryKey: ['inventory-reorder'],
    queryFn: async () => {
      const res = await authFetch('/api/inventory/reorder')
      return res.json() as Promise<{ summary: Record<string, unknown>; suggestions: ReorderSuggestion[] }>
    },
    refetchInterval: 60000,
  })

  // Create reorder mutation
  const reorderMutation = useMutation({
    mutationFn: async (items: Array<{ inventoryItemId: string; quantity: number; costPerUnit: number }>) => {
      const res = await authFetch('/api/inventory/reorder', {
        method: 'POST',
        body: JSON.stringify({ items, employeeName: 'Manager' }),
      })
      return res.json()
    },
    onSuccess: () => {
      toast.success('Naročilnica ustvarjena! Zaloga bo posodobljena ob dobavi.')
      queryClient.invalidateQueries({ queryKey: ['inventory-forecast'] })
      queryClient.invalidateQueries({ queryKey: ['inventory-reorder'] })
      queryClient.invalidateQueries({ queryKey: ['inventory'] })
      setSelectedItems(new Set())
    },
  })

  const forecasts = forecastData?.forecasts || []
  const reorders = reorderData?.suggestions || []
  const summary = forecastData?.summary

  const toggleItem = (id: string) => {
    const next = new Set(selectedItems)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelectedItems(next)
  }

  const handleCreateReorder = () => {
    const items = reorders
      .filter(r => selectedItems.has(r.inventoryItemId))
      .map(r => ({
        inventoryItemId: r.inventoryItemId,
        quantity: r.suggestedQty,
        costPerUnit: r.costPerUnit,
      }))
    if (items.length === 0) {
      toast.error('Izberite artikle za naročilo')
      return
    }
    reorderMutation.mutate(items)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Brain className="h-6 w-6 text-primary" />
            AI Prediktivna analitika
          </h2>
          <p className="text-muted-foreground">Napovedi povpraševanja, pametna naročila, sezonski vzorci</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            queryClient.invalidateQueries({ queryKey: ['inventory-forecast'] })
            queryClient.invalidateQueries({ queryKey: ['inventory-reorder'] })
          }}
        >
          <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Osveži
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card className="border-red-200 dark:border-red-900/50">
          <CardContent className="p-4 text-center">
            <AlertTriangle className="h-6 w-6 mx-auto text-red-500 mb-1" />
            <p className="text-3xl font-bold text-red-600">{summary?.criticalItems || 0}</p>
            <p className="text-xs text-muted-foreground">Kritično</p>
          </CardContent>
        </Card>
        <Card className="border-amber-200 dark:border-amber-900/50">
          <CardContent className="p-4 text-center">
            <Zap className="h-6 w-6 mx-auto text-amber-500 mb-1" />
            <p className="text-3xl font-bold text-amber-600">{summary?.highRiskItems || 0}</p>
            <p className="text-xs text-muted-foreground">Visoko tveganje</p>
          </CardContent>
        </Card>
        <Card className="border-blue-200 dark:border-blue-900/50">
          <CardContent className="p-4 text-center">
            <ShoppingCart className="h-6 w-6 mx-auto text-blue-500 mb-1" />
            <p className="text-3xl font-bold text-blue-600">{summary?.needsReorderCount || 0}</p>
            <p className="text-xs text-muted-foreground">Potrebuje naročilo</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Package className="h-6 w-6 mx-auto text-primary mb-1" />
            <p className="text-3xl font-bold">{summary?.totalItems || 0}</p>
            <p className="text-xs text-muted-foreground">Skupaj artiklov</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <BarChart3 className="h-6 w-6 mx-auto text-primary mb-1" />
            <p className="text-3xl font-bold">{Math.round((summary?.avgConfidence || 0) * 100)}%</p>
            <p className="text-xs text-muted-foreground">Povp. zaupanje</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="forecast">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="forecast" className="gap-1">
            <Brain className="h-3.5 w-3.5" /> Napovedi
          </TabsTrigger>
          <TabsTrigger value="reorder" className="gap-1">
            <ShoppingCart className="h-3.5 w-3.5" /> Naročila ({reorders.length})
          </TabsTrigger>
          <TabsTrigger value="analysis" className="gap-1">
            <BarChart3 className="h-3.5 w-3.5" /> Analitika
          </TabsTrigger>
        </TabsList>

        {/* TAB: Napovedi */}
        <TabsContent value="forecast" className="mt-4 space-y-3">
          {forecastLoading ? (
            <div className="space-y-2">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-20" />)}</div>
          ) : forecasts.length === 0 ? (
            <p className="text-center py-12 text-muted-foreground">Ni podatkov za napovedovanje</p>
          ) : (
            forecasts.map(f => {
              const risk = riskConfig[f.riskLevel] || riskConfig.low
              const trend = trendConfig[f.trend] || trendConfig.stable
              const stockPercent = f.minStock > 0 ? Math.min(100, (f.currentStock / f.minStock) * 100) : 100

              return (
                <Card key={f.inventoryItemId} className={`border-l-4 ${f.riskLevel === 'critical' ? 'border-l-red-500' : f.riskLevel === 'high' ? 'border-l-amber-500' : f.riskLevel === 'medium' ? 'border-l-blue-500' : 'border-l-emerald-500'}`}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Badge className={risk.bgColor}>{risk.icon} {risk.label}</Badge>
                        <div>
                          <p className="font-semibold">{f.itemName}</p>
                          <p className="text-xs text-muted-foreground">
                            Zaloga: <strong>{fmtQty(f.currentStock)}</strong> {f.unit} ·
                            Min: {fmtQty(f.minStock)} ·
                            Povp. dnevna poraba: {fmtQty(f.avgDailyUsage)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 text-sm">
                        <div className="text-center">
                          <p className="text-xs text-muted-foreground">Dni do praznine</p>
                          <p className={`font-bold ${f.daysUntilEmpty !== null && f.daysUntilEmpty <= 7 ? 'text-red-600' : ''}`}>
                            {f.daysUntilEmpty !== null ? f.daysUntilEmpty : '∞'}
                          </p>
                        </div>
                        <div className="text-center">
                          <p className="text-xs text-muted-foreground">Napoved 7d</p>
                          <p className="font-semibold">{fmtQty(f.forecast7d)}</p>
                        </div>
                        <div className="text-center">
                          <p className="text-xs text-muted-foreground">Trend</p>
                          <div className={`flex items-center gap-1 ${trend.color}`}>{trend.icon} {trend.label}</div>
                        </div>
                        <div className="text-center">
                          <p className="text-xs text-muted-foreground">Zaupanje</p>
                          <p className="font-medium">{Math.round(f.confidence * 100)}%</p>
                        </div>
                        {f.seasonalityFactor > 1.15 && (
                          <Badge variant="outline" className="text-amber-600 border-amber-400 text-xs">
                            <TrendingUp className="h-3 w-3 mr-1" /> Vikend porast ({f.seasonalityFactor.toFixed(1)}x)
                          </Badge>
                        )}
                      </div>
                    </div>
                    {/* Stock level bar */}
                    <div className="mt-2">
                      <Progress
                        value={stockPercent}
                        className={`h-2 ${stockPercent < 30 ? '[&>div]:bg-red-500' : stockPercent < 70 ? '[&>div]:bg-amber-500' : '[&>div]:bg-emerald-500'}`}
                      />
                    </div>
                  </CardContent>
                </Card>
              )
            })
          )}
        </TabsContent>

        {/* TAB: Pametna naročila */}
        <TabsContent value="reorder" className="mt-4 space-y-3">
          {reorderLoading ? (
            <div className="space-y-2">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-16" />)}</div>
          ) : reorders.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <ShieldCheck className="h-12 w-12 mx-auto mb-3 opacity-20" />
              <p className="font-medium">Vse zaloge so v redu!</p>
              <p className="text-sm">Ni potrebe po naročanju</p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  Skupni predlagani strošek: <strong>€{fmt(reorders.reduce((s, r) => s + r.totalCost, 0))}</strong>
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedItems(new Set(reorders.map(r => r.inventoryItemId)))}
                  >
                    Izberi vse
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleCreateReorder}
                    disabled={selectedItems.size === 0 || reorderMutation.isPending}
                  >
                    <ShoppingCart className="h-3.5 w-3.5 mr-1.5" />
                    Naroči {selectedItems.size > 0 ? `(${selectedItems.size})` : ''}
                  </Button>
                </div>
              </div>

              {reorders.map(r => {
                const risk = riskConfig[r.urgency] || riskConfig.low
                const isSelected = selectedItems.has(r.inventoryItemId)

                return (
                  <Card
                    key={r.inventoryItemId}
                    className={`cursor-pointer transition-all ${isSelected ? 'ring-2 ring-primary' : ''}`}
                    onClick={() => toggleItem(r.inventoryItemId)}
                  >
                    <CardContent className="p-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`h-8 w-8 rounded flex items-center justify-center ${isSelected ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                            {isSelected ? <CheckCircle2 className="h-4 w-4" /> : <Package className="h-4 w-4" />}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-semibold text-sm">{r.itemName}</p>
                              <Badge className={`text-[10px] ${risk.bgColor}`}>{risk.label}</Badge>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {r.supplier && `${r.supplier} · `}
                              Trenutno: {fmtQty(r.currentStock)} {r.unit} ·
                              Predlagano: <strong>{fmtQty(r.suggestedQty)} {r.unit}</strong>
                            </p>
                            <p className="text-xs text-amber-700 dark:text-amber-400">{r.reason}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-sm">€{fmt(r.totalCost)}</p>
                          <p className="text-[10px] text-muted-foreground">@ €{fmt(r.costPerUnit)}/{r.unit}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </>
          )}
        </TabsContent>

        {/* TAB: Analitika */}
        <TabsContent value="analysis" className="mt-4 space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Weekday breakdown for top items */}
            {forecasts.slice(0, 4).map(f => (
              <Card key={f.inventoryItemId}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <BarChart3 className="h-4 w-4" />
                    {f.itemName} — poraba po dnevih
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-end gap-1 h-24">
                    {f.weekdayBreakdown.map((wd, i) => {
                      const maxUsage = Math.max(...f.weekdayBreakdown.map(w => w.avgUsage), 0.1)
                      const heightPct = maxUsage > 0 ? (wd.avgUsage / maxUsage) * 100 : 0
                      const isWeekend = i === 0 || i >= 5
                      return (
                        <div key={wd.day} className="flex-1 flex flex-col items-center gap-1">
                          <div
                            className={`w-full rounded-t ${isWeekend ? 'bg-amber-400' : 'bg-primary'}`}
                            style={{ height: `${Math.max(4, heightPct)}%` }}
                          />
                          <span className="text-[9px] text-muted-foreground">{wd.day}</span>
                        </div>
                      )
                    })}
                  </div>
                  {f.seasonalityFactor > 1.1 && (
                    <p className="text-xs text-amber-600 mt-2">
                      <TrendingUp className="h-3 w-3 inline mr-1" />
                      Vikend porast: {f.seasonalityFactor.toFixed(1)}x večja poraba
                    </p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Summary insights */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Brain className="h-4 w-4" />
                AI Vpogledi
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {forecasts.filter(f => f.trend === 'increasing').length > 0 && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20">
                  <TrendingUp className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-amber-800 dark:text-amber-300">Naraščajoča poraba</p>
                    <p className="text-xs text-amber-700 dark:text-amber-400">
                      {forecasts.filter(f => f.trend === 'increasing').map(f => f.itemName).join(', ')} — poraba narašča. Razmislite o povečanju zalog.
                    </p>
                  </div>
                </div>
              )}
              {forecasts.filter(f => f.seasonalityFactor > 1.2).length > 0 && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20">
                  <BarChart3 className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-blue-800 dark:text-blue-300">Vikend vzorec</p>
                    <p className="text-xs text-blue-700 dark:text-blue-400">
                      {forecasts.filter(f => f.seasonalityFactor > 1.2).map(f => f.itemName).join(', ')} — vikend porast večja od 20%. Priporočamo večjo zalogo za petek/soboto.
                    </p>
                  </div>
                </div>
              )}
              {forecasts.filter(f => f.riskLevel === 'critical').length > 0 && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-900/20">
                  <AlertTriangle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-red-800 dark:text-red-300">Nujno naročilo</p>
                    <p className="text-xs text-red-700 dark:text-red-400">
                      {forecasts.filter(f => f.riskLevel === 'critical').map(f => `${f.itemName} (zmanjka čez ${f.daysUntilEmpty} dni)`).join(', ')} — naročite takoj!
                    </p>
                  </div>
                </div>
              )}
              {forecasts.every(f => f.riskLevel === 'low') && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-emerald-50 dark:bg-emerald-900/20">
                  <ShieldCheck className="h-4 w-4 text-emerald-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-emerald-800 dark:text-emerald-300">Vse v redu</p>
                    <p className="text-xs text-emerald-700 dark:text-emerald-400">Vse zaloge so v varnem območju. Nobenih nujnih ukrepov ni potrebnih.</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
