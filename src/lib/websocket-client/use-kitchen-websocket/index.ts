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

  // Vzpostavi povezavo ob mount, zapri ob unmount
  useEffect(() => {
    connect()
    return () => {
      disconnect()
    }
  }, [connect, disconnect])

  return { connected, lastEvent, reconnect, send }
}
