'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { logger } from '@/lib/logger'
import { queryKeys } from '@/lib/query-keys'

// ============================================
// TIPI
// ============================================

export interface WSMessage {
  type: string
  payload: unknown
  timestamp: string
}

export type WSEventType =
  | 'NEW_ORDER'
  | 'ORDER_UPDATED'
  | 'ITEM_STATUS_CHANGED'
  | 'ORDER_CANCELLED'
  | 'ORDER_FIRED'
  | 'ORDER_READY'
  | 'STOCK_LOW'
  | 'STOCK_OUT'
  | 'CONNECTED'
  | 'SERVER_SHUTDOWN'
  | 'AUTH_SUCCESS'
  | 'AUTH_REQUIRED'

interface UseKitchenWebSocketOptions {
  /** Auto-reconnect on disconnect (default: true) */
  autoReconnect?: boolean
  /** Max reconnection attempts before giving up (default: 10) */
  maxReconnectAttempts?: number
  /** Called when a specific event is received */
  onEvent?: (_message: WSMessage) => void
  /** FIX CRITICAL: Bearer token za WS avtentikacijo */
  token?: string | null
}

interface UseKitchenWebSocketReturn {
  /** Whether the WebSocket is currently connected */
  connected: boolean
  /** The last event received from the WebSocket */
  lastEvent: WSMessage | null
  /** Manually reconnect the WebSocket */
  reconnect: () => void
  /** Send a message through the WebSocket */
  send: (_type: string, _payload: unknown) => void
}

// ============================================
// WS BROADCAST HELPER (za uporabo v API-jih)
// ============================================

/**
 * Pošlje WebSocket dogodek preko strežniškega broadcast-a
 * To funkcijo kličejo API rute, ko želijo obvestiti KDS odjemalce
 */
export async function broadcastWSEvent(type: WSEventType, payload: unknown): Promise<void> {
  try {
    await fetch('/api/ws-broadcast', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, payload }),
    })
  } catch (err: unknown) {
    logger.error('WS', 'Broadcast napaka:', err)
  }
}

// ============================================
// HOOK: useKitchenWebSocket
// ============================================

export function useKitchenWebSocket(options: UseKitchenWebSocketOptions = {}): UseKitchenWebSocketReturn {
  const queryClient = useQueryClient()
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

  // Heartbeat refs
  const pingIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const missedPingsRef = useRef(0)

  // Invalidacija React Query po dogodkih
  const invalidateRelevantQueries = useCallback((eventType: string) => {
    switch (eventType) {
      case 'NEW_ORDER':
      case 'ORDER_UPDATED':
      case 'ORDER_CANCELLED':
        queryClient.invalidateQueries({ queryKey: queryKeys.kitchen.all })
        queryClient.invalidateQueries({ queryKey: queryKeys.orders.all })
        queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all })
        queryClient.invalidateQueries({ queryKey: queryKeys.orders.sidebar })
        break
      case 'ITEM_STATUS_CHANGED':
        queryClient.invalidateQueries({ queryKey: queryKeys.kitchen.all })
        queryClient.invalidateQueries({ queryKey: queryKeys.orders.all })
        break
      case 'STOCK_LOW':
      case 'STOCK_OUT':
        queryClient.invalidateQueries({ queryKey: queryKeys.inventory.all })
        queryClient.invalidateQueries({ queryKey: queryKeys.inventory.menuStock })
        queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all })
        queryClient.invalidateQueries({ queryKey: queryKeys.inventory.lowStock })
        break
      case 'ORDER_FIRED':
      case 'ORDER_READY':
        queryClient.invalidateQueries({ queryKey: queryKeys.orders.all })
        queryClient.invalidateQueries({ queryKey: queryKeys.kitchen.all })
        queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all })
        break
    }
  }, [queryClient])

  // Shranimo onEvent v ref, da se izognemo ponovnemu povezovanju ob spremembi
  const onEventRef = useRef(options.onEvent)
  useEffect(() => { onEventRef.current = options.onEvent }, [options.onEvent])

  const disconnect = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current)
      reconnectTimerRef.current = null
    }
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current)
      pingIntervalRef.current = null
    }
    if (wsRef.current) {
      wsRef.current.onclose = null // Prepreči avtomatsko ponovno povezovanje
      wsRef.current.close(1000, 'Client disconnect')
      wsRef.current = null
    }
    setConnected(false)
  }, [])

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
        missedPingsRef.current = 0
        logger.info('WS', 'Povezan na strežnik')

        // FIX HIGH: Vedno pošlji AUTH sporočilo po povezavi (token ni več v URL-ju)
        const currentToken = tokenRef.current
        // FIX M-6: Token je shranjen kot 'pos_auth_token', ne 'pos_token'
        // SECURITY: Uporabljamo SAMO sessionStorage (ne localStorage) za auth tokene
        const storedToken = typeof window !== 'undefined' ? sessionStorage.getItem('pos_auth_token') : null
        const authToken = currentToken || storedToken
        if (authToken) {
          ws.send(JSON.stringify({
            type: 'AUTH',
            payload: { token: authToken },
          }))
        }

        // Identificiraj se
        ws.send(JSON.stringify({
          type: 'IDENTIFY',
          payload: {
            clientType: 'kds',
            clientName: typeof window !== 'undefined' ? window.location.hostname : 'unknown',
          },
        }))

        // Start heartbeat ping interval
        pingIntervalRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            missedPingsRef.current++
            if (missedPingsRef.current > 2) {
              logger.warn('WS', 'Preveč zamujenih pingov, zapiram povezavo')
              ws.close()
              return
            }
            ws.send(JSON.stringify({ type: 'ping' }))
          }
        }, 30000)
      }

      ws.onmessage = (event) => {
        try {
          const message: WSMessage = JSON.parse(event.data)

          // Preskoči interne dogodke
          if (message.type === 'CONNECTED') return

          // Handle pong response for heartbeat
          if (message.type === 'pong') {
            missedPingsRef.current = 0
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
        if (pingIntervalRef.current) {
          clearInterval(pingIntervalRef.current)
          pingIntervalRef.current = null
        }
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
        if (pingIntervalRef.current) {
          clearInterval(pingIntervalRef.current)
          pingIntervalRef.current = null
        }
      }
    } catch (err: unknown) {
      logger.error('WS', 'Napaka pri vzpostavljanju povezave:', err)
      setConnected(false)
    }
  }, [invalidateRelevantQueries])

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
