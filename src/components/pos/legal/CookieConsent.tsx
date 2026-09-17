'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Cookie, X, ShieldCheck } from 'lucide-react'
import { logger } from '@/lib/logger'

// ============================================
// COOKIE CONSENT BANNER (GDPR)
// ============================================
// QA runda 16 REDESIGN: plavajoča kartica (desno spodaj) namesto
// full-width traku — prej je banner (z-[100], bottom-0, celotna širina)
// POKRIVAL PIN-tipkovnico in glavne gumbe na tablicah → interceptal
// prve klike ob prvem obisku (worklog runda 15, točka 4).
// Kartica je neblokirajoča: nePREKRIVA interaktivnih elementov,
// ima slide-in animacijo, shadcn gumbe (44px tarče na tablicah)
// in design token-e (deluje v dark mode).
// Nujni piškotki so vedno aktivni (brez privolitve).
// Analitski piškotki zahtevajo privolitev.
// ============================================

const CONSENT_KEY = 'restaurantos-cookie-consent'
const CONSENT_VERSION = '1.0' // Povečaj ob spremembi politike

interface ConsentData {
  version: string
  accepted: boolean
  analytics: boolean
  timestamp: number
}

export function CookieConsent() {
  const [show, setShow] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [analytics, setAnalytics] = useState(false)
  // WCAG 2.3.3: upoštevaj prefers-reduced-motion — brez animacij
  const reduceMotion = useReducedMotion()

  useEffect(() => {
    try {
      const stored = localStorage.getItem(CONSENT_KEY)
      if (stored) {
        const data: ConsentData = JSON.parse(stored)
        // Pokaži če je različica zastarela
        if (data.version !== CONSENT_VERSION) {
          setShow(true)
          setAnalytics(data.analytics || false)
        }
      } else {
        setShow(true)
      }
    } catch {
      setShow(true)
    }
  }, [])

  const acceptAll = () => {
    saveConsent({ version: CONSENT_VERSION, accepted: true, analytics: true, timestamp: Date.now() })
    setShow(false)
  }

  const acceptNecessary = () => {
    saveConsent({ version: CONSENT_VERSION, accepted: true, analytics: false, timestamp: Date.now() })
    setShow(false)
  }

  const saveCustom = () => {
    saveConsent({ version: CONSENT_VERSION, accepted: true, analytics, timestamp: Date.now() })
    setShow(false)
  }

  const saveConsent = (data: ConsentData) => {
    try {
      localStorage.setItem(CONSENT_KEY, JSON.stringify(data))
      // Apply Sentry replay consent
      if (data.analytics && typeof window !== 'undefined') {
        // Enable Sentry session replay
        logger.info('CookieConsent', 'Analytics consent: granted')
      } else {
        // Disable Sentry session replay
        logger.info('CookieConsent', 'Analytics consent: denied')
      }
    } catch {
      // localStorage not available
    }
  }

  // Opomba: komponenta ostane mountana — AnimatePresence znotraj poskrbi za
  // exit animacijo ob setShow(false) (brez tega bi banner izginil trdo)
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          role="dialog"
          aria-label="Nastavitve piškotkov (GDPR privolitev)"
          initial={reduceMotion ? false : { opacity: 0, y: 24, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={reduceMotion ? undefined : { opacity: 0, y: 24, scale: 0.96 }}
          transition={reduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 320, damping: 28 }}
          className="fixed bottom-3 right-3 left-3 sm:left-auto sm:bottom-4 sm:right-4 z-[100] sm:max-w-sm rounded-xl border bg-popover text-popover-foreground shadow-2xl"
        >
          {!showSettings ? (
            <div className="p-4 space-y-3">
              <div className="flex items-start gap-2.5">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-500/15">
                  <Cookie className="h-4 w-4 text-amber-600 dark:text-amber-400" aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold leading-tight">Piškotki</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Nujni so vedno aktivni; analitika samo z vašo privolitvijo.{' '}
                    <a href="/privacy-policy" className="text-amber-600 dark:text-amber-400 underline underline-offset-2 hover:opacity-80">
                      Politika zasebnosti
                    </a>
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowSettings(true)}
                  className="pointer-coarse:h-11 pointer-coarse:px-4"
                >
                  Nastavitve
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={acceptNecessary}
                  className="pointer-coarse:h-11 pointer-coarse:px-4"
                >
                  Samo nujni
                </Button>
                <Button
                  size="sm"
                  onClick={acceptAll}
                  className="pointer-coarse:h-11 pointer-coarse:px-4 bg-amber-500 hover:bg-amber-600 text-white"
                >
                  Sprejmi vse
                </Button>
              </div>
            </div>
          ) : (
            <div className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="flex items-center gap-2 text-sm font-semibold">
                  <ShieldCheck className="h-4 w-4 text-amber-600 dark:text-amber-400" aria-hidden="true" />
                  Nastavitve piškotkov
                </h3>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Zapri nastavitve piškotkov"
                  onClick={() => setShowSettings(false)}
                  className="h-8 w-8"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </Button>
              </div>

              {/* Nujni piškotki */}
              <div className="flex items-start justify-between gap-3 rounded-lg border bg-muted/50 p-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">Nujni piškotki</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    NEXT_LOCALE (jezik), pos_auth_token (prijava) — vedno aktivni
                  </p>
                </div>
                <span className="shrink-0 text-xs font-medium text-green-600 dark:text-green-400">Vedno omogočeno</span>
              </div>

              {/* Analitski piškotki */}
              <div className="flex items-start justify-between gap-3 rounded-lg border bg-muted/50 p-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">Analitski piškotki</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Sentry Session Replay (1% vzorec, anonimizirano), Vercel Analytics
                  </p>
                </div>
                <label className="relative inline-flex shrink-0 cursor-pointer items-center">
                  <input
                    type="checkbox"
                    checked={analytics}
                    onChange={(e) => setAnalytics(e.target.checked)}
                    className="sr-only peer"
                    aria-label="Omogoči analitske piškotke"
                  />
                  <div className="w-11 h-6 bg-muted-foreground/30 peer-checked:bg-amber-500 rounded-full peer transition relative">
                    <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition ${analytics ? 'translate-x-5' : ''}`} />
                  </div>
                </label>
              </div>

              <div className="flex justify-end gap-2">
                <Button
                  size="sm"
                  onClick={saveCustom}
                  className="pointer-coarse:h-11 pointer-coarse:px-4 bg-amber-500 hover:bg-amber-600 text-white"
                >
                  Shrani nastavitve
                </Button>
              </div>
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
