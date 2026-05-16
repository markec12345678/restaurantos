'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { Store, LogIn, LogOut, Shield, User, KeyRound } from 'lucide-react'

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
    // Poskusi sessionStorage (obnova znotraj seje)
    const stored = sessionStorage.getItem('pos_auth_user')
    if (stored) {
      currentUser = JSON.parse(stored)
      return currentUser
    }
    // Fallback na localStorage (persist med sejami)
    const localStored = localStorage.getItem('pos_auth_user')
    if (localStored) {
      currentUser = JSON.parse(localStored)
      sessionStorage.setItem('pos_auth_user', localStored)
      return currentUser
    }
  } catch {}
  return currentUser
}

export function setCurrentUser(user: AuthUser | null) {
  currentUser = user
  if (typeof window !== 'undefined') {
    if (user) {
      const json = JSON.stringify(user)
      sessionStorage.setItem('pos_auth_user', json)
      localStorage.setItem('pos_auth_user', json)
    } else {
      sessionStorage.removeItem('pos_auth_user')
      localStorage.removeItem('pos_auth_user')
      sessionStorage.removeItem('pos_auth_token')
      localStorage.removeItem('pos_auth_token')
    }
  }
}

export function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null
  try {
    const stored = sessionStorage.getItem('pos_auth_token')
    if (stored) {
      authToken = stored
      return authToken
    }
    // Fallback na localStorage
    const localStored = localStorage.getItem('pos_auth_token')
    if (localStored) {
      authToken = localStored
      sessionStorage.setItem('pos_auth_token', localStored)
      return authToken
    }
  } catch {}
  return authToken
}

export function setAuthToken(token: string | null) {
  authToken = token
  if (typeof window !== 'undefined') {
    if (token) {
      sessionStorage.setItem('pos_auth_token', token)
      localStorage.setItem('pos_auth_token', token)
    } else {
      sessionStorage.removeItem('pos_auth_token')
      localStorage.removeItem('pos_auth_token')
    }
  }
}

/**
 * Profesionalna fetch wrapper, ki samodejno doda Authorization header
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

export function PinLogin({ onLogin, onSkip }: { onLogin: (user: AuthUser) => void; onSkip?: () => void }) {
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')

  // Preveri ali so PIN-i na voljo
  const { data: authStatus } = useQuery({
    queryKey: ['auth-status'],
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

  const handlePinSubmit = () => {
    if (pin.length < 4) {
      setError('Vnesite vsaj 4 števke')
      return
    }
    setError('')
    loginMutation.mutate(pin)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handlePinSubmit()
  }

  const handleDigit = (digit: string) => {
    if (pin.length < 6) {
      setPin(prev => prev + digit)
      setError('')
    }
  }

  const handleBackspace = () => {
    setPin(prev => prev.slice(0, -1))
    setError('')
  }

  return (
    <div className="flex items-center justify-center h-full bg-background">
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
          <div className="flex justify-center gap-2">
            {[0, 1, 2, 3].map(i => (
              <div
                key={i}
                className={`h-10 w-10 rounded-lg border-2 flex items-center justify-center transition-colors ${
                  i < pin.length
                    ? 'border-primary bg-primary/10'
                    : 'border-border'
                }`}
              >
                {i < pin.length && (
                  <div className="h-3 w-3 rounded-full bg-primary" />
                )}
              </div>
            ))}
          </div>

          {/* Napaka */}
          {error && (
            <div className="text-center text-sm text-red-600 dark:text-red-400">
              {error}
            </div>
          )}

          {/* Števčna tipkovnica */}
          <div className="grid grid-cols-3 gap-2">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(digit => (
              <Button
                key={digit}
                variant="outline"
                className="h-14 text-xl font-bold"
                onClick={() => handleDigit(digit)}
              >
                {digit}
              </Button>
            ))}
            <Button variant="ghost" className="h-14" onClick={handleBackspace}>
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
            >
              <LogIn className="h-5 w-5" />
            </Button>
          </div>

          {/* Preskoči gumb */}
          {onSkip && (
            <div className="text-center pt-2">
              <Button variant="ghost" className="text-xs text-muted-foreground" onClick={onSkip}>
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
}

// ============================================
// UPORABNIŠKI INDICATOR (za Sidebar)
// ============================================

export function UserIndicator() {
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
        <Button variant="ghost" size="icon" className="h-6 w-6 flex-shrink-0" onClick={handleLogout} title="Odjava">
          <LogOut className="h-3 w-3" />
        </Button>
      </div>
    </div>
  )
}
