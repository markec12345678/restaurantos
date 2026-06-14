'use client'

import { useState, useEffect, useCallback, memo } from 'react'
import { BellRing } from 'lucide-react'
import type { InventoryItemRow, SupplierRow } from '@/lib/types'
import { toast } from 'sonner'
import { authFetch } from '@/components/pos/PinLogin'
import dynamic from 'next/dynamic'
import {
  type InventoryAlert,
  DEFAULT_ALERT_SETTINGS,
} from './inventory-alerts/constants'

// Lazy-loaded podkomponente
const AlertSummaryCards = dynamic(() => import('./inventory-alerts/AlertSummaryCards').then(m => ({ default: m.AlertSummaryCards })), { ssr: false })
const AlertFilterBar = dynamic(() => import('./inventory-alerts/AlertFilterBar').then(m => ({ default: m.AlertFilterBar })), { ssr: false })
const AlertCard = dynamic(() => import('./inventory-alerts/AlertCard').then(m => ({ default: m.AlertCard })), { ssr: false })
const AlertEmptyState = dynamic(() => import('./inventory-alerts/AlertEmptyState').then(m => ({ default: m.AlertEmptyState })), { ssr: false })

export const InventoryAlerts = memo(function InventoryAlerts() {
  const [alerts, setAlerts] = useState<InventoryAlert[]>([])
  const [settings] = useState(DEFAULT_ALERT_SETTINGS)
  const [_loading, setLoading] = useState(true)
  const [filterSeverity, setFilterSeverity] = useState<string>('all')
  const [autoOrdering, setAutoOrdering] = useState<Set<string>>(new Set())

  // ============================================
  // NALAGANJE PODATKOV
  // ============================================

  useEffect(() => {
    loadAlerts()
    const interval = setInterval(loadAlerts, 60000) // Osveži vsako minuto
    return () => clearInterval(interval)
  }, [])

  const loadAlerts = async () => {
    try {
      // Naloži zaloge
      const invRes = await authFetch('/api/inventory')
      const invData = await invRes.json()
      // Naloži dobavitelje
      const supRes = await authFetch('/api/suppliers')
      const supData = await supRes.json()
      // Naloži nabavna naročila za izračun dnevne porabe
      const poRes = await authFetch('/api/purchase-orders')
      const _poData = await poRes.json()
      // Zgradi alerte
      const alertList: InventoryAlert[] = (invData || []).map((item: InventoryItemRow) => {
        const currentStock = (item.currentStock as number) || item.quantity || 0
        const minStock = (item.minStock as number) || item.minQuantity || 0
        const dailyUsage = (item.dailyUsage as number) || Math.max(1, Math.floor(minStock * 0.3))
        const daysUntilEmpty = dailyUsage > 0 ? Math.floor(currentStock / dailyUsage) : 999
        let severity: 'critical' | 'warning' | 'low' = 'low'
        if (daysUntilEmpty <= settings.criticalThreshold || currentStock <= 0) {
          severity = 'critical'
        } else if (daysUntilEmpty <= settings.warningThreshold || currentStock <= minStock) {
          severity = 'warning'
        }
        // FIX HIGH: Shrani tako supplier ID (za API klice) kot ime (za prikaz)
        const supplierObj = supData?.find?.((s: SupplierRow) => s.id === item.supplierId)
        const supplierId = supplierObj?.id || item.supplierId || null
        const supplierName = supplierObj?.name || null
        const suggestedOrderQty = Math.max(minStock * 3 - currentStock, minStock)
        return {
          id: item.id,
          itemName: item.name || (item.itemName as string) || 'Neznan artikel',
          currentStock,
          minStock,
          unit: item.unit || 'kos',
          category: item.category || 'Splošno',
          supplier: supplierName,
          supplierId, // FIX: Pravilen ID za API klice
          dailyUsage,
          daysUntilEmpty,
          severity,
          lastRestocked: (item.lastRestocked as string | null) || null,
          autoOrderSuggested: severity === 'critical' && supplierId !== null,
          suggestedOrderQty: Math.ceil(suggestedOrderQty),
        }
      })
      // Sortiraj po resnosti
      alertList.sort((a, b) => {
        const severityOrder = { critical: 0, warning: 1, low: 2 }
        return severityOrder[a.severity] - severityOrder[b.severity]
      })
      setAlerts(alertList)
    } catch {
      toast.error('Napaka pri nalaganju opozoril zaloge')
    } finally {
      setLoading(false)
    }
  }

  // ============================================
  // HANDLERJI
  // ============================================

  const handleAutoOrder = useCallback(async (alert: InventoryAlert) => {
    setAutoOrdering(prev => new Set(prev).add(alert.id))
    try {
      await authFetch('/api/purchase-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplierId: alert.supplierId || alert.supplier, // FIX HIGH: Uporabi ID, ne ime dobavitelja
          items: [{
            inventoryItemId: alert.id,
            itemName: alert.itemName,
            quantity: alert.suggestedOrderQty,
            unit: alert.unit,
          }],
          status: 'pending',
          notes: `Samodejno naročilo — zaloga kritična (${alert.currentStock} ${alert.unit})`,
        }),
      })
      // Osveži alerte
      await loadAlerts()
    } catch {
      toast.error('Napaka pri ustvarjanju naročila')
    } finally {
      setAutoOrdering(prev => {
        const next = new Set(prev)
        next.delete(alert.id)
        return next
      })
    }
  }, [])

  const handleMarkRestocked = useCallback(async (alertId: string) => {
    try {
      await authFetch(`/api/inventory/${alertId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lastRestocked: new Date().toISOString() }),
      })
      await loadAlerts()
    } catch {
      toast.error('Napaka pri označevanju zaloge')
    }
  }, [])

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
