'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { queryKeys } from '@/lib/query-keys'

import type { OrderKDS } from './types'
import { useKDSSound } from './use-kds-sound'

// ═══════════════════════════════════════════════════════════════
// RestaurantOS — KDS Page Hook
// ═══════════════════════════════════════════════════════════════

export function useKDSPage() {
  const queryClient = useQueryClient()
  const [employee, setEmployee] = useState<{ id: string; name: string; role: string } | null>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [stationFilter, setStationFilter] = useState<string>('all')
  const [_showRecall, setShowRecall] = useState(false)
  const [wsConnected, setWsConnected] = useState(false)
  const [now, setNow] = useState(Date.now())
  const [bumpedOrders, setBumpedOrders] = useState<string[]>([])
  const { play: playSound, toggle: toggleSound, isEnabled: isSoundEnabled } = useKDSSound()

  // Obnovi sejo
  useEffect(() => {
    try {
      const stored = localStorage.getItem('pos_employee')
      if (stored) {
        const emp = JSON.parse(stored)
        if (emp?.id && emp?.name && emp?.role) setEmployee(emp)
      }
    } catch {
      // Poškodovani podatki v localStorage — ignoriraj in zahtevaj ponovno prijavo
    }
  }, [])

  // Timer
  useEffect(() => { const i = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(i) }, [])

  // Celozaslonski način
  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', handler)
    return () => document.removeEventListener('fullscreenchange', handler)
  }, [])

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {})
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {})
    }
  }, [])

  // ─── WebSocket ───
  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const wsUrl = `${protocol}//${window.location.host}/ws`
    let ws: WebSocket | null = null
    let retries = 0
    const connect = () => {
      try {
        ws = new WebSocket(wsUrl)
        ws.onopen = () => {
          setWsConnected(true); retries = 0
          const token = localStorage.getItem('pos_token')
          if (token) {
            ws?.send(JSON.stringify({ type: 'AUTH', token }))
          }
        }
        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data)
            if (data.type === 'new_order' || data.type === 'order_update' || data.type === 'order_ready') {
              queryClient.invalidateQueries({ queryKey: queryKeys.orders.kds })
              if (data.type === 'new_order') {
                playSound()
                if (navigator.vibrate) navigator.vibrate([200, 100, 200])
              }
            }
          } catch {
            // Neveljavno sporočilo WebSocket — ignoriraj
          }
        }
        ws.onclose = () => { setWsConnected(false); ws = null; if (retries < 30) { retries++; setTimeout(connect, 3000) } }
        ws.onerror = () => { ws?.close() }
      } catch {
        // WebSocket povezava ni uspela — poskusi znova v onclose
      }
    }
    if (employee) connect()
    return () => { ws?.close() }
  }, [employee, playSound, queryClient])

  // ─── Pridobi aktivna naročila ───
  const { data: ordersData, isLoading, refetch } = useQuery({
    queryKey: queryKeys.orders.kds,
    queryFn: async () => {
      const token = localStorage.getItem('pos_token')
      const headers: Record<string, string> = {}
      if (token) headers.Authorization = `Bearer ${token}`
      const [pendingRes, inProgressRes, readyRes] = await Promise.all([
        fetch('/api/orders?status=pending&limit=50', { headers }),
        fetch('/api/orders?status=in-progress&limit=50', { headers }),
        fetch('/api/orders?status=ready&limit=50', { headers }),
      ])
      if (!pendingRes.ok || !inProgressRes.ok || !readyRes.ok) throw new Error('Napaka pri nalaganju')
      const [pendingData, inProgressData, readyData] = await Promise.all([
        pendingRes.json(), inProgressRes.json(), readyRes.json(),
      ])
      const allOrders = [
        ...(pendingData.orders || pendingData || []),
        ...(inProgressData.orders || inProgressData || []),
        ...(readyData.orders || readyData || []),
      ] as OrderKDS[]
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

  const getElapsed = useCallback((dateStr: string | null) => {
    if (!dateStr) return 0
    return Math.floor((now - new Date(dateStr).getTime()) / 60000)
  }, [now])

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
      setBumpedOrders(prev => [...prev, orderId])
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.kds })
      toast.success(`Naročilo #${order.orderNumber} bump!`)
    } catch { toast.error('Napaka pri bump') }
  }, [activeOrders, queryClient])

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

  const handleRecall = useCallback(() => {
    setBumpedOrders([])
    setShowRecall(false)
  }, [])

  return {
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
  }
}
