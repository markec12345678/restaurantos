'use client'

import { useEffect } from 'react'
import { toast } from 'sonner'
import { Rocket } from 'lucide-react'

// ============================================
// PWA UPDATE TOAST — RUNDA 45
// ============================================
// register-sw.ts ob aktivaciji novega Service Workerja sproži CustomEvent
// 'ros:sw-update', kadar uporabnik aktivno uporablja stran (sveža < 15 s ali
// skrita → samodejni reload brez obvestila). Ta komponenta pokaže sonner
// toast z gumbom "Osveži zdaj" — uporabnik IZBERE trenutek (naročilo se ne
// prekine), toast je obveznost do konca seje (duration Infinity).
// ============================================

export function SwUpdateToast() {
  useEffect(() => {
    const handler = () => {
      toast('Na voljo je nova verzija aplikacije', {
        id: 'ros-sw-update',
        description: 'Namestitev je zaključena v ozadju. Osvežite, ko vam ustreza — potekajoče delo se ne prekine.',
        duration: Infinity,
        icon: <Rocket className="h-4 w-4 text-primary" aria-hidden="true" />,
        action: {
          label: 'Osveži zdaj',
          onClick: () => window.location.reload(),
        },
        classNames: {
          actionButton: 'bg-primary text-primary-foreground font-semibold',
        },
      })
    }
    window.addEventListener('ros:sw-update', handler)
    return () => window.removeEventListener('ros:sw-update', handler)
  }, [])

  // Toast se upodablja prek globalnega <Toaster /> v layoutu — tu ni UI
  return null
}
