'use client'

import { useEffect, useState, useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/lib/query-keys'

// ═══════════════════════════════════════════════════════════════
// KDS WebSocket — Povezava in poslušanje sporočil
// ═══════════════════════════════════════════════════════════════

export function useKDSWebSocket(
  employee: { id: string; name: string; role: string } | null,
  playSound: () => void,
) {
  const queryClient = useQueryClient()
  const [wsConnected, setWsConnected] = useState(false)

  useEffect(() => {
    // FIX NAPAKA 3: Na Vercelu WebSocket /ws ne obstaja — preskoči povezovanje.
    // Prepreči neskončne 404 errorje v konzoli + nesmiselne reconnect poskuse.
    const isVercel = typeof window !== 'undefined' && (
      window.location.hostname.endsWith('.vercel.app') ||
      process.env.NEXT_PUBLIC_WS_DISABLED === 'true'
    )
    if (isVercel) {
      // Polling bo prevzel osveževanje podatkov (glej useQuery refetchInterval)
      return
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const wsUrl = `${protocol}//${window.location.host}/ws`
    let ws: WebSocket | null = null
    let retries = 0
    const connect = () => {
      try {
        ws = new WebSocket(wsUrl)
        ws.onopen = () => {
          setWsConnected(true); retries = 0
          const token = localStorage.getItem('pos_token')
          if (token) {
            ws?.send(JSON.stringify({ type: 'AUTH', token }))
          }
        }
        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data)
            // FIX FASE 2: API pošilja uppercase (NEW_ORDER), klient je prej poslušal lowercase.
            // Normaliziraj na lowercase za konsistentnost.
            const msgType = (data.type || '').toLowerCase()
            if (msgType === 'new_order' || msgType === 'order_updated' || msgType === 'order_update' || msgType === 'item_status_changed' || msgType === 'item_status_update' || msgType === 'order_ready' || msgType === 'order_cancelled') {
              // Takoj invalidiraj KDS query — real-time refresh (ne čaka 5s polling)
              queryClient.invalidateQueries({ queryKey: queryKeys.orders.kds })
              if (msgType === 'new_order') {
                playSound()
                if (navigator.vibrate) navigator.vibrate([200, 100, 200])
              }
            }
          } catch {
            // Neveljavno sporočilo WebSocket — ignoriraj
          }
        }
        ws.onclose = () => { setWsConnected(false); ws = null; if (retries < 30) { retries++; setTimeout(connect, 3000) } }
        ws.onerror = () => { ws?.close() }
      } catch {
        // WebSocket povezava ni uspela — poskusi znova v onclose
      }
    }
    if (employee) connect()
    return () => { ws?.close() }
  }, [employee, playSound, queryClient])

  return { wsConnected }
}

// ═══════════════════════════════════════════════════════════════
// KDS Session & UI State — Obnova seje, timer, fullscreen
// ═══════════════════════════════════════════════════════════════

export function useKDSSession() {
  const [employee, setEmployee] = useState<{ id: string; name: string; role: string } | null>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [now, setNow] = useState(Date.now())

  // FIX NAPAKA 8: Obnovi sejo — preveri več storage ključev za kompatibilnost
  // z glavno aplikacijo (pos_auth_user) in starejšimi sejami (pos_employee)
  useEffect(() => {
    try {
      // Poskusi najprej pos_employee (KDS-specifična seja)
      const storedKds = localStorage.getItem('pos_employee')
      if (storedKds) {
        const emp = JSON.parse(storedKds)
        if (emp?.id && emp?.name && emp?.role) {
          setEmployee(emp)
          return
        }
      }
      // FIX NAPAKA 8: Če uporabnik ni prijavljen v KDS, poskusi uporabiti sejo
      // iz glavne aplikacije (pos_auth_user) — omogoči seamless prehod iz POS → KDS
      const storedAuth = localStorage.getItem('pos_auth_user') || sessionStorage.getItem('pos_auth_user')
      if (storedAuth) {
        const authUser = JSON.parse(storedAuth)
        if (authUser?.id && authUser?.name && authUser?.role) {
          // Konvertiraj AuthUser v KDS employee format
          const kdsEmployee = {
            id: authUser.id,
            name: authUser.name,
            role: authUser.role,
          }
          // Shrani tudi v pos_employee za prihodnje obiske
          localStorage.setItem('pos_employee', JSON.stringify(kdsEmployee))
          setEmployee(kdsEmployee)
        }
      }
    } catch {
      // Poškodovani podatki v localStorage — ignoriraj in zahtevaj ponovno prijavo
    }
  }, [])

  // Timer
  useEffect(() => { const i = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(i) }, [])

  // Celozaslonski način
  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', handler)
    return () => document.removeEventListener('fullscreenchange', handler)
  }, [])

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {})
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {})
    }
  }, [])

  const getElapsed = useCallback((dateStr: string | null) => {
    if (!dateStr) return 0
    return Math.floor((now - new Date(dateStr).getTime()) / 60000)
  }, [now])

  return { employee, setEmployee, isFullscreen, toggleFullscreen, getElapsed }
}
