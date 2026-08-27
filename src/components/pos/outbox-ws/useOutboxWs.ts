// ============================================
// USE OUTBOX WS — Real-time outbox monitoring hook
// ============================================
// Uporablja WebSocket za push-notifikacije o spremembah outbox-a,
// namesto polling-a vsakih 10s.
//
// Komunikacija:
//   1. Client se poveže na /ws?token=xxx
//   2. Pošlje: { type: 'SUBSCRIBE_OUTBOX' }
//   3. Server pošilja: { type: 'OUTBOX_UPDATE', payload: { stats, recentEvents } }
// ============================================

'use client'

import { useEffect, useState, useRef, useCallback } from 'react'

export interface OutboxStats {
  pending: number
  processing: number
  sent: number
  failed: number
  dead_letter: number
  oldestPending?: string
}

export interface OutboxUpdate {
  stats: OutboxStats
  recentFailures: Array<{
    id: string
    target: string
    eventType: string
    lastError: string
    attempts: number
    createdAt: string
  }>
}

interface UseOutboxWsOptions {
  token?: string
  onStatsUpdate?: (stats: OutboxStats) => void
  onNewFailure?: (event: OutboxUpdate['recentFailures'][0]) => void
  enabled?: boolean
}

export function useOutboxWs(options: UseOutboxWsOptions = {}) {
  const { token, onStatsUpdate, onNewFailure, enabled = true } = options
  const [isConnected, setIsConnected] = useState(false)
  const [lastUpdate, setLastUpdate] = useState<OutboxUpdate | null>(null)
  const [error, setError] = useState<string | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const seenFailuresRef = useRef<Set<string>>(new Set())

  const connect = useCallback(() => {
    if (!enabled || !token) return
    if (wsRef.current?.readyState === WebSocket.OPEN) return

    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
      const wsUrl = `${protocol}//${window.location.host}/ws?token=${encodeURIComponent(token)}`

      const ws = new WebSocket(wsUrl)
      wsRef.current = ws

      ws.onopen = () => {
        setIsConnected(true)
        setError(null)
        // Naroči se na outbox updates
        ws.send(JSON.stringify({ type: 'SUBSCRIBE_OUTBOX' }))
      }

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data)
          if (msg.type === 'OUTBOX_UPDATE' && msg.payload) {
            const update = msg.payload as OutboxUpdate
            setLastUpdate(update)
            onStatsUpdate?.(update.stats)

            // Trigger callback za nove failures
            for (const failure of update.recentFailures || []) {
              if (!seenFailuresRef.current.has(failure.id)) {
                seenFailuresRef.current.add(failure.id)
                onNewFailure?.(failure)
              }
            }
          }
        } catch {
          // Ignore invalid JSON
        }
      }

      ws.onerror = () => {
        setError('WebSocket napaka')
        setIsConnected(false)
      }

      ws.onclose = () => {
        setIsConnected(false)
        wsRef.current = null
        // Auto-reconnect po 5 sekundah
        if (enabled) {
          reconnectTimeoutRef.current = setTimeout(connect, 5000)
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Neznana napaka')
    }
  }, [enabled, token, onStatsUpdate, onNewFailure])

  useEffect(() => {
    connect()

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
      }
      if (wsRef.current) {
        wsRef.current.close()
        wsRef.current = null
      }
    }
  }, [connect])

  // Manual reconnect
  const reconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close()
    }
    connect()
  }, [connect])

  return {
    isConnected,
    lastUpdate,
    error,
    reconnect,
  }
}
