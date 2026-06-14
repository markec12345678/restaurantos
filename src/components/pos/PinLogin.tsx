'use client'

import { memo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Store } from 'lucide-react'
import dynamic from 'next/dynamic'
import type { PinLoginProps } from './pin-login/constants'
import { usePinLogin } from './pin-login/usePinLogin'

// Lazy-loaded podkomponente
const PinDisplay = dynamic(() => import('./pin-login/PinDisplay').then(m => ({ default: m.PinDisplay })), { ssr: false })
const PinKeypad = dynamic(() => import('./pin-login/PinKeypad').then(m => ({ default: m.PinKeypad })), { ssr: false })

// Re-export UserIndicator iz podimenika
export { UserIndicator } from './pin-login/UserIndicator'

// ============================================
// TIP ZA PODATKE O PRIJAVLJENEM UPORABNIKU
// ============================================

// Globalno stanje za prijavljenega uporabnika in token
let currentUser: import('./pin-login/constants').AuthUser | null = null
let authToken: string | null = null
export function getCurrentUser() {
  if (typeof window === 'undefined') return null
  try {
    const stored = sessionStorage.getItem('pos_auth_user')
    if (stored) {
      currentUser = JSON.parse(stored)
      return currentUser
    }
  } catch {
    // sessionStorage ni na voljo
  }
  return currentUser
}
export function setCurrentUser(user: import('./pin-login/constants').AuthUser | null) {
  currentUser = user
  if (typeof window !== 'undefined') {
    if (user) {
      sessionStorage.setItem('pos_auth_user', JSON.stringify(user))
    } else {
      sessionStorage.removeItem('pos_auth_user')
      sessionStorage.removeItem('pos_auth_token')
      localStorage.removeItem('pos_auth_user')
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
  } catch {
    // sessionStorage ni na voljo
  }
  return authToken
}
export function setAuthToken(token: string | null) {
  authToken = token
  if (typeof window !== 'undefined') {
    if (token) {
      sessionStorage.setItem('pos_auth_token', token)
    } else {
      sessionStorage.removeItem('pos_auth_token')
      localStorage.removeItem('pos_auth_token')
    }
  }
}
export async function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const token = getAuthToken()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }
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
  const response = await fetch(url, { ...options, headers })
  if (response.status === 401) {
    setAuthToken(null)
    setCurrentUser(null)
    window.dispatchEvent(new CustomEvent('pos:auth-expired'))
  }
  if (!response.ok) {
    let errorMessage = `Napaka ${response.status}`
    try {
      const errorData = await response.json()
      errorMessage = errorData.error || errorMessage
    } catch {
      // JSON parsanje neuspešno
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
  const {
    pin, error, authStatus,
    firstDigitRef,
    loginMutation,
    handlePinSubmit,
    handleDigit,
    handleBackspace,
  } = usePinLogin({ onLogin, onSkip })

  return (
    <div className="flex items-center justify-center h-full bg-background" role="dialog" aria-modal="true" aria-label="PIN prijava">
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
