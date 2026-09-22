'use client'

import { memo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ChevronLeft, Store, User, WifiOff } from 'lucide-react'
import dynamic from 'next/dynamic'
import type { PinLoginProps } from './pin-login/constants'
import { EMPLOYEE_SELECT_UNAVAILABLE } from './pin-login/constants'
import { usePinLogin } from './pin-login/usePinLogin'
import { EmployeeSelectStep } from './pin-login/EmployeeSelectStep'
import { WebAuthnDeviceSection } from './pin-login/webauthn-device'

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
// R95-b: dvostopenjska prijava (izbira zaposlenega → PIN).
// Render se razveja po step-u iz usePinLogin:
//   'select' → korak 1 (grid zaposlenih, EmployeeSelectStep),
//   'pin'    → korak 2 (trak izbranega + PIN UI, body dobi employeeId),
//   'single' → legacy PIN-only zaslon (STOTAKO kot danes — E2E kompatib.),
//              + fail-open notice, če employees endpoint ni na voljo.
// ============================================
export const PinLogin = memo(function PinLogin({ onLogin, onSkip }: PinLoginProps) {
  const {
    pin, error, authStatus,
    firstDigitRef,
    loginMutation,
    handlePinSubmit,
    handleDigit,
    handleBackspace,
    offlineHint,
    step,
    selectedEmployee,
    employeesQuery,
    employeesUnavailable,
    selectEmployee,
    backToEmployeeSelect,
    switchToSingleStep,
  } = usePinLogin({ onLogin, onSkip })

  return (
    <div className="flex items-center justify-center h-full bg-background" role="dialog" aria-modal="true" aria-label="PIN prijava">
      <Card className="w-full max-w-sm mx-4" data-testid="pin-login-card">
        <CardContent className="p-6 space-y-6">
          {/* Logo */}
          <div className="text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary text-primary-foreground mx-auto mb-3">
              <Store className="h-7 w-7" />
            </div>
            <h2 className="text-xl font-bold">RestaurantOS</h2>
            {/* Podnaslov po koraku: izbira imena / PIN za izbranega / klasični PIN */}
            <p className="text-sm text-muted-foreground mt-1">
              {step === 'select'
                ? 'Izberite svoje ime'
                : step === 'pin' && selectedEmployee
                  ? `Vnesite PIN za ${selectedEmployee.name}`
                  : 'Vnesite PIN za prijavo'}
            </p>
          </div>
          {/* NOVA FUNKCIONALNOST (runda 6): namig o offline prijavi — zaposleni
              takoj ve, da ob izpadu mreže NE obstane na prijavi (PIN se preveri
              proti cached device session-u, naročila gredo v offline vrsto).
              Prikazano v VSEH korakih (R95-b: tudi v koraku izbire zaposlenega). */}
          {offlineHint && (
            <div
              className="flex items-center gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400"
              role="status"
            >
              <WifiOff className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span>
                Offline prijava na voljo za <strong>{offlineHint.name}</strong> — vnesite PIN tudi brez mreže
                {offlineHint.expiresInMs > 3600000
                  ? ` (še ${Math.floor(offlineHint.expiresInMs / 3600000)} h)`
                  : ` (še ${Math.max(1, Math.floor(offlineHint.expiresInMs / 60000))} min)`}
              </span>
            </div>
          )}
          {step === 'select' ? (
            /* KORAK 1 — grid zaposlenih (fail-open: napaka → notice v komponenti) */
            <EmployeeSelectStep
              employees={employeesQuery.data?.employees ?? []}
              locationName={employeesQuery.data?.location.name}
              isLoading={employeesQuery.isLoading}
              isError={!!employeesQuery.isError}
              onEmployeeSelect={selectEmployee}
              onPinOnly={switchToSingleStep}
            />
          ) : (
            <>
              {/* KORAK 2 — trak izbranega zaposlenega (UserIndicator-alike).
                  "Spremeni" vrne na korak 1; napačen PIN trak NAMERNO pusti
                  (uporabnik ostane v koraku 2, izbira ne izgine). */}
              {step === 'pin' && selectedEmployee && (
                <div
                  className="flex items-center gap-2 rounded-md border border-border px-3 min-h-11"
                  data-testid="selected-employee-bar"
                >
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-primary flex-shrink-0" aria-hidden="true">
                    <User className="h-3.5 w-3.5" />
                  </div>
                  <p className="flex-1 min-w-0 text-sm font-medium truncate">{selectedEmployee.name}</p>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="min-h-11 text-xs text-muted-foreground"
                    onClick={backToEmployeeSelect}
                    aria-label="Spremeni izbranega zaposlenega"
                  >
                    <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                    Spremeni
                  </Button>
                </div>
              )}
              {/* Fail-open notice (R95-b): employees endpoint 404/429/omreža/
                  prazen seznam → single-step PIN UI + majhen muted notice.
                  NIKOLI ne blokiraj prijave (binding je optional). */}
              {employeesUnavailable && (
                <p className="text-center text-xs text-muted-foreground" role="status">
                  {EMPLOYEE_SELECT_UNAVAILABLE}
                </p>
              )}
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
            </>
          )}
          {/* R99-a: WebAuthn device attestation (ADITIVNO) — "Prijava s ključem
              naprave". Samostojna sekcija z lastno vidnostjo (device lokacija +
              PublicKeyCredential feature detect + options z allowCredentials);
              do preverjanj renderira null (SSR-varno, zero fetch brez pogojev).
              Pod EmployeeSelectStep (korak 1) IN pod PIN keypadom (korak 2 /
              single) — ključ je vezan na NAPRAVO/lokacijo, ne na izbranega
              zaposlenega. Neuspeh je fail-open na UX: PIN tok NEZADET. */}
          <WebAuthnDeviceSection />
        </CardContent>
      </Card>
    </div>
  )
})
