'use client'

import { useState, useCallback, memo, useRef, useEffect } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { Store } from 'lucide-react'
import { useFocusTrap } from '@/lib/use-focus-trap'
import { queryKeys } from '@/lib/query-keys'
import dynamic from 'next/dynamic'
import type { AuthUser, PinLoginProps } from './pin-login/constants'

// Lazy-loaded podkomponente
const PinDisplay = dynamic(() => import('./pin-login/PinDisplay').then(m => ({ default: m.PinDisplay })), { ssr: false })
const PinKeypad = dynamic(() => import('./pin-login/PinKeypad').then(m => ({ default: m.PinKeypad })), { ssr: false })

// Re-export UserIndicator iz podimenika
export { UserIndicator } from './pin-login/UserIndicator'

// ============================================
// TIP ZA PODATKE O PRIJAVLJENEM UPORABNIKU
// ============================================

// Globalno stanje za prijavljenega uporabnika in token
let currentUser: AuthUser | null = null
let authToken: string | null = null
export function getCurrentUser(): AuthUser | null {
  if (typeof window === 'undefined') return null
  try {
    // SECURITY: Uporabljamo SAMO sessionStorage — localStorage je ranljiv na XSS
    const stored = sessionStorage.getItem('pos_auth_user')
    if (stored) {
      currentUser = JSON.parse(stored)
      return currentUser
    }
  } catch {
    // sessionStorage ni na voljo (SSR ali poskodovani podatki) — vrni pomnilnisko stanje
  }
  return currentUser
}
export function setCurrentUser(user: AuthUser | null) {
  currentUser = user
  if (typeof window !== 'undefined') {
    if (user) {
      const json = JSON.stringify(user)
      sessionStorage.setItem('pos_auth_user', json)
      // SECURITY: Ne shrani v localStorage — token je XSS-extractable iz persistent storage
      // Uporabnik se mora ponovno prijaviti ob novi seji (sessionStorage izgine ob zaprtju zavihka)
    } else {
      sessionStorage.removeItem('pos_auth_user')
      sessionStorage.removeItem('pos_auth_token')
      // Pociri tudi localStorage ob odjavi (za primer, da so bili podatki shranjeni prej)
      localStorage.removeItem('pos_auth_user')
      localStorage.removeItem('pos_auth_token')
    }
  }
}
export function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null
  try {
    // SECURITY: Uporabljamo SAMO sessionStorage — localStorage je ranljiv na XSS
    const stored = sessionStorage.getItem('pos_auth_token')
    if (stored) {
      authToken = stored
      return authToken
    }
  } catch {
    // sessionStorage ni na voljo (SSR ali poskodovani podatki) — vrni pomnilnisko stanje
  }
  return authToken
}
export function setAuthToken(token: string | null) {
  authToken = token
  if (typeof window !== 'undefined') {
    if (token) {
      // SECURITY: SAMO sessionStorage — localStorage ne sme hraniti auth tokenov (XSS risk)
      sessionStorage.setItem('pos_auth_token', token)
    } else {
      sessionStorage.removeItem('pos_auth_token')
      // Pociri tudi localStorage ob odjavi (za primer, da je bil token shranjen prej)
      localStorage.removeItem('pos_auth_token')
    }
  }
}
/**
 * Profesionalna fetch wrapper, ki samodejno doda Authorization header
 * in CSRF zascito za mutirajoce zahtevke.
 * Uporaba: authFetch('/api/orders', { method: 'POST', body: ... })
 *
 * IMPORTANT: Vrne Response SAMO ce je res.ok. Ce ni ok, vrze Error z
 * sporocilom iz streznika. Tako React Query pravilno obravnava napake
 * in komponente ne dobijo error objektov namesto pravih podatkov.
 */
