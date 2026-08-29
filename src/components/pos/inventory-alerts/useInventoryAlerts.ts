'use client'

import { useState, useEffect, useCallback } from 'react'
import type { InventoryItemRow, SupplierRow } from '@/lib/types'
import { toast } from 'sonner'
import { authFetch } from '@/components/pos/PinLogin'
import {
  type InventoryAlert,
  DEFAULT_ALERT_SETTINGS,
} from './constants'

export function useInventoryAlerts() {
  const [alerts, setAlerts] = useState<InventoryAlert[]>([])
  const [settings] = useState(DEFAULT_ALERT_SETTINGS)
  const [_loading, setLoading] = useState(true)
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
      const invDataRaw = await invRes.json()
      // FIX TypeError: e.map is not a function — invData je lahko { items: [...] }
      const invData = Array.isArray(invDataRaw) ? invDataRaw : (invDataRaw?.items ?? [])
      // Naloži dobavitelje
      const supRes = await authFetch('/api/suppliers')
      const supDataRaw = await supRes.json()
      // FIX: supData je lahko { suppliers: [...] }
      const supData = Array.isArray(supDataRaw) ? supDataRaw : (supDataRaw?.suppliers ?? [])
      // Naloži nabavna naročila za izračun dnevne porabe
      const poRes = await authFetch('/api/purchase-orders')
      const _poData = await poRes.json()
      // Zgradi alerte
      const alertList: InventoryAlert[] = (Array.isArray(invData) ? invData : []).map((item: InventoryItemRow) => {
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
        const supplierObj = supData.find((s: SupplierRow) => s.id === item.supplierId)
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

  return {
    alerts,
    loading: _loading,
    autoOrdering,
    handleAutoOrder,
    handleMarkRestocked,
  }
}
