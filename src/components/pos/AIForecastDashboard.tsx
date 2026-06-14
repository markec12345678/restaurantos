'use client'

// ============================================
// AI PREDIKTIVNA ANALÍTIKA ZALOGE
// Napovedi, pametna naročila, sezonski vzorci
// ============================================

import dynamic from 'next/dynamic'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from 'sonner'
import { authFetch } from '@/components/pos/PinLogin'
import { queryKeys } from '@/lib/query-keys'
import { Brain, ShoppingCart, BarChart3, RefreshCw } from 'lucide-react'
import { useState, useCallback, memo } from 'react'
import type { ForecastItem, ReorderSuggestion } from './ai-forecast/constants'

// --- LAZY-LOADED POD-KOMPONENTE ---

const SummaryCards = dynamic(
  () => import('./ai-forecast/SummaryCards').then(m => m.SummaryCards),
  { ssr: false },
)

const ForecastTab = dynamic(
  () => import('./ai-forecast/ForecastTab').then(m => m.ForecastTab),
  { ssr: false },
)

const ReorderTab = dynamic(
  () => import('./ai-forecast/ReorderTab').then(m => m.ReorderTab),
  { ssr: false },
)

const AnalysisTab = dynamic(
  () => import('./ai-forecast/AnalysisTab').then(m => m.AnalysisTab),
  { ssr: false },
)

// ============================================
// GLAVNA KOMPONENTA
// ============================================

export const AIForecastDashboard = memo(function AIForecastDashboard() {
  const queryClient = useQueryClient()
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set())

  // Fetch napovedi
  const { data: forecastData, isLoading: forecastLoading } = useQuery({
    queryKey: queryKeys.inventory.forecast,
    queryFn: async () => {
      const res = await authFetch('/api/inventory/forecast')
      return res.json() as Promise<{ summary: Record<string, number>; forecasts: ForecastItem[] }>
    },
    refetchInterval: 60000,
  })

  // Fetch predlogi naročil
  const { data: reorderData, isLoading: reorderLoading } = useQuery({
    queryKey: queryKeys.inventory.reorder,
    queryFn: async () => {
      const res = await authFetch('/api/inventory/reorder')
      return res.json() as Promise<{ summary: Record<string, unknown>; suggestions: ReorderSuggestion[] }>
    },
    refetchInterval: 60000,
  })

  // Ustvari naročilnico
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
      queryClient.invalidateQueries({ queryKey: queryKeys.inventory.forecast })
      queryClient.invalidateQueries({ queryKey: queryKeys.inventory.reorder })
      queryClient.invalidateQueries({ queryKey: queryKeys.inventory.all })
      setSelectedItems(new Set())
    },
  })

  const forecasts = forecastData?.forecasts || []
  const reorders = reorderData?.suggestions || []
  const summary = forecastData?.summary

  const toggleItem = useCallback((id: string) => {
    const next = new Set(selectedItems)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelectedItems(next)
  }, [selectedItems])

  const handleCreateReorder = useCallback(() => {
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
  }, [reorders, selectedItems, reorderMutation])

  const handleRefresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: queryKeys.inventory.forecast })
    queryClient.invalidateQueries({ queryKey: queryKeys.inventory.reorder })
  }, [queryClient])

  const handleSelectAll = useCallback(() => {
    setSelectedItems(new Set(reorders.map(r => r.inventoryItemId)))
  }, [reorders])

  return (
    <div className="space-y-6">
      {/* Glava */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Brain className="h-6 w-6 text-primary" />
            AI Prediktivna analitika
          </h2>
          <p className="text-muted-foreground">Napovedi povpraševanja, pametna naročila, sezonski vzorci</p>
        </div>
        <Button variant="outline" size="sm" onClick={handleRefresh} aria-label="Osveži podatke">
          <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Osveži
        </Button>
      </div>

      {/* Povzetek */}
      <SummaryCards summary={summary} />

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

        <TabsContent value="forecast" className="mt-4 space-y-3">
          <ForecastTab forecasts={forecasts} isLoading={forecastLoading} />
        </TabsContent>

        <TabsContent value="reorder" className="mt-4 space-y-3">
          <ReorderTab
            reorders={reorders}
            isLoading={reorderLoading}
            selectedItems={selectedItems}
            onToggleItem={toggleItem}
            onSelectAll={handleSelectAll}
            onCreateReorder={handleCreateReorder}
            isReorderPending={reorderMutation.isPending}
          />
        </TabsContent>

        <TabsContent value="analysis" className="mt-4 space-y-4">
          <AnalysisTab forecasts={forecasts} />
        </TabsContent>
      </Tabs>
    </div>
  )
})
