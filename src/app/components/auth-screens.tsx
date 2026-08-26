'use client'

// ============================================
// AVTENTIKACIJSKI ZASLONI
// Nalagalni zaslon + PinLogin
// ============================================

import { memo } from 'react'
import { PinLogin, setCurrentUser } from '@/components/pos/PinLogin'
import type { AuthUser } from '@/components/pos/pin-login/constants'

// Nalagalni zaslon — dokler ni preverjena avtentikacija
export const AuthLoadingScreen = memo(function AuthLoadingScreen() {
  return (
    <div className="h-screen bg-background flex items-center justify-center">
      <div className="text-center space-y-4">
        <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary text-primary-foreground mx-auto animate-pulse">
          <svg className="h-7 w-7" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
        </div>
        <p className="text-sm text-muted-foreground">Preverjanje prijave...</p>
      </div>
    </div>
  )
})

// PinLogin zaslon za neprijavljene uporabnike
interface AuthLoginScreenProps {
  onLogin: (_user: AuthUser) => void
}

export const AuthLoginScreen = memo(function AuthLoginScreen({ onLogin }: AuthLoginScreenProps) {
  return (
    <div className="h-screen bg-background">
      <PinLogin
        onLogin={(user) => { onLogin(user); setCurrentUser(user) }}
        onSkip={() => {
          const guest: AuthUser = { id: 'guest', name: 'Gost', email: '', role: 'guest', primaryJob: null, permissions: ['take_orders', 'view_reports'] }
          setCurrentUser(guest)
          onLogin(guest)
        }}
      />
    </div>
  )
})
