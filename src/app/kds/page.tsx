'use client'
// ═══════════════════════════════════════════════════════════════
// RestaurantOS — KDS (Kitchen Display System) Standalone
// Celozaslonski kuhinjski zaslon za samostojno uporabo
// ═══════════════════════════════════════════════════════════════
import { ErrorBoundary } from '@/components/error-boundary'
import dynamic from 'next/dynamic'

import { useKDSPage } from './useKDSPage'

// Lazy-load podkomponente
const KDSLogin = dynamic(() => import('./KDSLogin').then(m => ({ default: m.KDSLogin })), { ssr: false })
const KDSHeader = dynamic(() => import('./KDSHeader').then(m => ({ default: m.KDSHeader })), { ssr: false })
const KDSOrderGrid = dynamic(() => import('./KDSOrderGrid').then(m => ({ default: m.KDSOrderGrid })), { ssr: false })

// ─── Glavna KDS stran ──────────────────────────────────────────
export default function KDSPage() {
  const {
    employee, setEmployee,
    isFullscreen,
    viewMode, setViewMode,
    stationFilter, setStationFilter,
    wsConnected,
    isSoundEnabled, toggleSound,
    isLoading,
    activeOrders,
    stations,
    filteredOrders,
    getElapsed,
    bumpedOrders,
    handleBump, handleBumpItem, handleRecall,
    refetch,
    toggleFullscreen,
  } = useKDSPage()

  // ─── Če ni prijavljen ───
  if (!employee) return <KDSLogin onLogin={setEmployee} />

  // ─── Render ───
  return (
    <ErrorBoundary context="KDS" maxRetries={3}>
    <div className="flex flex-col h-screen bg-background">
      <KDSHeader
        employeeName={employee.name}
        activeOrderCount={activeOrders.length}
        stations={stations}
        stationFilter={stationFilter}
        onStationFilterChange={setStationFilter}
        viewMode={viewMode}
        onViewModeToggle={() => setViewMode(v => v === 'grid' ? 'list' : 'grid')}
        isSoundEnabled={isSoundEnabled}
        onToggleSound={toggleSound}
        bumpedCount={bumpedOrders.length}
        onRecall={handleRecall}
        onRefresh={() => refetch()}
        wsConnected={wsConnected}
        isFullscreen={isFullscreen}
        onToggleFullscreen={toggleFullscreen}
      />
      <div className="flex-1 overflow-hidden">
        <KDSOrderGrid
          isLoading={isLoading}
          orders={filteredOrders}
          viewMode={viewMode}
          onBump={handleBump}
          onBumpItem={handleBumpItem}
          getElapsed={getElapsed}
        />
      </div>
    </div>
    </ErrorBoundary>
  )
}
