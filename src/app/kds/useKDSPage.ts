'use client'

import { useState, useCallback } from 'react'
import { useKDSSound } from './use-kds-sound'
import { useKDSSession, useKDSWebSocket } from './use-kds-page/use-kds-session'
import { useKDSOrders } from './use-kds-page/use-kds-orders'

// ═══════════════════════════════════════════════════════════════
// RestaurantOS — KDS Page Hook (Barrel)
// ═══════════════════════════════════════════════════════════════

export function useKDSPage() {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [stationFilter, setStationFilter] = useState<string>('all')
  const [_showRecall, setShowRecall] = useState(false)
  const [bumpedOrders, setBumpedOrders] = useState<string[]>([])
  const { play: playSound, playBump, toggle: toggleSound, isEnabled: isSoundEnabled } = useKDSSound()

  const session = useKDSSession()
  const { wsConnected } = useKDSWebSocket(session.employee, playSound)
  const orders = useKDSOrders(session.employee, bumpedOrders, stationFilter, setBumpedOrders)

  const handleRecall = useCallback(() => {
    setBumpedOrders([])
    setShowRecall(false)
  }, [])

  // Task 21: bump confirmation — ločen zvok od prihodnega pinga (kuhar sliši razliko)
  const { handleBump: bumpOrder, handleBumpItem: bumpOrderItem } = orders
  const handleBump = useCallback((orderId: string) => {
    playBump()
    bumpOrder(orderId)
  }, [bumpOrder, playBump])

  const handleBumpItem = useCallback((orderId: string, itemId: string) => {
    playBump()
    bumpOrderItem(orderId, itemId)
  }, [bumpOrderItem, playBump])

  return {
    employee: session.employee, setEmployee: session.setEmployee,
    isFullscreen: session.isFullscreen,
    viewMode, setViewMode,
    stationFilter, setStationFilter,
    wsConnected,
    isSoundEnabled, toggleSound,
    isLoading: orders.isLoading,
    activeOrders: orders.activeOrders,
    stations: orders.stations,
    filteredOrders: orders.filteredOrders,
    getElapsed: session.getElapsed,
    bumpedOrders,
    handleBump, handleBumpItem, handleRecall,
    refetch: orders.refetch,
    toggleFullscreen: session.toggleFullscreen,
  }
}
