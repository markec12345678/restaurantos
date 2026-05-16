'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'

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

interface UseKitchenWebSocketOptions {
  /** Auto-reconnect on disconnect (default: true) */
  autoReconnect?: boolean
  /** Max reconnection attempts before giving up (default: 10) */
  maxReconnectAttempts?: number
  /** Called when a specific event is received */
  onEvent?: (message: WSMessage) => void
}

interface UseKitchenWebSocketReturn {
  /** Whether the WebSocket is currently connected */
  connected: boolean
  /** The last event received from the WebSocket */
  lastEvent: WSMessage | null
  /** Manually reconnect the WebSocket */
  reconnect: () => void
  /** Send a message through the WebSocket */
  send: (type: string, payload: unknown) => void
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
  } catch (err) {
    console.error('[WS Broadcast] Napaka:', err)
  }
}

// ============================================
// HOOK: useKitchenWebSocket
// ============================================

export function useKitchenWebSocket(options: UseKitchenWebSocketOptions = {}): UseKitchenWebSocketReturn {
  const {
    autoReconnect = true,
    maxReconnectAttempts = 10,
    onEvent,
  } = options

  const queryClient = useQueryClient()
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectAttemptsRef = useRef(0)
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const connectFnRef = useRef<() => void>(() => {})
  const [connected, setConnected] = useState(false)
  const [lastEvent, setLastEvent] = useState<WSMessage | null>(null)

  // Heartbeat refs
  const pingIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const missedPingsRef = useRef(0)

  // Invalidacija React Query po dogodkih
  const invalidateRelevantQueries = useCallback((eventType: string) => {
    switch (eventType) {
      case 'NEW_ORDER':
      case 'ORDER_UPDATED':
      case 'ORDER_CANCELLED':
        queryClient.invalidateQueries({ queryKey: ['kitchen'] })
        queryClient.invalidateQueries({ queryKey: ['orders'] })
        queryClient.invalidateQueries({ queryKey: ['dashboard'] })
        queryClient.invalidateQueries({ queryKey: ['sidebar-orders'] })
        break
      case 'ITEM_STATUS_CHANGED':
        queryClient.invalidateQueries({ queryKey: ['kitchen'] })
        queryClient.invalidateQueries({ queryKey: ['orders'] })
        break
      case 'STOCK_LOW':
      case 'STOCK_OUT':
        queryClient.invalidateQueries({ queryKey: ['inventory'] })
        queryClient.invalidateQueries({ queryKey: ['menu-stock'] })
        queryClient.invalidateQueries({ queryKey: ['dashboard'] })
        queryClient.invalidateQueries({ queryKey: ['notification-low-stock'] })
        break
      case 'ORDER_FIRED':
      case 'ORDER_READY':
        queryClient.invalidateQueries({ queryKey: ['orders'] })
        queryClient.invalidateQueries({ queryKey: ['kitchen'] })
        queryClient.invalidateQueries({ queryKey: ['dashboard'] })
        break
    }
  }, [queryClient])

  // Shranimo onEvent v ref, da se izognemo ponovnemu povezovanju ob spremembi
  const onEventRef = useRef(onEvent)
  useEffect(() => { onEventRef.current = onEvent })

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
    const wsUrl = `${protocol}//${window.location.host}/ws`

    try {
      const ws = new WebSocket(wsUrl)
      wsRef.current = ws

      ws.onopen = () => {
        setConnected(true)
        reconnectAttemptsRef.current = 0
        missedPingsRef.current = 0
        console.log('[WS] Povezan na strežnik')

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
              console.warn('[WS] Preveč zamujenih pingov, zapiram povezavo')
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
        } catch (err) {
          console.error('[WS] Napaka pri razčlenjevanju sporočila:', err)
        }
      }

      ws.onclose = (event) => {
        setConnected(false)
        wsRef.current = null
        if (pingIntervalRef.current) {
          clearInterval(pingIntervalRef.current)
          pingIntervalRef.current = null
        }
        console.log(`[WS] Povezava zaprta (koda: ${event.code})`)

        // Samodejno ponovno poveži z eksponentnim zakasnitvijo
        if (autoReconnect && event.code !== 1000) {
          const attempts = reconnectAttemptsRef.current
          if (attempts < maxReconnectAttempts) {
            const delay = Math.min(1000 * Math.pow(2, attempts), 30000) // Max 30s
            console.log(`[WS] Ponovno povezovanje čez ${delay}ms (poskus ${attempts + 1}/${maxReconnectAttempts})`)
            reconnectTimerRef.current = setTimeout(() => {
              reconnectAttemptsRef.current++
              // Uporabi ref za povezavo, da se izognemo cirkularni odvisnosti
              connectFnRef.current()
            }, delay)
          }
        }
      }

      ws.onerror = (err) => {
        console.error('[WS] Napaka na povezavi:', err)
        if (pingIntervalRef.current) {
          clearInterval(pingIntervalRef.current)
          pingIntervalRef.current = null
        }
      }
    } catch (err) {
      console.error('[WS] Napaka pri vzpostavljanju povezave:', err)
      setConnected(false)
    }
  }, [autoReconnect, maxReconnectAttempts, invalidateRelevantQueries])

  // Posodobi ref, da onclose lahko kliče connect
  useEffect(() => { connectFnRef.current = connect })

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
    connect() // eslint-disable-line react-hooks/set-state-in-effect -- WebSocket connection initialization
    return () => {
      disconnect()
    }
  }, [connect, disconnect])

  return { connected, lastEvent, reconnect, send }
}
