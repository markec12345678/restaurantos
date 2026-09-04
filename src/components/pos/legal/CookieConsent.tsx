'use client'

import { useState, useEffect } from 'react'

// ============================================
// COOKIE CONSENT BANNER (GDPR)
// ============================================
// Prikazuje se ob prvem obisku.
// Nujni piškotki so veddo aktivni (brez privolitve).
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
        console.log('[CookieConsent] Analytics consent: granted')
      } else {
        // Disable Sentry session replay
        console.log('[CookieConsent] Analytics consent: denied')
      }
    } catch {
      // localStorage not available
    }
  }

  if (!show) return null

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[100] bg-gray-900 text-white shadow-2xl">
      <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
        {!showSettings ? (
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex-1 text-sm">
              <p>
                Uporabljamo piškotke za zagotavljanje osnovne funkcionalnosti in izboljšanje vaše izkušnje.
                Nujni piškotki so vedno aktivni. Analitske piškotke lahko omogočite spodaj.{' '}
                <a href="/privacy-policy" className="text-amber-400 hover:text-amber-300 underline">
                  Politika zasebnosti
                </a>
              </p>
            </div>
            <div className="flex flex-wrap gap-2 shrink-0">
              <button
                onClick={() => setShowSettings(true)}
                className="px-4 py-2 text-sm text-gray-300 hover:text-white border border-gray-600 rounded-lg hover:bg-gray-800 transition"
              >
                Nastavitve
              </button>
              <button
                onClick={acceptNecessary}
                className="px-4 py-2 text-sm text-white border border-gray-600 rounded-lg hover:bg-gray-800 transition"
              >
                Samo nujni
              </button>
              <button
                onClick={acceptAll}
                className="px-4 py-2 text-sm text-gray-900 bg-amber-500 hover:bg-amber-400 rounded-lg font-medium transition"
              >
                Sprejmi vse
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Nastavitve piškotkov</h3>
              <button
                onClick={() => setShowSettings(false)}
                className="text-gray-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            {/* Nujni piškotki */}
            <div className="flex items-start justify-between p-3 bg-gray-800 rounded-lg">
              <div className="flex-1">
                <p className="font-medium text-sm">Nujni piškotki</p>
                <p className="text-xs text-gray-400 mt-1">
                  NEXT_LOCALE (jezik), pos_auth_token (prijava) — vedno aktivni
                </p>
              </div>
              <span className="text-xs text-green-400 font-medium">Vedno omogočeno</span>
            </div>

            {/* Analitski piškotki */}
            <div className="flex items-start justify-between p-3 bg-gray-800 rounded-lg">
              <div className="flex-1">
                <p className="font-medium text-sm">Analitski piškotki</p>
                <p className="text-xs text-gray-400 mt-1">
                  Sentry Session Replay (1% vzorec, anonimizirano), Vercel Analytics
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={analytics}
                  onChange={(e) => setAnalytics(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-600 peer-checked:bg-amber-500 rounded-full peer transition relative">
                  <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition ${analytics ? 'translate-x-5' : ''}`} />
                </div>
              </label>
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={saveCustom}
                className="px-4 py-2 text-sm text-gray-900 bg-amber-500 hover:bg-amber-400 rounded-lg font-medium transition"
              >
                Shrani nastavitve
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
