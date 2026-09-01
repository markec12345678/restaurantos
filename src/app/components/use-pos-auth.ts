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
          } else if (res.status === 401) {
            // FIX SECURITY: 401 = session ni veljavna (potekla ali terminiran)
            // NE dovoli offline mode — počisti in zahtevaj ponovno prijavo
            setCurrentUser(null)
            sessionStorage.removeItem('pos_auth_user')
            sessionStorage.removeItem('pos_auth_token')
            localStorage.removeItem('pos_auth_user')
            localStorage.removeItem('pos_auth_token')
          } else {
            // 500 ali druga napaka — server je nedosegljiv
            // FIX: Prej je bil setAuthUser(stored) — dovolil dostop tudi
            // terminiranemu zaposlenemu. Sedaj: zahtevaj ponovno prijavo.
            setCurrentUser(null)
            sessionStorage.removeItem('pos_auth_user')
            sessionStorage.removeItem('pos_auth_token')
            localStorage.removeItem('pos_auth_user')
            localStorage.removeItem('pos_auth_token')
          }
        } catch {
          // Napaka omrežja — NE dovoli offline mode za varnost
          // FIX: Prej je bil setAuthUser(stored) — varnostna luknja.
          // Če server ni dosegljiv, naj uporabnik ponovno vpiše PIN.
          setCurrentUser(null)
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
