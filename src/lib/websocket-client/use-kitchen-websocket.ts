'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { logger } from '@/lib/logger'
import type { WSMessage, UseKitchenWebSocketOptions, UseKitchenWebSocketReturn } from './types'
import { useWSQueryInvalidation } from './use-query-invalidation'
import { useHeartbeat } from './use-heartbeat'

// ============================================
// HOOK: useKitchenWebSocket
// ============================================

export function useKitchenWebSocket(options: UseKitchenWebSocketOptions = {}): UseKitchenWebSocketReturn {
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
  useEffect(() => {
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
  useEffect(() => { onEventRef.current = options.onEvent }, [options.onEvent])

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

    // Ustvari WebSocket povezavo
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    // FIX HIGH: Token NE sme biti v URL-ju — viden v logih, DevTools, referrerjih
    // Vedno uporabi AUTH sporočilo po povezavi namesto URL parametra
    const wsUrl = `${protocol}//${window.location.host}/ws`

    try {
      const ws = new WebSocket(wsUrl)
      wsRef.current = ws

      ws.onopen = () => {
        setConnected(true)
        reconnectAttemptsRef.current = 0
        logger.info('WS', 'Povezan na strežnik')

        // FIX HIGH: Vedno pošlji AUTH sporočilo po povezavi (token ni več v URL-ju)
        const currentToken = tokenRef.current
        // FIX M-6: Token je shranjen kot 'pos_auth_token', ne 'pos_token'
        // SECURITY: Uporabljamo SAMO sessionStorage (ne localStorage) za auth tokene
        const storedToken = typeof window !== 'undefined' ? sessionStorage.getItem('pos_auth_token') : null
        const authToken = currentToken || storedToken
        if (authToken) {
          ws.send(JSON.stringify({ type: 'AUTH', payload: { token: authToken } }))
        }

        // Identificiraj se
        ws.send(JSON.stringify({
          type: 'IDENTIFY',
          payload: {
            clientType: 'kds',
            clientName: typeof window !== 'undefined' ? window.location.hostname : 'unknown',
          },
        }))

        // Start heartbeat
        startHeartbeat(ws)
      }

      ws.onmessage = (event) => {
        try {
          const message: WSMessage = JSON.parse(event.data)

          // Preskoči interne dogodke
          if (message.type === 'CONNECTED') return

          // Handle pong response for heartbeat
          if (message.type === 'pong') {
            handlePong()
            return
          }

          setLastEvent(message)

          // Invalidiraj relevantne poizvedbe
          invalidateRelevantQueries(message.type)

          // Klici callback
          onEventRef.current?.(message)
        } catch (err: unknown) {
          logger.error('WS', 'Napaka pri razčlenjevanju sporočila:', err)
        }
      }

      ws.onclose = (event) => {
        setConnected(false)
        wsRef.current = null
        stopHeartbeat()
        logger.info('WS', `Povezava zaprta (koda: ${event.code})`)

        // Samodejno ponovno poveži z eksponentnim zakasnitvijo
        if (autoReconnectRef.current && event.code !== 1000) {
          const attempts = reconnectAttemptsRef.current
          if (attempts < maxReconnectAttemptsRef.current) {
            const delay = Math.min(1000 * Math.pow(2, attempts), 30000) // Max 30s
            logger.info('WS', `Ponovno povezovanje čez ${delay}ms (poskus ${attempts + 1}/${maxReconnectAttemptsRef.current})`)
            reconnectTimerRef.current = setTimeout(() => {
              reconnectAttemptsRef.current++
              // Uporabi ref za povezavo, da se izognemo cirkularni odvisnosti
              connectFnRef.current()
            }, delay)
          }
        }
      }

      ws.onerror = (err) => {
        logger.error('WS', 'Napaka na povezavi:', err)
        stopHeartbeat()
      }
    } catch (err: unknown) {
      logger.error('WS', 'Napaka pri vzpostavljanju povezave:', err)
      setConnected(false)
    }
  }, [invalidateRelevantQueries, startHeartbeat, stopHeartbeat, handlePong])

  useEffect(() => { connectFnRef.current = connect }, [connect])

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

  // Vzpostavi povezavo ob mount, zapri ob unmount
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- WebSocket lifecycle: connect on mount, disconnect on unmount
    connect()
    return () => {
      disconnect()
    }
  }, [connect, disconnect])

  return { connected, lastEvent, reconnect, send }
}
