'use client'

import { useState, useEffect, useCallback } from 'react'
import type { TrackingData } from './types'

// =====================================================================
// RESTAURANTOS ORDER TRACKING — Custom Hook
// =====================================================================

export function useOrderTracking() {
  const [orderNumber, setOrderNumber] = useState('')
  const [phone, setPhone] = useState('')
  const [tracking, setTracking] = useState<TrackingData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [autoRefresh, setAutoRefresh] = useState(false)

  const fetchTracking = useCallback(async () => {
    if (!orderNumber || !phone) return
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/public/order-track?orderNumber=${orderNumber}&phone=${encodeURIComponent(phone)}`)
      const data = await res.json()
      if (res.ok && data.order) {
        setTracking(data)
        // Auto-refresh dokler ni končano
        const finalStatuses = ['delivered', 'cancelled', 'completed']
        if (!finalStatuses.includes(data.order.status)) {
          setAutoRefresh(true)
        } else {
          setAutoRefresh(false)
        }
      } else {
        setError(data.error || 'Naročilo ni bilo najdeno')
        setTracking(null)
      }
    } catch {
      setError('Povezava ni na voljo')
    } finally {
      setLoading(false)
    }
  }, [orderNumber, phone])

  useEffect(() => {
    if (!autoRefresh || !tracking) return
    const interval = setInterval(fetchTracking, 15000) // 15s refresh
    return () => clearInterval(interval)
  }, [autoRefresh, fetchTracking, tracking])

  const resetTracking = useCallback(() => {
    setTracking(null)
    setAutoRefresh(false)
  }, [])

  return {
    orderNumber, setOrderNumber,
    phone, setPhone,
    tracking,
    loading,
    error,
    autoRefresh, setAutoRefresh,
    fetchTracking,
    resetTracking,
  }
}
