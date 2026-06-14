'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import { queryKeys } from '@/lib/query-keys'
import type { PinLoginProps } from './constants'
import { setCurrentUser, setAuthToken } from '../PinLogin'

// ============================================
// HOOK: PIN prijava
// Združuje stanje, poizvedbe in mutacije za PIN login
// ============================================

export function usePinLogin(_props: PinLoginProps) {
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const firstDigitRef = useRef<HTMLButtonElement>(null)

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
    onSuccess: (data, _variables, _context) => {
      setCurrentUser(data.employee)
      setAuthToken(data.token)
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
  }
}
