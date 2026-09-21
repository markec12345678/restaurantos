'use client'

import { memo, useCallback, useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Fingerprint, MonitorSmartphone, Save, Store, Trash2 } from 'lucide-react'
import { startRegistration } from '@simplewebauthn/browser'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { authFetch } from '@/components/pos/PinLogin'
import {
  clearDeviceLocation,
  persistDeviceLocation,
  readDeviceLocation,
} from '@/components/pos/pin-login/resolveDeviceLocation'

// ============================================
// NAPRAVA ZAVIHEK (R96-b) — admin nastavitev bindinga lokacije trenutne naprave
// ============================================
// R95 je dobavil dvostopenjsko prijavo (izbira zaposlenega → PIN), ki je
// aktivna SAMO, ko naprava ve svojo lokacijo (URL ?locationId= ALI
// localStorage 'restaurantos-pos-device-location' — resolucija v
// resolveDeviceLocation.ts). Do R96-b se je binding zapisoval samo implicitno
// po uspešni prijavi; ta tab adminu dovoljuje VIDETI / SPREMENITI / POBRISATI
// binding trenutne naprave brez prijave.
//
// Vzorca (house):
//   - lokacije: isti vir kot sosednji tabi (authFetch('/api/locations'),
//     normalizacija array | { locations } — glej useLocationQueries /
//     IntegrationDialog.fetchLocationOptions).
//   - query tipka: LOKALNA hierarhična pod-tipka ['locations','device-binding']
//     (vzorec usePinLogin authEmployeesQueryKey: globalnega query-keys fajla
//     NE urejamo, prefix invalidacija ['locations'] iz locations CRUD-a
//     vseeno osveži to tipko; ločena oblika podatkov = brez cache trka z
//     useLocationQueries {locations, stats} zapisi pod ['locations']).
//
// R97-a (ADDITIVNO): pod binding kartico je dodana WebAuthn sekcija
// ("WebAuthn ključi naprave") — kriptografska plast bindinga (localStorage
// binding je spoofable prek devtools; FIDO2 passkey ni). Feature-detected
// (window.PublicKeyCredential): brez podpore = sekcija tiho skrita. Brez
// bindinga = prav tako skrita. Vsi obstoječi stringi/testidi/markup (R96-b)
// so NESPREMENJENI — R97-b e2e spec jih pina.
// ============================================

/** Lokalna hierarhična tipka — pod ['locations'] (prefix invalidacija deluje). */
const DEVICE_LOCATIONS_KEY = ['locations', 'device-binding'] as const

export const DEVICE_TAB_NOT_BOUND = 'Naprava ni vezana — prijava je klasična (samo PIN)'
export const DEVICE_TAB_UNKNOWN_LOCATION =
  'Vezana lokacija ni več v sistemu (neznana lokacija) — izberite novo ali pobrišite binding.'
export const DEVICE_TAB_LOAD_ERROR =
  'Seznama lokacij ni mogoče naložiti — preverite povezavo in poskusite znova.'

// ─── WebAuthn sekcija (R97-a, ADDITIVNO) ───
// Kriptografska plast bindinga: naprava registrira passkey za VEZANO lokacijo
// (localStorage binding sam je spoofable prek devtools — FIDO2 assertion ni).
// Sekcija je vidna SAMO ko naprava podpira WebAuthn (window.PublicKeyCredential)
// IN je vezana na lokacijo — sicer skrita (brez konzolnega šuma).
export const WEBAUTHN_SECTION_TITLE = 'WebAuthn ključi naprave'
export const WEBAUTHN_REGISTER_LABEL = 'Registriraj ključ'
export const WEBAUTHN_REGISTER_ARIA = 'Registriraj WebAuthn ključ za vezano lokacijo'
export const WEBAUTHN_EMPTY_LIST = 'Ni registriranih ključev za to lokacijo.'
export const WEBAUTHN_LIST_ERROR =
  'Seznama WebAuthn ključev ni mogoče naložiti — poskusite znova.'
