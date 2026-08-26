'use client'

// ============================================
// POS AVTENTIKACIJSKI HOOK
// Preveri shranjenega uporabnika in veljavnost žetona
// ============================================

import { useState, useEffect } from 'react'
import { getCurrentUser, setCurrentUser, getAuthToken } from '@/components/pos/PinLogin'
import type { AuthUser } from '@/components/pos/pin-login/constants'

export type { AuthUser }

export function usePOSAuth() {
  const [authUser, setAuthUser] = useState<AuthUser | null>(null)
  const [authChecked, setAuthChecked] = useState(false)

  // Preveri shranjenega uporabnika in veljavnost žetona
  useEffect(() => {
    const validateAuth = async () => {
      const stored = getCurrentUser()
      const token = getAuthToken()
      if (stored && token) {
        // Preveri, ali je žeton še veljaven (strežnik se je morda ponovno zagnal)
        try {
          const res = await fetch('/api/auth', {
            headers: { 'Authorization': `Bearer ${token}` },
          })
          if (res.ok) {
            setAuthUser(stored)
          } else {
            // Žeton ni veljaven — počisti in prikaži prijavo
            setCurrentUser(null)
            sessionStorage.removeItem('pos_auth_user')
            sessionStorage.removeItem('pos_auth_token')
            localStorage.removeItem('pos_auth_user')
            localStorage.removeItem('pos_auth_token')
          }
        } catch {
          // Napaka omrežja — dovoli vpisano uporabnika (offline način)
          setAuthUser(stored)
        }
      }
      setAuthChecked(true)
    }
    validateAuth()
  }, [])

  // Poslušaj za pos:auth-expired dogodek
  useEffect(() => {
    const handleAuthExpired = () => {
      setAuthUser(null)
      setCurrentUser(null)
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem('pos_user')
        sessionStorage.removeItem('pos_token')
        sessionStorage.removeItem('pos_auth_user')
        sessionStorage.removeItem('pos_auth_token')
        localStorage.removeItem('pos_auth_user')
        localStorage.removeItem('pos_auth_token')
      }
    }
    window.addEventListener('pos:auth-expired', handleAuthExpired)
    return () => window.removeEventListener('pos:auth-expired', handleAuthExpired)
  }, [])

  return { authUser, setAuthUser, authChecked }
}
