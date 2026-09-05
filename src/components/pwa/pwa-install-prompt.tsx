'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Download, X, Smartphone } from 'lucide-react'

// ============================================
// PWA Install Prompt — poziv za namestitev aplikacije
// ============================================
// Prikaže se ko brskalnik sproži beforeinstallprompt event.
// Uporabnik lahko aplikacijo namesti na domači zaslon (Add to Home Screen).
// ============================================

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const DISMISSAL_KEY = 'ros-pwa-install-dismissed'
const DISMISSAL_DURATION = 7 * 24 * 60 * 60 * 1000 // 7 dni

export function PwaInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [visible, setVisible] = useState(false)
  const [installed, setInstalled] = useState(false)

  useEffect(() => {
    // Preveri ali je aplikacija že nameščena (PWA standalone način)
    if (window.matchMedia('(display-mode: standalone)').matches) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setInstalled(true)
      return
    }

    // Preveri ali je uporabnik že zavrnil (v zadnjih 7 dneh)
    const dismissed = localStorage.getItem(DISMISSAL_KEY)
    if (dismissed) {
      const dismissedAt = parseInt(dismissed, 10)
      if (Date.now() - dismissedAt < DISMISSAL_DURATION) {
        return // Ne prikaži znova 7 dni
      }
      localStorage.removeItem(DISMISSAL_KEY)
    }

    const handler = (e: Event) => {
      // Prepreči Chrome-ov privzeti prompt
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
      setVisible(true)
    }

    window.addEventListener('beforeinstallprompt', handler as EventListener)

    // Poslušaj tudi za appinstalled event
    const installedHandler = () => {
      setInstalled(true)
      setVisible(false)
      setDeferredPrompt(null)
    }
    window.addEventListener('appinstalled', installedHandler)

    return () => {
      window.removeEventListener('beforeinstallprompt', handler as EventListener)
      window.removeEventListener('appinstalled', installedHandler)
    }
  }, [])

  const handleInstall = async () => {
    if (!deferredPrompt) return
    await deferredPrompt.prompt()
    const choice = await deferredPrompt.userChoice
    if (choice.outcome === 'accepted') {
      setInstalled(true)
    } else {
      // Uporabnik je zavrnil — ne prikaži 7 dni
      localStorage.setItem(DISMISSAL_KEY, Date.now().toString())
    }
    setVisible(false)
    setDeferredPrompt(null)
  }

  const handleDismiss = () => {
    localStorage.setItem(DISMISSAL_KEY, Date.now().toString())
    setVisible(false)
  }

  if (installed || !visible || !deferredPrompt) return null

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 max-w-md w-full px-4 animate-in slide-in-from-bottom-4 duration-300">
      <Card className="shadow-2xl border-primary/30 bg-card/95 backdrop-blur">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 flex-shrink-0">
              <Smartphone className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm">Namesti aplikacijo</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                RestaurantOS lahko namestite na domači zaslon za hitri dostop in delo brez povezave.
              </p>
              <div className="flex items-center gap-2 mt-3">
                <Button size="sm" onClick={handleInstall} className="gap-1.5">
                  <Download className="h-3.5 w-3.5" />
                  Namesti
                </Button>
                <Button size="sm" variant="ghost" onClick={handleDismiss}>
                  <X className="h-3.5 w-3.5" />
                  Ne zdaj
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
