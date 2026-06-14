'use client'

import { useRef } from 'react'
import { logger } from '@/lib/logger'

// ============================================
// HEARTBEAT LOGIKA (ping/pong za WS povezavo)
// ============================================

export function useHeartbeat() {
  const pingIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const missedPingsRef = useRef(0)

  function startHeartbeat(ws: WebSocket) {
    missedPingsRef.current = 0
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

  function stopHeartbeat() {
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current)
      pingIntervalRef.current = null
    }
  }

  function handlePong() {
    missedPingsRef.current = 0
  }

  return { startHeartbeat, stopHeartbeat, handlePong }
}
