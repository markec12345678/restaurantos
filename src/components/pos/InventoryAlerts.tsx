'use client'

import { useState, memo } from 'react'
import { BellRing } from 'lucide-react'
import dynamic from 'next/dynamic'
import { useInventoryAlerts } from './inventory-alerts/useInventoryAlerts'

// Lazy-loaded podkomponente
const AlertSummaryCards = dynamic(() => import('./inventory-alerts/AlertSummaryCards').then(m => ({ default: m.AlertSummaryCards })), { ssr: false })
const AlertFilterBar = dynamic(() => import('./inventory-alerts/AlertFilterBar').then(m => ({ default: m.AlertFilterBar })), { ssr: false })
const AlertCard = dynamic(() => import('./inventory-alerts/AlertCard').then(m => ({ default: m.AlertCard })), { ssr: false })
const AlertEmptyState = dynamic(() => import('./inventory-alerts/AlertEmptyState').then(m => ({ default: m.AlertEmptyState })), { ssr: false })

export const InventoryAlerts = memo(function InventoryAlerts() {
  const { alerts, autoOrdering, handleAutoOrder, handleMarkRestocked } = useInventoryAlerts()
  const [filterSeverity, setFilterSeverity] = useState<string>('all')

  // ============================================
  // IZPELJANA STANJA
  // ============================================

  const filteredAlerts = filterSeverity === 'all'
    ? alerts
    : alerts.filter(a => a.severity === filterSeverity)
  const criticalCount = alerts.filter(a => a.severity === 'critical').length
  const warningCount = alerts.filter(a => a.severity === 'warning').length
  const lowCount = alerts.filter(a => a.severity === 'low').length

  // ============================================
  // RENDER
  // ============================================

  return (
    <div className="p-4 space-y-4 h-full overflow-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-100 dark:bg-orange-900/30">
            <BellRing className="h-5 w-5 text-orange-600 dark:text-orange-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Alarmi zalog</h2>
            <p className="text-sm text-muted-foreground">Spremljanje in upravljanje zalog v realnem času</p>
          </div>
        </div>
      </div>

      {/* Povzetek kartic */}
      <AlertSummaryCards criticalCount={criticalCount} warningCount={warningCount} lowCount={lowCount} />

      {/* Filtri */}
      <AlertFilterBar
        filterSeverity={filterSeverity}
        onFilterChange={setFilterSeverity}
        criticalCount={criticalCount}
        warningCount={warningCount}
        lowCount={lowCount}
      />

      {/* Seznam alertov */}
      <div className="space-y-3">
        {filteredAlerts.length === 0 ? (
          <AlertEmptyState />
        ) : (
          filteredAlerts.map(alert => (
            <AlertCard
              key={alert.id}
              alert={alert}
              isAutoOrdering={autoOrdering.has(alert.id)}
              onAutoOrder={handleAutoOrder}
              onMarkRestocked={handleMarkRestocked}
            />
          ))
        )}
      </div>
    </div>
  )
})
