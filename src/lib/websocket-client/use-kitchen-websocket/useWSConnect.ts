'use client'

import { logger } from '@/lib/logger'
import type { WSMessage } from '../types'

// ============================================
// WebSocket connection creation + event handlers
// ============================================

export interface WSConnectionCallbacks {
  setConnected: (_v: boolean) => void
  setLastEvent: (_msg: WSMessage | null) => void
  invalidateRelevantQueries: (_type: string) => void
  startHeartbeat: (_ws: WebSocket) => void
  stopHeartbeat: () => void
  handlePong: () => void
  onEventRef: React.MutableRefObject<((_msg: WSMessage) => void) | undefined>
  tokenRef: React.MutableRefObject<string | null | undefined>
  autoReconnectRef: React.MutableRefObject<boolean>
  maxReconnectAttemptsRef: React.MutableRefObject<number>
  reconnectAttemptsRef: React.MutableRefObject<number>
  reconnectTimerRef: React.MutableRefObject<ReturnType<typeof setTimeout> | null>
  connectFnRef: React.MutableRefObject<() => void>
}

export function createWSConnection(callbacks: WSConnectionCallbacks): WebSocket | null {
  const {
    setConnected, setLastEvent, invalidateRelevantQueries,
    startHeartbeat, stopHeartbeat, handlePong,
    onEventRef, tokenRef,
    autoReconnectRef, maxReconnectAttemptsRef,
    reconnectAttemptsRef, reconnectTimerRef, connectFnRef,
  } = callbacks

  // Ustvari WebSocket povezavo
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  // FIX HIGH: Token NE sme biti v URL-ju — viden v logih, DevTools, referrerjih
  const wsUrl = `${protocol}//${window.location.host}/ws`

  try {
    const ws = new WebSocket(wsUrl)

    ws.onopen = () => {
      setConnected(true)
      reconnectAttemptsRef.current = 0
      logger.info('WS', 'Povezan na strežnik')

      // FIX HIGH: Vedno pošlji AUTH sporočilo po povezavi (token ni več v URL-ju)
      const currentToken = tokenRef.current
      // FIX M-6: Token je shranjen kot 'pos_auth_token', ne 'pos_token'
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

    return ws
  } catch (err: unknown) {
    logger.error('WS', 'Napaka pri vzpostavljanju povezave:', err)
    setConnected(false)
    return null
  }
}