export const WEBAUTHN_REGISTER_ERROR =
  'Registracija ključa ni uspela — preklicana ali neveljavna.'
export const WEBAUTHN_REVOKE_LABEL = 'Odstrani ključ'
export const WEBAUTHN_REVOKE_CONFIRM_LABEL = 'Potrdi odstranitev'
export const WEBAUTHN_REVOKE_ARIA_PREFIX = 'Odstrani WebAuthn ključ:'
export const WEBAUTHN_REVOKE_CONFIRM_ARIA = 'Potrdi odstranitev WebAuthn ključa'
export const WEBAUTHN_NEVER_USED = 'Ni še uporabljen'
export const WEBAUTHN_REGISTER_SUCCESS = 'WebAuthn ključ uspešno registriran za to lokacijo'
export const WEBAUTHN_REVOKE_SUCCESS = 'WebAuthn ključ odstranjen'

/** Lokalna hierarhična pod-tipka (mirror DEVICE_LOCATIONS_KEY vzorca). */
const WEBAUTHN_KEY_BASE = ['locations', 'device-binding', 'webauthn'] as const

/** Minimalen lik poverilnice iz GET /api/settings/webauthn/credentials. */
interface WebAuthnCredentialRow {
  id: string
  deviceName: string | null
  transports: string | null
  deviceType: string | null
  createdAt: string
  lastUsedAt: string | null
}

async function fetchWebauthnCredentials(locationId: string): Promise<WebAuthnCredentialRow[]> {
  const res = await authFetch(
    `/api/settings/webauthn/credentials?locationId=${encodeURIComponent(locationId)}`,
  )
  if (!res.ok) throw new Error(`WebAuthn credentials failed (${res.status})`)
  const json: unknown = await res.json()
  const rows = Array.isArray(json)
    ? json
    : ((json as { credentials?: unknown[] } | null)?.credentials ?? [])
  return (rows as WebAuthnCredentialRow[]).filter(
    (c): c is WebAuthnCredentialRow => typeof c?.id === 'string',
  )
}

/** Minimalen lik lokacije za select (GET /api/locations vrne polne vrstice). */
interface LocationOption {
  id: string
  name: string
}

const EMPTY_LOCATIONS: LocationOption[] = []

async function fetchDeviceLocationOptions(): Promise<LocationOption[]> {
  const res = await authFetch('/api/locations')
  if (!res.ok) throw new Error(`Locations failed (${res.status})`)
  const json: unknown = await res.json()
  const rows = Array.isArray(json) ? json : ((json as { locations?: unknown[] } | null)?.locations ?? [])
  return (rows as LocationOption[]).filter(
    (l): l is LocationOption => typeof l?.id === 'string' && typeof l?.name === 'string',
  )
}