export async function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const token = getAuthToken()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }
  // FIX SECURITY: Dodaj CSRF zascito za mutirajoce zahtevke
  // Prebere CSRF token iz cookie-ja in ga poslje v glavi (Double Submit Cookie)
  const method = (options.method || 'GET').toUpperCase()
  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) {
    const csrfCookie = document.cookie
      .split('; ')
      .find(row => row.startsWith('restaurantos-csrf='))
    if (csrfCookie) {
      const csrfToken = csrfCookie.split('=')[1]
      if (csrfToken) {
        headers['x-csrf-token'] = csrfToken
      }
    }
  }
  const response = await fetch(url, {
    ...options,
    headers,
  })
  // Avtomatska odjava ob poteklem/neveljavnem token-u
  if (response.status === 401) {
    // Vedno pociri avtentikacijo ob 401 — token je neveljaven ali potekel
    setAuthToken(null)
    setCurrentUser(null)
    // Sprozi globalni dogodek za odjavo
    window.dispatchEvent(new CustomEvent('pos:auth-expired'))
  }
  // Vrzi napako za vse ne-uspesne odgovore, da React Query pravilno
  // obravnava napake in komponente ne poizkušajo klicati .filter() na
  // error objektih (npr. {error: "..."} namesto array-ja)
  if (!response.ok) {
    let errorMessage = `Napaka ${response.status}`
    try {
      const errorData = await response.json()
      errorMessage = errorData.error || errorMessage
    } catch {
      // Ce JSON parsanje ne uspe, uporabi privzeto sporocilo
    }
    throw new Error(errorMessage)
  }
  return response
}
export function hasPermission(permission: string): boolean {
  const user = getCurrentUser()
  if (!user) return false
  if (user.role === 'admin' || user.role === 'manager') return true
  return user.permissions.includes(permission) || user.permissions.includes('admin')
}

// ============================================
// PIN LOGIN KOMPONENTA
// ============================================
export const PinLogin = memo(function PinLogin({ onLogin, onSkip }: PinLoginProps) {
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const firstDigitRef = useRef<HTMLButtonElement>(null)
  const dialogRef = useFocusTrap<HTMLDivElement>(true)
  // A11y: Samodejno premakni fokus na prvo stevko ob prikazu
  useEffect(() => {
    const timer = setTimeout(() => firstDigitRef.current?.focus(), 100)
    return () => clearTimeout(timer)
  }, [])
  // Preveri ali so PIN-i na voljo
  const { data: authStatus } = useQuery({
    queryKey: queryKeys.auth.status,
    queryFn: async () => {
      const res = await fetch('/api/auth')
      if (!res.ok) return { authEnabled: false, employeesWithPin: 0 }
      return res.json()
    },
  })
  const loginMutation = useMutation({
    mutationFn: async (pinCode: string) => {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: pinCode }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Napaka pri prijavi')
      }
      return res.json()
    },
    onSuccess: (data) => {
      // Shrani uporabnika in token
      setCurrentUser(data.employee)
      setAuthToken(data.token)
      setPin('')
      setError('')
      toast.success(data.message)
      onLogin(data.employee)
    },
    onError: (err: Error) => {
      setError(err.message)
      setPin('')
    },
  })
  const handlePinSubmit = useCallback(() => {
    if (pin.length < 4) {
      setError('Vnesite vsaj 4 stevke')
      return
    }
    setError('')
    loginMutation.mutate(pin)
  }, [pin, loginMutation])
  const _handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handlePinSubmit()
  }, [handlePinSubmit])
  const handleDigit = useCallback((digit: string) => {
    if (pin.length < 6) {
      setPin(prev => prev + digit)
      setError('')
    }
  }, [pin])
  const handleBackspace = useCallback(() => {
    setPin(prev => prev.slice(0, -1))
    setError('')
  }, [])
  return (
    <div ref={dialogRef} className="flex items-center justify-center h-full bg-background" role="dialog" aria-modal="true" aria-label="PIN prijava">
      <Card className="w-full max-w-sm mx-4">
        <CardContent className="p-6 space-y-6">
          {/* Logo */}
          <div className="text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary text-primary-foreground mx-auto mb-3">
              <Store className="h-7 w-7" />
            </div>
            <h2 className="text-xl font-bold">RestaurantOS</h2>
            <p className="text-sm text-muted-foreground mt-1">Vnesite PIN za prijavo</p>
          </div>
          {/* PIN prikaz */}
          <PinDisplay pinLength={pin.length} />
          {/* Napaka */}
          {error && (
            <div className="text-center text-sm text-red-600 dark:text-red-400" role="alert">
              {error}
            </div>
          )}
          {/* Stevcna tipkovnica */}
          <PinKeypad
            onDigit={handleDigit}
            onBackspace={handleBackspace}
            onSubmit={handlePinSubmit}
            disabled={loginMutation.isPending || pin.length < 4}
            firstDigitRef={firstDigitRef}
          />
          {/* Preskoci gumb */}
          {onSkip && (
            <div className="text-center pt-2">
              <Button variant="ghost" className="text-xs text-muted-foreground" onClick={onSkip} aria-label="Preskoci prijavo">
                Preskoci prijavo
              </Button>
              {authStatus && !authStatus.authEnabled && (
                <p className="text-[10px] text-muted-foreground mt-1">Ni zaposlenih s PIN-om — nastavite PIN v Zaposleni</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
})
