'use client'

import { useState, useCallback, useEffect, useMemo } from 'react'
import { useKDSSound } from './use-kds-sound'
import { useKDSReminder } from './use-kds-reminder'
import { useKDSSession, useKDSWebSocket } from './use-kds-page/use-kds-session'
import { useKDSOrders } from './use-kds-page/use-kds-orders'
import { useKDSMetrics } from './use-kds-page/use-kds-metrics'
import { KDS_DANGER_MINUTES } from '@/lib/kds-reminder'

// ═══════════════════════════════════════════════════════════════
// RestaurantOS — KDS Page Hook (Barrel)
// ═══════════════════════════════════════════════════════════════

export function useKDSPage() {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [stationFilter, setStationFilter] = useState<string>('all')
  // R133: metrike panel — UI stanje ob vzorcu viewMode (barrel hook)
  const [showMetrics, setShowMetrics] = useState(false)
  const [_showRecall, setShowRecall] = useState(false)
  const [bumpedOrders, setBumpedOrders] = useState<string[]>([])
  const { play: playSound, playBump, playReminder, toggle: toggleSound, isEnabled: isSoundEnabled, unlock: unlockSound } = useKDSSound()

  // R63: Web Audio autoplay politika — kuhinjski zaslon po reloadu ni
  // interaktiral → AudioContext suspended → pisk TIHO odpadejo. Prvi
  // pointerdown/keydown odklene (enkrat; unlock je idempotenten, oba
  // poslušalca sta once → po prvem sprožitvi sama odstanjana).
  useEffect(() => {
    window.addEventListener('pointerdown', unlockSound, { once: true })
    window.addEventListener('keydown', unlockSound, { once: true })
    return () => {
      window.removeEventListener('pointerdown', unlockSound)
      window.removeEventListener('keydown', unlockSound)
    }
  }, [unlockSound])

  const session = useKDSSession()
  const { wsConnected } = useKDSWebSocket(session.employee, playSound)
  const orders = useKDSOrders(session.employee, bumpedOrders, stationFilter, setBumpedOrders)
  // R133: metrike — useQuery enabled SAMO ko je panel odprt (ni prometa ob zaprtem)
  const metrics = useKDSMetrics(showMetrics)
  const toggleMetrics = useCallback(() => setShowMetrics(v => !v), [])
  const { getElapsed } = session

  // R64: opomnik nevarne cone — zvočna eskalacija vsakih 60 s za naročila
  // ≥ 25 min (rdeča cona), spoštuje preferenco zvoka (R63)
  useKDSReminder(orders.activeOrders, getElapsed, isSoundEnabled, playReminder)

  // R64: števec za rdeči čip v glavi (isti prag kot opomnik/rdeča kartica)
  const dangerCount = useMemo(
    () => orders.activeOrders.filter(o => getElapsed(o.firedAt) >= KDS_DANGER_MINUTES).length,
    [orders.activeOrders, getElapsed]
  )

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
    dangerCount,
    isLoading: orders.isLoading,
    activeOrders: orders.activeOrders,
    stations: orders.stations,
    filteredOrders: orders.filteredOrders,
    getElapsed: session.getElapsed,
    bumpedOrders,
    handleBump, handleBumpItem, handleRecall,
    refetch: orders.refetch,
    toggleFullscreen: session.toggleFullscreen,
    showMetrics, toggleMetrics,
    metrics,
  }
}
