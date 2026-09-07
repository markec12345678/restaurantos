'use client'

import { useEffect } from 'react'
import { usePOSStore } from '@/lib/store'
import { haptic } from '@/lib/haptic'

// ============================================
// KEYBOARD SHORTCUTS HANDLER — globalni handler-ji
// ============================================
// Registrira keyboard shortcut-e za hitro navigacijo in akcije:
//   Ctrl+1 → Prodaja (POS)
//   Ctrl+2 → Kuhinja (KDS)
//   Ctrl+3 → Mize
//   Ctrl+4 → Blagajna
//   Ctrl+5 → Nadzorna plošča
//   Ctrl+N → Novo naročilo (dispatches event)
//   Ctrl+P → Plačaj (dispatches event)
// ============================================

const SHORTCUT_NAV: Record<string, string> = {
  '1': 'orders',
  '2': 'kitchen',
  '3': 'tables',
  '4': 'cash-register',
  '5': 'dashboard',
}

export function KeyboardShortcutsHandler() {
  const setActiveModule = usePOSStore(s => s.setActiveModule)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable

      // ─── Ctrl/Cmd + number → navigacija ───
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey) {
        const key = e.key
        if (SHORTCUT_NAV[key]) {
          e.preventDefault()
          setActiveModule(SHORTCUT_NAV[key])
          haptic('light')
          return
        }

        // Ctrl+N → Novo naročilo
        if (key === 'n' || key === 'N') {
          if (!isInput) {
            e.preventDefault()
            window.dispatchEvent(new CustomEvent('keyboard:new-order'))
            haptic('light')
          }
          return
        }

        // Ctrl+P → Plačaj
        if (key === 'p' || key === 'P') {
          if (!isInput) {
            e.preventDefault()
            window.dispatchEvent(new CustomEvent('keyboard:pay'))
            haptic('light')
          }
          return
        }

        // Ctrl+B → Bump (KDS)
        if (key === 'b' || key === 'B') {
          if (!isInput) {
            e.preventDefault()
            window.dispatchEvent(new CustomEvent('keyboard:bump'))
            haptic('light')
          }
          return
        }

        // Ctrl+D → Dodaj artikle
        if (key === 'd' || key === 'D') {
          if (!isInput) {
            e.preventDefault()
            window.dispatchEvent(new CustomEvent('keyboard:add-items'))
            haptic('light')
          }
          return
        }

        // Ctrl+V → Void (poniči)
        if (key === 'v' || key === 'V') {
          if (!isInput) {
            e.preventDefault()
            window.dispatchEvent(new CustomEvent('keyboard:void'))
            haptic('error')
          }
          return
        }
      }

      // ─── Esc → zapri dialog (原生 already handles, but dispatch for app) ───
      if (e.key === 'Escape') {
        window.dispatchEvent(new CustomEvent('keyboard:escape'))
      }
    }

    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [setActiveModule])

  return null // Renderless komponenta
}
