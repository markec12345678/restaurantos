'use client'
import { useState, useCallback, memo, useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { Store, LogIn, LogOut, User, KeyRound } from 'lucide-react'
import { useFocusTrap } from '@/lib/use-focus-trap'
import { queryKeys } from '@/lib/query-keys'
// ============================================
// TIP ZA PODATKE O PRIJAVLJENEM UPORABNIKU
// ============================================
interface AuthUser {
  id: string
  name: string
  email: string
  role: string
  primaryJob: { id: string; name: string; payRate: number } | null
  permissions: string[]
}
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
    // sessionStorage ni na voljo (SSR ali poškodovani podatki) — vrni pomnilniško stanje
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
      // Počisti tudi localStorage ob odjavi (za primer, da so bili podatki shranjeni prej)
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
    // sessionStorage ni na voljo (SSR ali poškodovani podatki) — vrni pomnilniško stanje
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
      // Počisti tudi localStorage ob odjavi (za primer, da je bil token shranjen prej)
      localStorage.removeItem('pos_auth_token')
    }
  }
}
/**
 * Profesionalna fetch wrapper, ki samodejno doda Authorization header
 * in CSRF zaščito za mutirajoče zahtevke.
 * Uporaba: authFetch('/api/orders', { method: 'POST', body: ... })
 *
 * IMPORTANT: Vrne Response SAMO če je res.ok. Če ni ok, vrže Error z
 * sporočilom iz strežnika. Tako React Query pravilno obravnava napake
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
  // FIX SECURITY: Dodaj CSRF zaščito za mutirajoče zahtevke
  // Prebere CSRF token iz cookie-ja in ga pošlje v glavi (Double Submit Cookie)
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
    // Vedno počisti avtentikacijo ob 401 — token je neveljaven ali potekel
    setAuthToken(null)
    setCurrentUser(null)
    // Sproži globalni dogodek za odjavo
    window.dispatchEvent(new CustomEvent('pos:auth-expired'))
  }
  // Vrži napako za vse ne-uspešne odgovore, da React Query pravilno
  // obravnava napake in komponente ne poizkušajo klicati .filter() na
  // error objektih (npr. {error: "..."} namesto array-ja)
  if (!response.ok) {
    let errorMessage = `Napaka ${response.status}`
    try {
      const errorData = await response.json()
      errorMessage = errorData.error || errorMessage
    } catch {
      // Če JSON parsanje ne uspe, uporabi privzeto sporočilo
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
export const PinLogin = memo(function PinLogin({ onLogin, onSkip }: { onLogin: (_user: AuthUser) => void; onSkip?: () => void }) {
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const firstDigitRef = useRef<HTMLButtonElement>(null)
  const dialogRef = useFocusTrap<HTMLDivElement>(true)
  // A11y: Samodejno premakni fokus na prvo števko ob prikazu
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
      setError('Vnesite vsaj 4 števke')
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
          <div className="flex justify-center gap-2" role="status" aria-label={`Vnesenih ${pin.length} od 4 števk`}>
            {[0, 1, 2, 3].map(i => (
              <div
                key={i}
                className={`h-10 w-10 rounded-lg border-2 flex items-center justify-center transition-colors ${
                  i < pin.length
                    ? 'border-primary bg-primary/10'
                    : 'border-border'
                }`}
                aria-hidden="true"
              >
                {i < pin.length && (
                  <div className="h-3 w-3 rounded-full bg-primary" />
                )}
              </div>
            ))}
          </div>
          {/* Napaka */}
          {error && (
            <div className="text-center text-sm text-red-600 dark:text-red-400" role="alert">
              {error}
            </div>
          )}
          {/* Števčna tipkovnica */}
          <div className="grid grid-cols-3 gap-2">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit, idx) => (
              <Button
                key={digit}
                ref={idx === 0 ? firstDigitRef : undefined}
                variant="outline"
                className="h-14 text-xl font-bold"
                onClick={() => handleDigit(digit)}
                aria-label={`Števka ${digit}`}
              >
                {digit}
              </Button>
            ))}
            <Button variant="ghost" className="h-14" onClick={handleBackspace} aria-label="Izbriši zadnjo števko">
              <KeyRound className="h-5 w-5" />
            </Button>
            <Button
              variant="outline"
              className="h-14 text-xl font-bold"
              onClick={() => handleDigit('0')}
            >
              0
            </Button>
            <Button
              className="h-14 bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={handlePinSubmit}
              disabled={loginMutation.isPending || pin.length < 4}
              aria-label="Potrdi PIN"
            >
              <LogIn className="h-5 w-5" />
            </Button>
          </div>
          {/* Preskoči gumb */}
          {onSkip && (
            <div className="text-center pt-2">
              <Button variant="ghost" className="text-xs text-muted-foreground" onClick={onSkip} aria-label="Preskoči prijavo">
                Preskoči prijavo
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
// ============================================
// UPORABNIŠKI INDICATOR (za Sidebar)
// ============================================
export const UserIndicator = memo(function UserIndicator() {
  const user = getCurrentUser()
  const queryClient = useQueryClient()
  if (!user) return null
  const handleLogout = async () => {
    // Pokliči DELETE /api/auth za uničenje seje
    try {
      const token = getAuthToken()
      await fetch('/api/auth', {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      })
    } catch {
      // Ignoriraj napake pri odjavi
    }
    setCurrentUser(null)
    setAuthToken(null)
    queryClient.invalidateQueries()
    toast.success('Uspešno odjavljen')
  }
  return (
    <div className="px-3 py-2 border-t border-border">
      <div className="flex items-center gap-2 text-xs">
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-primary flex-shrink-0">
          <User className="h-3.5 w-3.5" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium truncate">{user.name}</p>
          {user.primaryJob && (
            <p className="text-[10px] text-muted-foreground truncate">{user.primaryJob.name}</p>
          )}
        </div>
        <Button variant="ghost" size="icon" aria-label="Odjava" className="h-6 w-6 flex-shrink-0" onClick={handleLogout} title="Odjava">
          <LogOut className="h-3 w-3" />
        </Button>
      </div>
    </div>
  )
})
