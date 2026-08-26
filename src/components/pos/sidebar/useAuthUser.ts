'use client'

import { useSyncExternalStore, useState, useEffect } from 'react'
import { getCurrentUser } from '@/components/pos/PinLogin'

// ============================================
// HOOK: Reaktivno stanje uporabnika
// Prebere sessionStorage enkrat, posluša 'pos:auth-expired' dogodek
// ============================================

export function useAuthUser() {
  const [user, setUser] = useState(() => getCurrentUser())

  useEffect(() => {
    const handleAuthChange = () => setUser(getCurrentUser())
    window.addEventListener('pos:auth-expired', handleAuthChange)
    // Poslušaj tudi storage event za cross-tab sinhronizacijo
    window.addEventListener('storage', handleAuthChange)
    return () => {
      window.removeEventListener('pos:auth-expired', handleAuthChange)
      window.removeEventListener('storage', handleAuthChange)
    }
  }, [])

  return user
}

// ============================================
// HOOK: Ali je komponenta mountirana (za hydrated UI)
// ============================================

const emptySubscribe = () => () => {}
export function useMounted() {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  )
}
