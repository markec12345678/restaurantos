'use client'

import { useCallback, useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { startAuthentication } from '@simplewebauthn/browser'
import { Fingerprint, ShieldCheck } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { persistDeviceLocation, readDeviceLocation } from './resolveDeviceLocation'
import {
  PIN_WEBAUTHN_ATTESTED_BADGE,
  PIN_WEBAUTHN_BUTTON_ARIA,
  PIN_WEBAUTHN_BUTTON_LABEL,
  PIN_WEBAUTHN_ERROR_NOTICE,
} from './constants'

// ============================================
// WEBAUTHN DEVICE ATTESTATION — prijavna sekcija (R99-a)
// ============================================
// Aditivna sekcija v PinLogin (pod PIN keypadom / EmployeeSelectStep, isti
// Card kontekst): naprava dokaže posest passkey-a VEZANE lokacije še pred
// sejo (R97-a fundacija: javni options/verify + FIDO2 counter zaščita).
// Uspeh → AUTHORITATIVNA lokacija iz odgovora se persistira (isti
// localStorage ključ kot PIN binding) + badge. Neuspeh → inline notice,
// PIN tok NEZADET (fail-open na UX, ne na varnost).
//
// Vidnost (e2e R99-b testira matriko): sekcija renderira SAMO ko
//   (a) readDeviceLocation() vrne lokacijo (post-hidracijsko, NIKOLI med
//       renderjem — SSR hydration kanon usePinLogin/DeviceTab),
//   (b) window.PublicKeyCredential obstaja (feature detect — DeviceTab R97-a
//       vzorec; brez podpore = zero options fetch, NE kliči API),
//   (c) options fetch uspe IN authentication.allowCredentials?.length > 0
//       (brez registriranih ključev ni nič za dokazovati). Kill switch 503
//       (WEBAUTHN_ENABLED=false) → query error → tiho skrita (brez error
//       spam — operater je feature izklopil).
//
// Ceremony: NIKOLI auto-prompt — SAMO klik na gumb → FRESH options fetch
// (challenge TTL 120 s — mount-time challenge iz react-query cache-a se NE
// reusi; preprost fetch v handlerju, ne cache branje) → startAuthentication
// (@simplewebauthn/browser v14, object-param { optionsJSON }) → POST verify
// body { assertion, locationId }.
// ============================================

/** Minimalen lik odgovora GET /api/auth/webauthn/options (R97-a kontrakt). */
interface DeviceOptionsJson {
  location?: { id: string; name: string }
  authentication?: Parameters<typeof startAuthentication>[0]['optionsJSON'] | null
}

/** Minimalen lik uspešnega odgovora POST /api/auth/webauthn/verify. */
interface DeviceVerifyJson {
  location?: { id?: string; name?: string }
}

export function WebAuthnDeviceSection() {
  // null = branje še ni poteklo ALI brez lokacije (mirror usePinLogin
  // deviceLocationId semantics; render pred branjem je null — SSR-varno).
  const [deviceLocationId, setDeviceLocationId] = useState<string | null>(null)
  const [webauthnSupported, setWebauthnSupported] = useState(false)
  const [pending, setPending] = useState(false)
  const [attested, setAttested] = useState(false)
  const [errorNotice, setErrorNotice] = useState<string | null>(null)

  // Post-hidracijski init (setTimeout(0) vzorec usePinLogin/DeviceTab):
  // branje window/localStorage je client-only in MORA iti šele po hidraciji
  // (SSR hydration mismatch + react-hooks v7 set-state-in-effect pravilo).
  useEffect(() => {
    const timer = setTimeout(() => {
      setDeviceLocationId(readDeviceLocation())
      setWebauthnSupported(
        typeof window !== 'undefined' &&
          typeof window.PublicKeyCredential !== 'undefined',
      )
    }, 0)
    return () => clearTimeout(timer)
  }, [])

  // Options za vidnost sekcije. enabled vrata: brez lokacije ALI brez
  // podpore = ZERO fetch (API sploh ne vidi zahtevka). staleTime 0 (ruta je
  // no-store; challenge je kratek življenjski vek), retry false (fail-open).
  const optionsQuery = useQuery({
    queryKey: ['auth', 'webauthn', 'options', deviceLocationId],
    queryFn: async (): Promise<DeviceOptionsJson> => {
      // RELATIVNA pot (gateway kanon) — isti vzorec kot employees query.
      const res = await fetch(
        `/api/auth/webauthn/options?locationId=${encodeURIComponent(deviceLocationId ?? '')}`,
      )
      if (!res.ok) throw new Error(`WebAuthn options failed (${res.status})`)
      return res.json()
    },
    enabled: deviceLocationId != null && webauthnSupported,
    staleTime: 0,
    retry: false,
  })

  const allowCredentials = optionsQuery.data?.authentication?.allowCredentials
  const visible =
    webauthnSupported &&
    deviceLocationId != null &&
    optionsQuery.isSuccess &&
    Array.isArray(allowCredentials) &&
    allowCredentials.length > 0

  const handleLogin = useCallback(async () => {
    if (!deviceLocationId || pending) return
    setPending(true)
    setErrorNotice(null)
    try {
      // 1) FRESH options (ne react-query cache — challenge je enkraten, TTL
      //    120 s; mount-time challenge je verjetno že potrošen/zastarel).
      const optRes = await fetch(
        `/api/auth/webauthn/options?locationId=${encodeURIComponent(deviceLocationId)}`,
      )
      if (!optRes.ok) throw new Error(`WebAuthn options failed (${optRes.status})`)
      const optJson = (await optRes.json()) as DeviceOptionsJson
      if (!optJson?.authentication) throw new Error('WebAuthn options incomplete')

      // 2) Browser ceremony (@simplewebauthn/browser v14: object-param).
      const assertion = await startAuthentication({ optionsJSON: optJson.authentication })

      // 3) Javna verifikacija → { location: { id, name } } (avtoritativno iz
      //    baze — lokacija POVERILNICE, ne klientova trditev; R97-a zero-oracle
      //    401 pri vsakem neuspehu).
      const verifyRes = await fetch('/api/auth/webauthn/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assertion, locationId: deviceLocationId }),
      })
      if (!verifyRes.ok) throw new Error(`WebAuthn verify failed (${verifyRes.status})`)
      const verifyJson = (await verifyRes.json()) as DeviceVerifyJson
      if (typeof verifyJson?.location?.id !== 'string' || verifyJson.location.id === '') {
        throw new Error('WebAuthn verify response incomplete')
      }

      // 4) Avtoritativna lokacija iz odgovora → device binding (isti ključ
      //    'restaurantos-pos-device-location' kot PIN tok; neuspešen zapis je
      //    tiho ignoriran — persist je opcijska potrditev).
      persistDeviceLocation(verifyJson.location.id)
      setAttested(true)
    } catch {
      // Fail-open na UX: notice, PIN tok NEZADET, gumb ostane omogočen
      // (uporabnik lahko poskusi znova ali nadaljuje s PIN-om).
      setErrorNotice(PIN_WEBAUTHN_ERROR_NOTICE)
    } finally {
      setPending(false)
    }
  }, [deviceLocationId, pending])

  // Zero-render do post-hidracijskega feature detecta (SSR = client prvi
  // render = null → brez hydration mismatcha).
  if (!visible) return null

  return (
    <div className="space-y-2">
      {errorNotice && (
        <p
          className="text-center text-xs text-muted-foreground"
          role="alert"
          data-testid="pin-webauthn-error"
        >
          {errorNotice}
        </p>
      )}
      {attested && (
        <div className="flex justify-center" role="status" data-testid="pin-webauthn-attested">
          <Badge variant="secondary" className="gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
            {PIN_WEBAUTHN_ATTESTED_BADGE}
          </Badge>
        </div>
      )}
      <Button
        type="button"
        variant="outline"
        onClick={handleLogin}
        disabled={pending || attested}
        aria-busy={pending}
        aria-label={PIN_WEBAUTHN_BUTTON_ARIA}
        className="w-full min-h-11"
        data-testid="pin-webauthn-button"
      >
        <Fingerprint className="h-4 w-4 mr-2" aria-hidden="true" />
        {PIN_WEBAUTHN_BUTTON_LABEL}
      </Button>
    </div>
  )
}
