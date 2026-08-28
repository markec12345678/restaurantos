'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Fingerprint, Loader2 } from 'lucide-react'
import { startAuthentication } from '@simplewebauthn/browser'
import { toast } from 'sonner'
import { setAuthToken, setCurrentUser } from '@/components/pos/PinLogin'
import type { AuthUser } from '@/components/pos/pin-login/constants'

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

  const checkAvailability = async (): Promise<boolean> => {
    if (isAvailable !== null) return isAvailable

    if (typeof window === 'undefined' || !window.PublicKeyCredential) {
      setIsAvailable(false)
      return false
    }

    try {
      const res = await fetch('/api/auth/webauthn', { method: 'GET' })
      if (!res.ok) {
        setIsAvailable(false)
        return false
      }
      setIsAvailable(true)
      return true
    } catch {
      setIsAvailable(false)
      return false
    }
  }

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
      console.error('[biometric-login] error:', err)
      toast.error('Napaka pri biometrični prijavi. Poskusite znova.')
    } finally {
      setIsLoading(false)
    }
  }

  if (isAvailable === null) {
    if (typeof window !== 'undefined') {
      void checkAvailability()
    }
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
