'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/lib/query-keys'
import type { WaiterNotification, Order } from './types'
import { useWaiterSound } from './useWaiterSound'
import { useWaiterWebSocket } from './use-waiter-page/use-waiter-websocket'
import { useWaiterActions } from './use-waiter-page/use-waiter-actions'

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
  const [employee, setEmployee] = useState<{ id: string; name: string; role: string } | null>(null)
  const [activeTab, setActiveTab] = useState<'ready' | 'myorders' | 'alltables'>('ready')
  const [notifications, setNotifications] = useState<WaiterNotification[]>([])
  const [now, setNow] = useState(Date.now())
  const playSound = useWaiterSound()
  const timeoutRefs = useRef<NodeJS.Timeout[]>([])

  useEffect(() => {
    return () => { timeoutRefs.current.forEach(clearTimeout) }
  }, [])

  // FIX NAPAKA 8: Obnovi sejo — preveri več storage ključev
  // za kompatibilnost z glavno aplikacijo (pos_auth_user)
  useEffect(() => {
    try {
      const stored = localStorage.getItem('pos_employee')
      if (stored) {
        const emp = JSON.parse(stored)
        if (emp?.id && emp?.name && emp?.role) {
          setEmployee(emp)
          return
        }
      }
      // FIX NAPAKA 8: Poskusi uporabiti sejo iz glavne aplikacije (pos_auth_user)
      const storedAuth = localStorage.getItem('pos_auth_user') || sessionStorage.getItem('pos_auth_user')
      if (storedAuth) {
        const authUser = JSON.parse(storedAuth)
        if (authUser?.id && authUser?.name && authUser?.role) {
          const waiterEmployee = {
            id: authUser.id,
            name: authUser.name,
            role: authUser.role,
          }
          localStorage.setItem('pos_employee', JSON.stringify(waiterEmployee))
          setEmployee(waiterEmployee)
        }
      }
    } catch { /* Poškodovani podatki — zahtevaj ponovno prijavo */ }
  }, [])

  // Timer
  useEffect(() => { const i = setInterval(() => setNow(Date.now()), 10000); return () => clearInterval(i) }, [])

  const onNotification = useCallback((notif: WaiterNotification) => {
    setNotifications(prev => [notif, ...prev].slice(0, 20))
  }, [])

  const onOrderUpdate = useCallback(() => {
    // Will be used in websocket
  }, [])

  const { wsConnected } = useWaiterWebSocket(employee, playSound, onNotification, onOrderUpdate)

  // ─── Pridobi naročila ───
  const { data: ordersData, isLoading, refetch } = useQuery({
    queryKey: queryKeys.orders.waiter,
    queryFn: async () => {
      // FIX NAPAKA 8: Preveri več token ključev za kompatibilnost z glavno aplikacijo
      const token = localStorage.getItem('pos_token')
        || localStorage.getItem('pos_auth_token')
        || sessionStorage.getItem('pos_auth_token')
      const headers: Record<string, string> = {}
      if (token) headers.Authorization = `Bearer ${token}`
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
  const myOrders = employee ? allOrders.filter(o => o.employee?.id === employee.id) : []
  const ordersWithReady = allOrders.filter(o => o.items.some(i => i.status === 'ready') && !['completed', 'cancelled'].includes(o.status))

  const { handleMarkServed } = useWaiterActions(allOrders)

  const acknowledge = useCallback((id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, acknowledged: true } : n))
    const timeout = setTimeout(() => setNotifications(prev => prev.filter(n => n.id !== id)), 2000)
    timeoutRefs.current.push(timeout)
  }, [])

  const getElapsed = useCallback((dateStr: string | null) => {
    if (!dateStr) return 0
    return Math.floor((now - new Date(dateStr).getTime()) / 60000)
  }, [now])

  const unacknowledged = notifications.filter(n => !n.acknowledged)

  return {
    employee, activeTab, notifications, wsConnected, isLoading,
    allOrders, myOrders, ordersWithReady, unacknowledged, refetch,
    handleMarkServed, acknowledge, getElapsed, setActiveTab, setEmployee,
  }
}
