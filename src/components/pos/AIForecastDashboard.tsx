'use client'

// ============================================
// AI PREDIKTIVNA ANALÍTIKA ZALOGE
// Napovedi, pametna naročila, sezonski vzorci
// ============================================

import dynamic from 'next/dynamic'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Brain, ShoppingCart, BarChart3, RefreshCw } from 'lucide-react'
import { memo } from 'react'
import { useAIForecast } from './ai-forecast/useAIForecast'

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
  const {
    forecasts, forecastLoading,
    reorders, reorderLoading,
    summary, selectedItems,
    toggleItem, handleCreateReorder,
    handleRefresh, handleSelectAll,
    reorderMutation,
  } = useAIForecast()

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