export const DeviceTab = memo(function DeviceTab() {
  // undefined = branje še ni poteklo (post-hidracija), null = brez bindinga,
  // string = vezana lokacija (mirror usePinLogin deviceLocationId semantics).
  const [deviceLocationId, setDeviceLocationId] = useState<string | null | undefined>(undefined)
  const [selectedLocationId, setSelectedLocationId] = useState<string>('')

  // WebAuthn sekcija (R97-a): feature detect + UI stanja. Sekcija je skrita,
  // dokler post-hidracijski feature detect ne potrdi window.PublicKeyCredential
  // (brez konzolnega šuma — samo tiho render null).
  const [webauthnSupported, setWebauthnSupported] = useState(false)
  const [webauthnRegistering, setWebauthnRegistering] = useState(false)
  const [webauthnNotice, setWebauthnNotice] = useState<string | null>(null)
  const [revokeConfirmId, setRevokeConfirmId] = useState<string | null>(null)

  // Branje bindinga: client-only (window/localStorage) in šele PO hidraciji —
  // odložen init prek setTimeout(0) je vzorec usePinLogin (react-hooks v7
  // set-state-in-effect pravilo: brez neposrednega sinhronega setState v
  // mount-only efektu + brez SSR hydration mismatcha).
  useEffect(() => {
    const timer = setTimeout(() => {
      const resolved = readDeviceLocation()
      setDeviceLocationId(resolved)
      if (resolved) setSelectedLocationId(resolved)
      // R97-a: WebAuthn feature detect (isti post-hidracijski odloženi init).
      setWebauthnSupported(
        typeof window !== 'undefined' &&
          typeof window.PublicKeyCredential !== 'undefined',
      )
    }, 0)
    return () => clearTimeout(timer)
  }, [])

  const { data: locations, isLoading: locationsLoading, isError: locationsError } = useQuery({
    queryKey: DEVICE_LOCATIONS_KEY,
    queryFn: fetchDeviceLocationOptions,
    staleTime: 5 * 60_000,
  })

  const locationList = locations ?? EMPTY_LOCATIONS
  const isBound = typeof deviceLocationId === 'string'
  const currentLocation = isBound
    ? locationList.find(l => l.id === deviceLocationId)
    : undefined
  // "Neznana lokacija": vezani id ni več med API lokacijami (pregledan seznam,
  // ne fetch napaka — pri napaki NE trdimo, da lokacija ne obstaja).
  const unknownLocation =
    isBound && !!locations && !locationsError && !currentLocation

  const handleSave = useCallback(() => {
    if (!selectedLocationId || selectedLocationId === deviceLocationId) return
    persistDeviceLocation(selectedLocationId)
    setDeviceLocationId(selectedLocationId)
    const chosen = locationList.find(l => l.id === selectedLocationId)
    toast.success(
      `Lokacija naprave shranjena: ${chosen?.name ?? selectedLocationId} — dvostopenjska prijava je aktivna`,
    )
  }, [selectedLocationId, deviceLocationId, locationList])

  const handleClear = useCallback(() => {
    if (!isBound) return
    clearDeviceLocation()
    setDeviceLocationId(null)
    setSelectedLocationId('')
    toast.success('Binding lokacije pobrisan — prijava je spet klasična (samo PIN)')
  }, [isBound])

  const canSave =
    !!selectedLocationId && selectedLocationId !== deviceLocationId && !locationsError

  // ─── WebAuthn (R97-a): credentials seznam + register/revoke tok ───
  // Sekcija je enabled SAMO ko je naprava vezana IN podpira WebAuthn
  // (enable:false = zero fetch, zero konzolnega šuma v ostalih primerih).
  const {
    data: webauthnCredentials,
    isLoading: webauthnLoading,
    isError: webauthnError,
    refetch: refetchWebauthn,
  } = useQuery({
    queryKey: [...WEBAUTHN_KEY_BASE, deviceLocationId],
    queryFn: () => fetchWebauthnCredentials(deviceLocationId as string),
    enabled: isBound && webauthnSupported,
    staleTime: 30_000,
  })

  const handleWebauthnRegister = useCallback(async () => {
    if (!isBound || typeof deviceLocationId !== 'string') return
    setWebauthnRegistering(true)
    setWebauthnNotice(null)
    try {
      // 1) Javne options (signed challenge vezan na lokacijo).
      const optRes = await authFetch(
        `/api/auth/webauthn/options?locationId=${encodeURIComponent(deviceLocationId)}`,
      )
      if (!optRes.ok) throw new Error(`WebAuthn options failed (${optRes.status})`)
      const optJson = (await optRes.json()) as { registration?: unknown }
      if (!optJson?.registration) throw new Error('WebAuthn options incomplete')

      // 2) Browser ceremony (@simplewebauthn/browser → navigator.credentials).
      const attestation = await startRegistration({
        optionsJSON: optJson.registration as Parameters<typeof startRegistration>[0]['optionsJSON'],
      })

      // 3) Admin registracija (scope + attestation verifikacija na strežniku).
      const regRes = await authFetch('/api/settings/webauthn/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locationId: deviceLocationId, credential: attestation }),
      })
      if (!regRes.ok) throw new Error(`WebAuthn register failed (${regRes.status})`)

      toast.success(WEBAUTHN_REGISTER_SUCCESS)
      await refetchWebauthn()
    } catch {
      setWebauthnNotice(WEBAUTHN_REGISTER_ERROR)
      toast.error(WEBAUTHN_REGISTER_ERROR)
    } finally {
      setWebauthnRegistering(false)
    }
  }, [isBound, deviceLocationId, refetchWebauthn])

  // Dvoklikni inline confirm (determinističen, brez window.confirm): prvi klik
  // oboroži gumb, drugi klik izvede DELETE. Sprememba izbire resetira oborožitev.
  const handleWebauthnRevoke = useCallback(
    async (credentialId: string) => {
      if (revokeConfirmId !== credentialId) {
        setRevokeConfirmId(credentialId)
        return
      }
      setRevokeConfirmId(null)
      try {
        const res = await authFetch(
          `/api/settings/webauthn/credentials/${encodeURIComponent(credentialId)}`,
          { method: 'DELETE' },
        )
        if (!res.ok) throw new Error(`WebAuthn revoke failed (${res.status})`)
        toast.success(WEBAUTHN_REVOKE_SUCCESS)
        await refetchWebauthn()
      } catch {
        setWebauthnNotice(WEBAUTHN_LIST_ERROR)
        toast.error(WEBAUTHN_LIST_ERROR)
      }
    },
    [revokeConfirmId, refetchWebauthn],
  )

  return (
    <div className="space-y-4 animate-fade-in-up">
      <Card className="card-lift">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MonitorSmartphone className="h-5 w-5 text-blue-500" />
            Lokacija naprave
          </CardTitle>
          <CardDescription>
            Dvostopenjska prijava (izbira zaposlenega → PIN) je aktivna samo na napravi z znano
            lokacijo. URL param <code className="bg-muted px-1.5 py-0.5 rounded">?locationId=</code>{' '}
            vedno prevlada, vendar SAMO za enkratno uporabo (se ne shrani v binding).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* ─── Trenutni binding (client-only branje, post-hidracijsko) ─── */}
          {deviceLocationId === undefined ? (
            <div className="space-y-2" aria-hidden="true">
              <Skeleton className="h-6 w-3/4 rounded-md" />
              <Skeleton className="h-4 w-1/2 rounded-md" />
            </div>
          ) : (
            <div className="space-y-2">
              <p role="status" className="text-sm font-medium flex items-center gap-2">
                <Store className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                {isBound
                  ? `Naprava je vezana na: ${
                      currentLocation?.name
                      // "neznana lokacija" šele, ko je seznam PREGLEDAN (ne fetch napaka)
                      ?? (unknownLocation ? 'neznana lokacija' : deviceLocationId)
                    }`
                  : DEVICE_TAB_NOT_BOUND}
              </p>
              {unknownLocation && (
                <p className="text-xs text-muted-foreground">{DEVICE_TAB_UNKNOWN_LOCATION}</p>
              )}
              <Badge variant={isBound ? 'default' : 'secondary'}>
                {isBound ? '✓ Dvostopenjska prijava aktivna' : 'Klasična prijava (samo PIN)'}
              </Badge>
            </div>
          )}

          {/* ─── Sprememba bindinga ─── */}
          {locationsError ? (
            <p className="text-xs text-muted-foreground" role="alert">
              {DEVICE_TAB_LOAD_ERROR}
            </p>
          ) : locationsLoading ? (
            <div className="space-y-2" aria-hidden="true">
              <Skeleton className="h-4 w-40 rounded-md" />
              <Skeleton className="h-11 w-full rounded-md" />
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="device-location-select">Nova lokacija naprave</Label>
              <select
                id="device-location-select"
                value={selectedLocationId}
                onChange={e => setSelectedLocationId(e.target.value)}
                className="w-full min-h-11 px-3 py-2 rounded-lg border bg-background text-sm"
                aria-label="Nova lokacija naprave"
              >
                <option value="">— Izberite lokacijo —</option>
                {locationList.map(loc => (
                  <option key={loc.id} value={loc.id}>{loc.name}</option>
                ))}
              </select>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <Button
              onClick={handleSave}
              disabled={!canSave}
              className="min-h-11"
              aria-label="Shrani lokacijo naprave"
            >
              <Save className="h-4 w-4 mr-2" />
              Shrani
            </Button>
            <Button
              variant="ghost"
              onClick={handleClear}
              disabled={!isBound}
              className="min-h-11 text-destructive hover:text-destructive"
              aria-label="Pobriši binding lokacije naprave"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Pobriši binding
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ═══ WebAuthn sekcija (R97-a, ADDITIVNO) ═══
          Vidna SAMO ko naprava podpira WebAuthn (window.PublicKeyCredential)
          IN je vezana na lokacijo — sicer tiho skrita (brez konzolnega šuma).
          localStorage binding iz zgornje kartice je spoofable prek devtools;
          FIDO2 ključ ni — ta kartica registrira kriptografski dokaz lokacije. */}
      {webauthnSupported && isBound && (
        <Card className="card-lift">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Fingerprint className="h-5 w-5 text-emerald-500" aria-hidden="true" />
              {WEBAUTHN_SECTION_TITLE}
            </CardTitle>
            <CardDescription>
              Passkey je kriptografsko vezan na lokacijo{' '}
              <span className="font-medium">{currentLocation?.name ?? deviceLocationId}</span> —
              ključa ni mogoče uporabiti na drugi lokaciji niti kovati prek devtools.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {webauthnError ? (
              <p className="text-xs text-muted-foreground" role="alert">
                {WEBAUTHN_LIST_ERROR}
              </p>
            ) : webauthnLoading ? (
              <div className="space-y-2" aria-hidden="true">
                <Skeleton className="h-4 w-48 rounded-md" />
                <Skeleton className="h-11 w-full rounded-md" />
              </div>
            ) : (webauthnCredentials ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">{WEBAUTHN_EMPTY_LIST}</p>
            ) : (
              <ul className="space-y-2" aria-label="Seznam WebAuthn ključev">
                {(webauthnCredentials ?? []).map(cred => {
                  const label = cred.deviceName ?? cred.deviceType ?? 'WebAuthn ključ'
                  const isArmed = revokeConfirmId === cred.id
                  return (
                    <li
                      key={cred.id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-lg border px-3 py-2"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{label}</p>
                        <Badge variant="secondary" className="mt-1">
                          {cred.lastUsedAt
                            ? `Zadnja uporaba: ${new Date(cred.lastUsedAt).toLocaleDateString('sl-SI')}`
                            : WEBAUTHN_NEVER_USED}
                        </Badge>
                      </div>
                      <Button
                        variant="ghost"
                        onClick={() => handleWebauthnRevoke(cred.id)}
                        disabled={!isArmed && revokeConfirmId !== null}
                        className="min-h-11 text-destructive hover:text-destructive"
                        aria-label={
                          isArmed
                            ? WEBAUTHN_REVOKE_CONFIRM_ARIA
                            : `${WEBAUTHN_REVOKE_ARIA_PREFIX} ${label}`
                        }
                      >
                        <Trash2 className="h-4 w-4 mr-2" aria-hidden="true" />
                        {isArmed ? WEBAUTHN_REVOKE_CONFIRM_LABEL : WEBAUTHN_REVOKE_LABEL}
                      </Button>
                    </li>
                  )
                })}
              </ul>
            )}

            {webauthnNotice && (
              <p className="text-xs text-muted-foreground" role="alert">
                {webauthnNotice}
              </p>
            )}

            <Button
              onClick={handleWebauthnRegister}
              disabled={webauthnRegistering}
              className="min-h-11"
              aria-label={WEBAUTHN_REGISTER_ARIA}
            >
              <Fingerprint className="h-4 w-4 mr-2" aria-hidden="true" />
              {webauthnRegistering ? 'Registracija…' : WEBAUTHN_REGISTER_LABEL}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
})
