'use client'

import { useEffect, useCallback } from 'react'
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
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Don't trigger when typing in input fields
    const target = e.target as HTMLElement
    const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable
    const isCtrl = e.ctrlKey || e.metaKey

    // Ctrl+K / Cmd+K - Search (works even in inputs)
    if (isCtrl && e.key === 'k') {
      e.preventDefault()
      actions.onSearch?.()
      return
    }

    // Escape - Close dialogs / clear search
    if (e.key === 'Escape') {
      actions.onEscape?.()
      return
    }

    // Skip F-key shortcuts when in input fields
    if (isInput) return

    // F2 - New Order
    if (e.key === 'F2') {
      e.preventDefault()
      actions.onNewOrder?.()
      toast.info('Novo naročilo', { duration: 1000 })
    }
    // F4 - Pay
    if (e.key === 'F4') {
      e.preventDefault()
      actions.onPay?.()
    }
    // F5 - Order List
    if (e.key === 'F5') {
      e.preventDefault()
      actions.onOrderList?.()
    }
    // F8 - Clear Cart
    if (e.key === 'F8') {
      e.preventDefault()
      actions.onClearCart?.()
    }
  }, [actions])

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])
}
