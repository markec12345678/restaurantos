'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import { queryKeys } from '@/lib/query-keys'
import type { PinLoginProps } from './constants'
import { setCurrentUser, setAuthToken } from '../PinLogin'
import { cacheOfflineSession, verifyOfflinePin, getOfflineSessionHint } from './offline-auth'

// ============================================
// HOOK: PIN prijava
// Združuje stanje, poizvedbe in mutacije za PIN login
// ============================================

export function usePinLogin(_props: PinLoginProps) {
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const firstDigitRef = useRef<HTMLButtonElement>(null)
  // NOVA FUNKCIONALNOST (runda 6): namig "offline prijava na voljo" na prijavnem
  // ekranu — natakar takoj ve, da brez mreže NE ostane na zunanji strani.
  // useEffect (ne med renderjem): localStorage je client-only + izognemo se
  // SSR hydration mismatchu.
  const [offlineHint, setOfflineHint] = useState<{ name: string; expiresInMs: number } | null>(null)
  useEffect(() => {
    setOfflineHint(getOfflineSessionHint())
  }, [])

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
    mutationFn: async (pinCode: string): Promise<{ employee: import('./constants').AuthUser; message: string; token?: string; offline?: boolean }> => {
      /* NOVA FUNKCIONALNOST (runda 5): offline-first prijava — če strežnik ni
         dosegljiv (mreža down, strežnik restart), preverimo PIN proti cached
         device session-u (TTL 12h, SHA-256 verifikator, rate-limit 5/15min).
         Natakar lahko nato oddaja naročila v offline vrsto (offline-orders.ts). */
      let serverError: unknown = null
      try {
        const res = await fetch('/api/auth', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pin: pinCode }),
        })
        if (!res.ok) {
          const data = await res.json()
          // Napačen PIN pri DOSEGLJIVEM strežniku = prava napaka (ne offline fallback!)
          throw new Error(data.error || 'Napaka pri prijavi')
        }
        return res.json()
      } catch (err) {
        serverError = err
      }
      // Strežnik ni dosegljiv (mrežna napaka) → offline fallback
      if (serverError instanceof TypeError || (serverError as Error)?.message?.includes('fetch')) {
        const offline = await verifyOfflinePin(pinCode).catch(() => null)
        if (offline) {
          return {
            employee: offline.employee,
            message: `Offline prijava (${Math.ceil(offline.expiresInMs / 3600000)} h veljavnosti) — naročila gredo na strežnik ob povezavi`,
            offline: true,
          }
        }
        throw new Error('Strežnik ni dosegljiv in offline prijava ni mogoča — prijavite se enkrat z mrežo')
      }
      throw serverError as Error
    },
    onSuccess: (data, variables, _context) => {
      setCurrentUser(data.employee)
      if (data.offline) {
        // Offline seja NIMA žetona — vse API poizvedbe ne bodo uspele,
        // ampak offline naročila se vrstijo lokalno in gredo ob povezavi.
        setAuthToken(null)
        toast.warning('OFFLINE način — naročila se bodo samodejno poslala ob vrnitvi povezave', { duration: 8000 })
      } else {
        setAuthToken(data.token ?? null)
        // Shrani sejo za prihodnje offline prijave (tiho — ne sme pokvariti online toka)
        void cacheOfflineSession(data.employee, variables)
      }
      setPin('')
      setError('')
      toast.success(data.message)
      _props.onLogin(data.employee)
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

  return {
    pin, error, authStatus,
    firstDigitRef,
    loginMutation,
    handlePinSubmit,
    handleDigit,
    handleBackspace,
    offlineHint,
  }
}
