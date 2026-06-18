'use client'

import { useCallback, useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { queryKeys } from '@/lib/query-keys'
import type { OrderKDS } from '../types'

// ═══════════════════════════════════════════════════════════════
// KDS Orders — Poizvedbe, filtriranje in akcije
// ═══════════════════════════════════════════════════════════════

export function useKDSOrders(
  employee: { id: string; name: string; role: string } | null,
  bumpedOrders: string[],
  stationFilter: string,
  setBumpedOrders: (_ids: string[]) => void,
) {
  const queryClient = useQueryClient()

  const { data: ordersData, isLoading, refetch } = useQuery({
    queryKey: queryKeys.orders.kds,
    queryFn: async () => {
      const token = sessionStorage.getItem('pos_auth_token') || localStorage.getItem('pos_auth_token') || localStorage.getItem('pos_token')
      const headers: Record<string, string> = {}
      if (token) headers.Authorization = `Bearer ${token}`
      const [pendingRes, inProgressRes, readyRes] = await Promise.all([
        fetch('/api/orders?status=pending&limit=50', { headers }),
        fetch('/api/orders?status=in-progress&limit=50', { headers }),
        fetch('/api/orders?status=ready&limit=50', { headers }),
      ])
      if (!pendingRes.ok || !inProgressRes.ok || !readyRes.ok) return { pending: [], inProgress: [], ready: [] }
      const [pendingData, inProgressData, readyData] = await Promise.all([
        pendingRes.json(), inProgressRes.json(), readyRes.json(),
      ])
      const rawOrders = [
        ...(pendingData.orders || pendingData || []),
        ...(inProgressData.orders || inProgressData || []),
        ...(readyData.orders || readyData || []),
      ]

      // FIX FASE 2: Transform orders API response → OrderKDS format
      // - orderItems → items (z allergens + station iz menuItem.prepStation)
      // - DB-driven station routing (prej hardcoded "kuhinja"/"sank")
      const allOrders: OrderKDS[] = rawOrders.map((o: Record<string, unknown>) => {
        const rawItems = (o.orderItems || o.items || []) as Array<Record<string, unknown>>
        const items = rawItems.map((oi: Record<string, unknown>): Record<string, unknown> => {
          const menuItem = oi.menuItem as Record<string, unknown> | undefined
          const prepStation = menuItem?.prepStation as Record<string, unknown> | undefined
          // station = prepStation.type (kitchen, bar, pastry, grill) — DB-driven
          const station = prepStation?.type as string | null || prepStation?.name as string | null || null
          return {
            id: oi.id,
            name: oi.menuItemName || menuItem?.name || '',
            quantity: oi.quantity,
            status: oi.status,
            notes: oi.notes,
            // FIX FASE 1: allergens iz menuItem za kuhinjsko varnost
            allergens: menuItem?.allergens || null,
            // category + station iz menuItem (DB-driven routing)
            category: menuItem?.category as Record<string, unknown> | null,
            station,
            modifiers: (() => {
              try { return JSON.parse(String(oi.modifiersJson || '[]')) } catch { return [] }
            })(),
            firedAt: oi.firedAt || null,
            prepTimeMinutes: menuItem?.prepTimeMinutes || prepStation?.avgPrepTime || null,
          }
        })
        return {
          id: o.id,
          orderNumber: o.orderNumber,
          type: o.type,
          status: o.status,
          table: o.table as { number: number; area: string } | null,
          employee: o.employee as { name: string } | null,
          items,
          firedAt: o.firedAt || null,
          createdAt: o.createdAt,
          notes: o.notes as string | null,
          course: o.course as number | null,
          priority: o.priority as boolean,
        } as unknown as OrderKDS
      })

      const seen = new Set<string>()
      return allOrders.filter(o => { if (seen.has(o.id)) return false; seen.add(o.id); return true })
    },
    refetchInterval: 5000,
    enabled: !!employee,
  })

  const allOrders = ordersData || []

  const activeOrders = useMemo(() =>
    allOrders.filter(o =>
      !bumpedOrders.includes(o.id) &&
      o.items?.some(i => !['served', 'cancelled'].includes(i.status))
    ), [allOrders, bumpedOrders]
  )

  const stations = useMemo(() => {
    const s = new Set<string>()
    activeOrders.forEach(o => o.items?.forEach(i => { if (i.station) s.add(i.station) }))
    return ['all', ...Array.from(s)]
  }, [activeOrders])

  const filteredOrders = stationFilter === 'all'
    ? activeOrders
    : activeOrders.map(o => ({
        ...o,
        items: o.items.filter(i => !i.station || i.station === stationFilter || i.status === 'ready')
      })).filter(o => o.items.some(i => !['served', 'cancelled'].includes(i.status)))

  // ─── Akcije ───
  const handleBump = useCallback(async (orderId: string) => {
    const order = activeOrders.find(o => o.id === orderId)
    if (!order) return
    const activeItems = order.items.filter(i => !['served', 'cancelled'].includes(i.status))
    try {
      await Promise.all(activeItems.map(item =>
        fetch(`/api/orders/${orderId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('pos_token')}` },
          body: JSON.stringify({ action: 'item_status', itemId: item.id, status: 'ready' }),
        }).then(res => { if (!res.ok) throw new Error('Napaka') })
      ))
      setBumpedOrders([...bumpedOrders, orderId])
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.kds })
      toast.success(`Naročilo #${order.orderNumber} bump!`)
    } catch { toast.error('Napaka pri bump') }
  }, [activeOrders, bumpedOrders, queryClient, setBumpedOrders])

  const handleBumpItem = useCallback(async (orderId: string, itemId: string) => {
    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('pos_token')}` },
        body: JSON.stringify({ action: 'item_status', itemId, status: 'ready' }),
      })
      if (!res.ok) throw new Error('Napaka')
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.kds })
    } catch { toast.error('Napaka') }
  }, [queryClient])

  return {
    isLoading,
    refetch,
    activeOrders,
    stations,
    filteredOrders,
    handleBump,
    handleBumpItem,
  }
}
