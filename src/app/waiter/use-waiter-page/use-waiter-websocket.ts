'use client'

import { useEffect, useState } from 'react'
import type { WaiterNotification } from '../types'

// ═══════════════════════════════════════════════════════════════
// Waiter WebSocket — Povezava in obvestila
// ═══════════════════════════════════════════════════════════════

export function useWaiterWebSocket(
  employee: { id: string; name: string; role: string } | null,
  playSound: () => void,
  onNotification: (_n: WaiterNotification) => void,
  onOrderUpdate: () => void,
) {
  const [wsConnected, setWsConnected] = useState(false)

  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const wsUrl = `${protocol}//${window.location.host}/ws`
    let ws: WebSocket | null = null
    let retries = 0

    const connect = () => {
      try {
        ws = new WebSocket(wsUrl)
        ws.onopen = () => { setWsConnected(true); retries = 0 }
        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data)
            if (data.type === 'order_ready' && data.data) {
              const d = data.data
              const isMyOrder = !d.waiterId || d.waiterId === employee?.id
              if (isMyOrder) {
                const notif: WaiterNotification = {
                  id: `w_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
                  orderId: d.orderId, orderNumber: d.orderNumber,
                  tableName: d.tableName, tableNumber: d.tableNumber,
                  waiterName: d.waiterName, itemName: d.itemName, itemQuantity: d.itemQuantity,
                  allReady: d.allReady, readyCount: d.readyCount, totalItems: d.totalItems,
                  readyItems: d.readyItems || [], timestamp: Date.now(), acknowledged: false,
                }
                onNotification(notif)
                playSound()
                if (navigator.vibrate) navigator.vibrate([200, 100, 200, 100, 200])
              }
            }
            if (data.type === 'order_update') {
              onOrderUpdate()
            }
          } catch {
            // Neveljavno sporočilo WebSocket — ignoriraj
          }
        }
        ws.onclose = () => { setWsConnected(false); ws = null; if (retries < 20) { retries++; setTimeout(connect, 5000) } }
        ws.onerror = () => { ws?.close() }
      } catch {
        // WebSocket povezava ni uspela — poskusi znova v onclose
      }
    }
    connect()
    return () => { ws?.close() }
  }, [employee, playSound, onNotification, onOrderUpdate])

  return { wsConnected }
}
