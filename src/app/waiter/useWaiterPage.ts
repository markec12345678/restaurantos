'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/lib/query-keys'

import type { WaiterNotification, Order } from './types'
import { useWaiterSound } from './useWaiterSound'

export interface WaiterPageState {
  employee: { id: string; name: string; role: string } | null
  activeTab: 'ready' | 'myorders' | 'alltables'
  notifications: WaiterNotification[]
  wsConnected: boolean
  isLoading: boolean
  allOrders: Order[]
  myOrders: Order[]
  ordersWithReady: Order[]
  unacknowledged: WaiterNotification[]
  refetch: () => void
  handleMarkServed: (_orderId: string, _itemIds?: string[]) => Promise<void>
  acknowledge: (_id: string) => void
  getElapsed: (_dateStr: string | null) => number
  setActiveTab: (_tab: 'ready' | 'myorders' | 'alltables') => void
  setEmployee: (_emp: { id: string; name: string; role: string } | null) => void
}

export function useWaiterPage(): WaiterPageState {
  const queryClient = useQueryClient()
  const [employee, setEmployee] = useState<{ id: string; name: string; role: string } | null>(null)
  const [activeTab, setActiveTab] = useState<'ready' | 'myorders' | 'alltables'>('ready')
  const [notifications, setNotifications] = useState<WaiterNotification[]>([])
  const [now, setNow] = useState(Date.now())
  const [wsConnected, setWsConnected] = useState(false)
  const playSound = useWaiterSound()

  // Refs for setTimeout cleanup on unmount
  const timeoutRefs = useRef<NodeJS.Timeout[]>([])

  // Cleanup all timeouts on unmount
  useEffect(() => {
    return () => {
      timeoutRefs.current.forEach(clearTimeout)
    }
  }, [])

  // Obnovi sejo
  useEffect(() => {
    try {
      const stored = localStorage.getItem('pos_employee')
      if (stored) {
        const emp = JSON.parse(stored)
        if (emp?.id && emp?.name && emp?.role) setEmployee(emp)
      }
    } catch {
      // Poškodovani podatki v localStorage — zahtevaj ponovno prijavo
    }
  }, [])

  // Timer
  useEffect(() => { const i = setInterval(() => setNow(Date.now()), 10000); return () => clearInterval(i) }, [])

  // ─── WebSocket za POS obvestila ───
  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const wsUrl = `${protocol}//${window.location.host}/ws`
    let ws: WebSocket | null = null
    let retries = 0

    const connect = () => {
      try {
        ws = new WebSocket(wsUrl)
        ws.onopen = () => { setWsConnected(true); retries = 0 }
        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data)
            if (data.type === 'order_ready' && data.data) {
              const d = data.data
              // Filtriraj: prikaži samo če je to natakarjevo naročilo ALI če ni dodeljeno
              const isMyOrder = !d.waiterId || d.waiterId === employee?.id
              if (isMyOrder) {
                const notif: WaiterNotification = {
                  id: `w_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
                  orderId: d.orderId, orderNumber: d.orderNumber,
                  tableName: d.tableName, tableNumber: d.tableNumber,
                  waiterName: d.waiterName, itemName: d.itemName, itemQuantity: d.itemQuantity,
                  allReady: d.allReady, readyCount: d.readyCount, totalItems: d.totalItems,
                  readyItems: d.readyItems || [], timestamp: Date.now(), acknowledged: false,
                }
                setNotifications(prev => [notif, ...prev].slice(0, 20))
                playSound()
                // Vibrate na Androidu
                if (navigator.vibrate) navigator.vibrate([200, 100, 200, 100, 200])
              }
            }
            if (data.type === 'order_update') {
              queryClient.invalidateQueries({ queryKey: queryKeys.orders.waiter })
            }
          } catch {
            // Neveljavno sporočilo WebSocket — ignoriraj
          }
        }
        ws.onclose = () => { setWsConnected(false); ws = null; if (retries < 20) { retries++; setTimeout(connect, 5000) } }
        ws.onerror = () => { ws?.close() }
      } catch {
        // WebSocket povezava ni uspela — poskusi znova v onclose
      }
    }
    connect()
    return () => { ws?.close() }
  }, [employee, playSound, queryClient])

  // ─── Pridobi naročila ───
  const { data: ordersData, isLoading, refetch } = useQuery({
    queryKey: queryKeys.orders.waiter,
    queryFn: async () => {
      const token = localStorage.getItem('pos_token')
      const headers: Record<string, string> = {}
      if (token) headers.Authorization = `Bearer ${token}`

      // FIX: Backend uses lowercase statuses: pending, in-progress, ready, completed
      const statuses = ['pending', 'in-progress', 'ready']
      const results = await Promise.all(
        statuses.map(s => fetch(`/api/orders?status=${encodeURIComponent(s)}`, { headers }).then(r => r.json()))
      )
      return results.flatMap(r => r.orders || []) as Order[]
    },
    refetchInterval: 10000,
    enabled: !!employee,
  })

  const allOrders = ordersData || []

  // Moja naročila (kjer je natakar = jaz)
  const myOrders = employee
    ? allOrders.filter(o => o.employee?.id === employee.id)
    : []

  // Naročila s pripravljenimi artikli
  // FIX: Backend item statuses are lowercase: ready, served, cancelled
  const ordersWithReady = allOrders.filter(o =>
    o.items.some(i => i.status === 'ready') && !['completed', 'cancelled'].includes(o.status)
  )

  // ─── Akcije ───
  const handleMarkServed = async (orderId: string, itemIds?: string[]) => {
    try {
      if (itemIds && itemIds.length > 0) {
        // Označi posamezne artikle kot SERVED
        await Promise.all(itemIds.map(itemId =>
          fetch(`/api/orders/${orderId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('pos_token')}` },
            body: JSON.stringify({ action: 'item_status', itemId, status: 'served' }),
          })
        ))
      } else {
        // Označi vse ready artikle kot SERVED
        const order = allOrders.find(o => o.id === orderId)
        if (!order) return
        const readyItems = order.items.filter(i => i.status === 'ready')
        await Promise.all(readyItems.map(item =>
          fetch(`/api/orders/${orderId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('pos_token')}` },
            body: JSON.stringify({ action: 'item_status', itemId: item.id, status: 'served' }),
          })
        ))
      }
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.waiter })
    } catch { /* toast.error('Napaka') */ }
  }

  const acknowledge = useCallback((id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, acknowledged: true } : n))
    const timeout = setTimeout(() => setNotifications(prev => prev.filter(n => n.id !== id)), 2000)
    timeoutRefs.current.push(timeout)
  }, [])

  const getElapsed = useCallback((dateStr: string | null) => {
    if (!dateStr) return 0
    return Math.floor((now - new Date(dateStr).getTime()) / 60000)
  }, [now])

  // Pripravljena naročila iz kuhinje
  const unacknowledged = notifications.filter(n => !n.acknowledged)

  return {
    employee,
    activeTab,
    notifications,
    wsConnected,
    isLoading,
    allOrders,
    myOrders,
    ordersWithReady,
    unacknowledged,
    refetch,
    handleMarkServed,
    acknowledge,
    getElapsed,
    setActiveTab,
    setEmployee,
  }
}
