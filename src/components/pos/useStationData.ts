'use client'

import { useState, useEffect, useCallback } from 'react'
import { OrderRow, OrderItemRow } from '@/lib/types'
import { authFetch } from '@/components/pos/PinLogin'
import { toast } from 'sonner'
import type { Station, StationOrder } from './kitchen-station/constants'
import { stationDefaults, typeMapping } from './kitchen-station/constants'

export function useStationData() {
  const [stations, setStations] = useState<Station[]>([])
  const [_loading, setLoading] = useState(true)

  const loadStations = useCallback(async () => {
    try {
      const ordersRes = await authFetch('/api/orders?status=in_kitchen')
      const ordersData = await ordersRes.json()
      const empRes = await authFetch('/api/employees')
      await empRes.json()

      const stationMap: Record<string, StationOrder[]> = {}
      stationDefaults.forEach(s => { stationMap[s.id] = [] })

      ;(ordersData || []).forEach((order: OrderRow) => {
        const items = order.items || order.orderItems || []
        items.forEach((item: OrderItemRow) => {
          const cat = (item.category || item.itemName || '').toLowerCase()
          let stationId = 'general'
          for (const [keyword, sId] of Object.entries(typeMapping)) {
            if (cat.includes(keyword)) { stationId = sId; break }
          }
          if (!stationMap[stationId]) stationId = 'prep'
          if (!stationMap[stationId]) stationId = 'grill'
          const startedAt = item.startedAt || order.createdAt
          const elapsed = startedAt ? Math.floor((Date.now() - new Date(startedAt).getTime()) / 60000) : 0
          stationMap[stationId]?.push({
            id: item.id || `${order.id}-${item.menuItemId}`,
            orderId: order.id,
            itemName: item.itemName || item.name || 'Artikel',
            quantity: item.quantity || 1,
            priority: (item.priority || order.priority) === 'rush' ? 'rush' : (item.priority || order.priority) === 'high' ? 'high' : 'normal',
            startedAt,
            estimatedMinutes: item.prepTime || 10,
            elapsedMinutes: elapsed,
            notes: item.notes || item.specialInstructions || null,
          })
        })
      })

      const activeStations: Station[] = stationDefaults.map(defaultStation => {
        const queue = stationMap[defaultStation.id] || []
        queue.sort((a, b) => {
          const prio = { rush: 0, high: 1, normal: 2 }
          return prio[a.priority] - prio[b.priority]
        })
        return { ...defaultStation, queue, currentLoad: queue.length, lastOrderAt: queue.length > 0 ? queue[0].startedAt : null }
      })
      setStations(activeStations)
    } catch {
      toast.error('Napaka pri nalaganju kuhinjskih postaj')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadStations()
    const interval = setInterval(loadStations, 10000)
    return () => clearInterval(interval)
  }, [loadStations])

  return { stations, setStations, loadStations }
}
