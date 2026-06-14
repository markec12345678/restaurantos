'use client'

import { useEffect, useCallback, useRef } from 'react'
import { toast } from 'sonner'

interface ShortcutActions {
  onNewOrder?: () => void
  onPay?: () => void
  onSearch?: () => void
  onClearCart?: () => void
  onOrderList?: () => void
  onEscape?: () => void
}

// POS Keyboard shortcuts (inspired by Toast POS, Lightspeed, Square)
export function usePOSShortcuts(actions: ShortcutActions) {
  // FIX: Shranimo actions v ref — prepreči ponovno registracijo listenerja ob vsakem renderu
  const actionsRef = useRef(actions)
  useEffect(() => { actionsRef.current = actions })

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Don't trigger when typing in input fields
    const target = e.target as HTMLElement
    const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable
    const isCtrl = e.ctrlKey || e.metaKey

    // Ctrl+K / Cmd+K - Search (works even in inputs)
    if (isCtrl && e.key === 'k') {
      e.preventDefault()
      actionsRef.current.onSearch?.()
      return
    }

    // Escape - Close dialogs / clear search
    if (e.key === 'Escape') {
      actionsRef.current.onEscape?.()
      return
    }

    // Skip F-key shortcuts when in input fields
    if (isInput) return

    // F2 - New Order
    if (e.key === 'F2') {
      e.preventDefault()
      actionsRef.current.onNewOrder?.()
      toast.info('Novo naročilo', { duration: 1000 })
    }
    // F4 - Pay
    if (e.key === 'F4') {
      e.preventDefault()
      actionsRef.current.onPay?.()
    }
    // F5 - Order List (do NOT prevent default browser refresh in production)
    if (e.key === 'F5') {
      // FIX: F5 je standardni shortcut za osvežitev brskalnika — ne preprečiujemo ga več
      // Za seznama naročil uporabimo Ctrl+L namesto F5
      return
    }
    // Ctrl+L - Order List (nadomestek za F5)
    if (isCtrl && e.key === 'l') {
      e.preventDefault()
      actionsRef.current.onOrderList?.()
    }
    // F8 - Clear Cart
    if (e.key === 'F8') {
      e.preventDefault()
      actionsRef.current.onClearCart?.()
    }
  }, []) // FIX: Prazna odvisnost — actionsRef se vedno posodobi

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])
}
