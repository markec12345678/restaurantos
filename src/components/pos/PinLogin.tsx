'use client'

import { memo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Store, Fingerprint } from 'lucide-react'
import dynamic from 'next/dynamic'
import type { PinLoginProps } from './pin-login/constants'
import { usePinLogin } from './pin-login/usePinLogin'

// Lazy-loaded podkomponente
const PinDisplay = dynamic(() => import('./pin-login/PinDisplay').then(m => ({ default: m.PinDisplay })), { ssr: false })
const PinKeypad = dynamic(() => import('./pin-login/PinKeypad').then(m => ({ default: m.PinKeypad })), { ssr: false })
// Lazy-load BiometricLogin — samo ko je uporabljen (izogiba loading simplewebauthn/browser pri SSR)
const BiometricLogin = dynamic(() => import('@/components/auth/BiometricLogin').then(m => ({ default: m.BiometricLogin })), { ssr: false })

// Re-export auth utilities from sub-directory
export {
  getCurrentUser,
  setCurrentUser,
  getAuthToken,
  setAuthToken,
  authFetch,
  hasPermission,
} from './pin-login/usePinAuth'

// Re-export UserIndicator iz podimenika
export { UserIndicator } from './pin-login/UserIndicator'

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
          {/* Števčna tipkovnica */}
          <PinKeypad
            onDigit={handleDigit}
            onBackspace={handleBackspace}
            onSubmit={handlePinSubmit}
            disabled={loginMutation.isPending || pin.length < 4}
            firstDigitRef={firstDigitRef}
          />
          {/* Biometrična prijava (Touch ID / Face ID / Windows Hello) — prikaže se samo če je WebAuthn omogočen */}
          <div className="pt-2">
            <BiometricLogin onLogin={onLogin} variant="outline" size="default" className="w-full" />
          </div>
          {/* Preskoči gumb */}
          {onSkip && (
            <div className="text-center pt-2">
              <Button variant="ghost" className="text-xs text-muted-foreground" onClick={onSkip} aria-label="Preskoči prijavo">
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
})
