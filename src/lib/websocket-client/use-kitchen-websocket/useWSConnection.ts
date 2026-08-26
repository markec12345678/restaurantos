'use client'

import { useRef, useState, useCallback } from 'react'
import type { WSMessage, UseKitchenWebSocketOptions } from '../types'
import { useWSQueryInvalidation } from '../use-query-invalidation'
import { useHeartbeat } from '../use-heartbeat'
import { createWSConnection } from './useWSConnect'

// ============================================
// WebSocket connection management hook
// ============================================

export function useWSConnection(options: UseKitchenWebSocketOptions = {}) {
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectAttemptsRef = useRef(0)
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const connectFnRef = useRef<() => void>(() => {})
  const [connected, setConnected] = useState(false)
  const [lastEvent, setLastEvent] = useState<WSMessage | null>(null)

  // FIX: Shranimo options v ref — prepreči ponovno povezovanje ob vsakem renderu
  const autoReconnectRef = useRef(options.autoReconnect ?? true)
  const maxReconnectAttemptsRef = useRef(options.maxReconnectAttempts ?? 10)
  const tokenRef = useRef(options.token)
  // Update refs inside effect to avoid render-phase ref writes (only on actual change)
  const updateOptionRefs = useCallback(() => {
    autoReconnectRef.current = options.autoReconnect ?? true
    maxReconnectAttemptsRef.current = options.maxReconnectAttempts ?? 10
    tokenRef.current = options.token
  }, [options.autoReconnect, options.maxReconnectAttempts, options.token])

  // Heartbeat
  const { startHeartbeat, stopHeartbeat, handlePong } = useHeartbeat()

  // Invalidacija React Query po dogodkih
  const invalidateRelevantQueries = useWSQueryInvalidation()

  // Shranimo onEvent v ref, da se izognemo ponovnemu povezovanju ob spremembi
  const onEventRef = useRef(options.onEvent)
  const updateOnEventRef = useCallback(() => {
    onEventRef.current = options.onEvent
  }, [options.onEvent])

  const disconnect = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current)
      reconnectTimerRef.current = null
    }
    stopHeartbeat()
    if (wsRef.current) {
      wsRef.current.onclose = null // Prepreči avtomatsko ponovno povezovanje
      wsRef.current.close(1000, 'Client disconnect')
      wsRef.current = null
    }
    setConnected(false)
  }, [stopHeartbeat])

  const connect = useCallback(() => {
    // Čiščenje prejšnje povezave
    if (wsRef.current) {
      wsRef.current.onopen = null
      wsRef.current.onclose = null
      wsRef.current.onmessage = null
      wsRef.current.onerror = null
      if (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING) {
        wsRef.current.close()
      }
    }

    const ws = createWSConnection({
      setConnected, setLastEvent, invalidateRelevantQueries,
      startHeartbeat, stopHeartbeat, handlePong,
      onEventRef, tokenRef,
      autoReconnectRef, maxReconnectAttemptsRef,
      reconnectAttemptsRef, reconnectTimerRef, connectFnRef,
    })
    wsRef.current = ws
  }, [invalidateRelevantQueries, startHeartbeat, stopHeartbeat, handlePong])

  const reconnect = useCallback(() => {
    disconnect()
    reconnectAttemptsRef.current = 0
    connect()
  }, [disconnect, connect])

  const send = useCallback((type: string, payload: unknown) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type,
        payload,
        timestamp: new Date().toISOString(),
      }))
    }
  }, [])

  return {
    wsRef,
    connectFnRef,
    connected,
    lastEvent,
    connect,
    disconnect,
    reconnect,
    send,
    updateOptionRefs,
    updateOnEventRef,
  }
}
