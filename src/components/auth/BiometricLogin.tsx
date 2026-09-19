'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Fingerprint, Loader2 } from 'lucide-react'
import { startAuthentication } from '@simplewebauthn/browser'
import { toast } from 'sonner'
import { setAuthToken, setCurrentUser } from '@/components/pos/PinLogin'
import type { AuthUser } from '@/components/pos/pin-login/constants'
import { logger } from '@/lib/logger'

interface BiometricLoginProps {
  onLogin: (employee: AuthUser) => void
  disabled?: boolean
  variant?: 'default' | 'ghost' | 'outline'
  size?: 'default' | 'sm' | 'lg' | 'icon'
  className?: string
}

/**
 * BiometricLogin komponenta
 *
 * Prikazuje gumb za biometrično prijavo (Touch ID / Face ID / Windows Hello).
 * Če WebAuthn ni omogočen (503), se gumb samodejno skrije.
 */
export function BiometricLogin({
  onLogin,
  disabled = false,
  variant = 'outline',
  size = 'default',
  className = '',
}: BiometricLoginProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null)

  // FIX R78 (QA 2026-09-19): checkAvailability je bil prej klican MED RENDERJEM
  // (`if (isAvailable === null) { void checkAvailability(); return null }`) —
  // side-effect v render fazi. Ko se je komponenta unmountala pred resolvm
  // (Fast Refresh, navigacija, WebAuthn 503 retry), je setIsAvailable zadela
  // unmounted komponento → React warning "state update on a component that
  // hasn't mounted" (viden v konzoli ob vsaki prijavi). Zdaj: useEffect z
  // cancelled guard — idempotentno, brez render side-effectov.
  useEffect(() => {
    let cancelled = false
    const check = async () => {
      let available = false
      if (typeof window !== 'undefined' && window.PublicKeyCredential) {
        try {
          const res = await fetch('/api/auth/webauthn', { method: 'GET' })
          available = res.ok
        } catch {
          available = false
        }
      }
      if (!cancelled) setIsAvailable(available)
    }
    void check()
    return () => {
      cancelled = true
    }
  }, [])

  const handleBiometricLogin = async () => {
    setIsLoading(true)
    try {
      const optsRes = await fetch('/api/auth/webauthn', { method: 'GET' })
      if (!optsRes.ok) {
        const err = await optsRes.json().catch(() => ({}))
        toast.error(err.error || 'Biometrična prijava ni na voljo.')
        return
      }

      const { options, sessionKey } = await optsRes.json()

      const assertion = await startAuthentication({ optionsJSON: options })

      const verifyRes = await fetch('/api/auth/webauthn', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assertion, sessionKey }),
      })

      if (!verifyRes.ok) {
        const err = await verifyRes.json().catch(() => ({}))
        toast.error(err.error || 'Biometrična prijava ni uspela.')
        return
      }

      const data = await verifyRes.json()

      setCurrentUser(data.employee)
      setAuthToken(data.token)
      toast.success(data.message || `Dobrodošli, ${data.employee.name}!`)
      onLogin(data.employee)
    } catch (err) {
      if (err instanceof Error && err.name === 'NotAllowedError') {
        return
      }
      logger.error('biometric-login', 'Napaka pri biometrični prijavi', err instanceof Error ? err.message : err)
      toast.error('Napaka pri biometrični prijavi. Poskusite znova.')
    } finally {
      setIsLoading(false)
    }
  }

  if (isAvailable === null) {
    return null
  }

  if (!isAvailable) {
    return null
  }

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      className={className}
      onClick={handleBiometricLogin}
      disabled={disabled || isLoading}
      aria-label="Biometrična prijava"
    >
      {isLoading ? (
        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
      ) : (
        <Fingerprint className="h-4 w-4 mr-2" />
      )}
      {isLoading ? 'Prijava...' : 'Biometrična prijava'}
    </Button>
  )
}
