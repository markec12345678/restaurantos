'use client'

import { useEffect } from 'react'
import type { UseKitchenWebSocketOptions, UseKitchenWebSocketReturn } from '../types'
import { useWSConnection } from './useWSConnection'

// ============================================
// HOOK: useKitchenWebSocket
// ============================================

export function useKitchenWebSocket(options: UseKitchenWebSocketOptions = {}): UseKitchenWebSocketReturn {
  const {
    connected,
    lastEvent,
    connect,
    disconnect,
    reconnect,
    send,
    connectFnRef,
    updateOptionRefs,
    updateOnEventRef,
  } = useWSConnection(options)

  // Update option refs on change
  useEffect(() => {
    updateOptionRefs()
  }, [updateOptionRefs])

  useEffect(() => {
    updateOnEventRef()
  }, [updateOnEventRef])

  useEffect(() => { connectFnRef.current = connect }, [connect, connectFnRef])

  // FIX NAPAKA 3: Na Vercelu (serverless) WebSocket /ws endpoint ne obstaja.
  // Preprečimo avtomatsko povezovanje, da ne generiramo 404 error-jev v konzoli
  // in neskončnih reconnect poskusov.
  // Detekcija: VERCEL_ENV env variabla je definirana samo na Vercelu.
  // Alternativno: NEXT_PUBLIC_WS_DISABLED flag lahko eksplicitno onemogoči WS.
  const wsDisabled = typeof window !== 'undefined' && (
    (process.env.NEXT_PUBLIC_WS_DISABLED === 'true') ||
    // Vercel: URL konča na .vercel.app ali pa ima VERCEL_ENV env
    (window.location.hostname.endsWith('.vercel.app'))
  )

  // Vzpostavi povezavo ob mount, zapri ob unmount
  // FIX NAPAKA 3: Skip connect, če je WS disabled
  useEffect(() => {
    if (wsDisabled) {
      // Ne vzpostavljaj povezave — polling bo prevzel osveževanje podatkov
      return
    }
    connect()
    return () => {
      disconnect()
    }
  }, [connect, disconnect, wsDisabled])

  return { connected, lastEvent, reconnect, send }
}
