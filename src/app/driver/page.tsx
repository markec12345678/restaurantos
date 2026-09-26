'use client'

import { useCallback, useEffect, useState } from 'react'
import { Bike } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { DriverApp } from './DriverApp'
import { extractErrorMessage, getStoredToken, setStoredToken } from './driver-context'

// =====================================================================
// RESTAURANTOS DRIVER — voznikov mobilni zaslon (R137-c, epic #115 P1-13)
// Standalone deep link /driver (voznik na telefonu); isti DriverApp teče
// tudi kot POS modul (module-registry 'driver').
//
// Auth: isti staff PIN kot KDS (KDSLogin kanon) — POST /api/auth { pin }
// → { token, employee }; žeton v localStorage 'pos_token'. Brez žetona →
// prijavni zaslon (minimalen form: PIN + gumb + napaka).
// i18n: hardcoded slovenščina (staff operational zaslon — KDS kanon);
// v i18n slovarje gre SAMO sidebar ključ 'nav.driver'.
// SSR-safe: window/localStorage šele po mountu (setTimeout(0) kanon,
// display/page.tsx vzorec).
// =====================================================================

function DriverLogin({ onLogin }: { onLogin: () => void }) {
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleLogin = async (): Promise<void> => {
    if (loading || pin.length < 4) return
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin }),
      })
      const data: unknown = await res.json().catch(() => null)
      const token =
        data && typeof data === 'object' && 'token' in data && typeof (data as { token: unknown }).token === 'string'
          ? (data as { token: string }).token
          : null
      if (!res.ok || !token) {
        setError(extractErrorMessage(data, 'Prijava ni uspela'))
        return
      }
      setStoredToken(token)
      onLogin()
    } catch {
      setError('Povezava ni na voljo')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background to-muted/30 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-2xl bg-sky-500 shadow-lg">
            <Bike className="size-10 text-white" aria-hidden />
          </div>
          <h1 className="text-2xl font-bold">Dostave</h1>
          <p className="mt-1 text-sm text-muted-foreground">Prijava voznika</p>
        </div>
        <div className="space-y-4 rounded-2xl border bg-card p-6 shadow-xl">
          <Input
            type="password"
            inputMode="numeric"
            maxLength={6}
            value={pin}
            onChange={(e) => {
              setPin(e.target.value.replace(/\D/g, ''))
              setError('')
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void handleLogin()
            }}
            placeholder="Vnesite PIN"
            autoFocus
            className="h-14 text-center font-mono text-3xl tracking-[0.5em]"
          />
          {error !== '' && (
            <p className="text-center text-sm text-red-500" role="alert">
              {error}
            </p>
          )}
          <Button
            className="min-h-14 w-full text-lg font-bold"
            disabled={loading || pin.length < 4}
            onClick={() => void handleLogin()}
          >
            {loading ? 'Prijava ...' : 'Prijava'}
          </Button>
          <p className="pt-2 text-center text-[10px] text-muted-foreground">
            Isti PIN kot blagajna / kuhinja
          </p>
        </div>
      </div>
    </div>
  )
}

export default function DriverPage() {
  // null = preverjanje žetona še poteka (SSR-safe: šele po mountu)
  const [authed, setAuthed] = useState<boolean | null>(null)

  useEffect(() => {
    // v setTimeout(0) — da ne sproži kaskadnega re-renderja iz effect bodyja
    // (react-hooks/set-state-in-effect kanon, display/page.tsx vzorec)
    const t = window.setTimeout(() => {
      setAuthed(getStoredToken() !== null)
    }, 0)
    return () => window.clearTimeout(t)
  }, [])

  // 401 med pollom/akcijo → DriverApp pokliče onLogout → prijavni zaslon
  const handleLogout = useCallback(() => setAuthed(false), [])

  if (authed === null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Bike className="size-8 animate-pulse text-muted-foreground" aria-hidden />
      </div>
    )
  }
  if (!authed) return <DriverLogin onLogin={() => setAuthed(true)} />
  return <DriverApp onLogout={handleLogout} />
}
