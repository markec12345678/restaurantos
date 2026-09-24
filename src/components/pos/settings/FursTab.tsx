'use client'

import { memo, useCallback, useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { MapPinned, Save, Shield, Store } from 'lucide-react'
import { toast } from 'sonner'
import { getCountryConfig } from '@/lib/country-config'
import { authFetch } from '@/components/pos/PinLogin'
import { queryKeys } from '@/lib/query-keys'
import { readDeviceLocation } from '@/components/pos/pin-login/resolveDeviceLocation'
import { FursBatchVerification } from './FursBatchVerification'
import type { FursTabProps } from './constants'
import { ConnectionStatusPanel, FiscalizationInfoCard, ReceiptRequirementsCard } from './FursSubComponents'
import { FursCertificateFields } from './FursCertificateFields'
import {
  FURS_LOCATIONS_KEY,
  buildFursLocationSavePayload,
  normalizeLocationsResponse,
  pickCurrentLocation,
  type FursEnvironment,
  type LocationFursConfig,
} from '../furs/constants'
import type { FursStatus } from './constants'

// ============================================
// FURS TAB KOMPONENTA
// ISSUE #37 R125: FURS konfiguracija je vezana na LOKACIJO (per poslovni
// prostor) — tab upravlja svojo Location FURS state (NE polja settings forme):
// branje prek GET /api/locations, shranjevanje prek PUT /api/locations/[id]
// (samo furs polja, mask-keep za nespremenjeno maskirano geslo).
// ============================================
export const FursTab = memo(function FursTab({
  fursStatus,
  onTestFursConnection,
  currentCountryCode,
}: FursTabProps) {
  const currentCountryConfig = getCountryConfig(currentCountryCode)

  // Lokacije z FURS polji (maskirane skrivnosti + hasFursCert)
  const { data: locations, isLoading, isError } = useQuery({
    queryKey: FURS_LOCATIONS_KEY,
    queryFn: async () => {
      const res = await authFetch('/api/locations')
      if (!res.ok) throw new Error(`Locations failed (${res.status})`)
      return normalizeLocationsResponse(await res.json())
    },
  })

  // Resolucija "trenutne lokacije": device binding (URL ?locationId= /
  // localStorage, R95-b) > prva aktivna lokacija. Client-only branje bindinga
  // (DeviceTab vzorec: odložen init prek setTimeout(0), brez hydration mismatcha).
  const [deviceLocationId, setDeviceLocationId] = useState<string | null | undefined>(undefined)
  useEffect(() => {
    const timer = setTimeout(() => setDeviceLocationId(readDeviceLocation()), 0)
    return () => clearTimeout(timer)
  }, [])

  const currentLocation = pickCurrentLocation(locations ?? [], deviceLocationId)

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Shield className="h-5 w-5 text-blue-600" />
          {currentCountryConfig.fiscalization.systemLocal}
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          {currentCountryConfig.flag} {currentCountryConfig.fiscalization.authority} ({currentCountryConfig.fiscalization.authorityShort}) —
          {currentCountryConfig.fiscalization.required ? ' Fiskalizacija je obvezna.' : ' Fiskalizacija ni obvezna.'}
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* ISSUE #37 R125: FURS konfiguracija je per lokacija */}
        <div className="flex items-start gap-2 rounded-lg border bg-muted/40 p-3 text-sm text-muted-foreground">
          <MapPinned className="h-4 w-4 mt-0.5 shrink-0" aria-hidden="true" />
          <p>
            FURS konfiguracija je vezana na lokacijo (per poslovni prostor)
            {currentLocation ? (
              <> — trenutna lokacija: <span className="font-medium text-foreground">{currentLocation.name}</span></>
            ) : null}
            .
          </p>
        </div>

        {isLoading ? (
          <div className="space-y-2" aria-hidden="true">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : isError ? (
          <div role="alert" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-400">
            Seznama lokacij ni mogoče naložiti — FURS konfiguracija ni dostopna. Preverite povezavo in poskusite znova.
          </div>
        ) : !currentLocation ? (
          <div className="flex items-start gap-2 rounded-lg border bg-muted/30 p-3 text-sm text-muted-foreground">
            <Store className="h-4 w-4 mt-0.5 shrink-0" aria-hidden="true" />
            <p>Ni aktivnih lokacij — dodajte ali aktivirajte lokacijo (modul Lokacije), da nastavite FURS konfiguracijo za poslovni prostor.</p>
          </div>
        ) : (
          <FursTabLocationForm
            key={currentLocation.id}
            location={currentLocation}
            fursStatus={fursStatus}
            onTestFursConnection={onTestFursConnection}
            certificateFormat={currentCountryConfig.fiscalization.certificateFormat}
            authorityShort={currentCountryConfig.fiscalization.authorityShort}
          />
        )}

        <Separator />

        {/* Množična overitev neoverjenih računov */}
        <FursBatchVerification />

        <Separator />

        {/* Informacije o fiskalizaciji */}
        <FiscalizationInfoCard currentCountryCode={currentCountryCode} />

        {/* Kaj mora biti na računu */}
        <ReceiptRequirementsCard currentCountryCode={currentCountryCode} />
      </CardContent>
    </Card>
  )
})

// --- Forma FURS konfiguracije lokacije (lastna state; key = location.id) ---
interface FursTabLocationFormProps {
  location: LocationFursConfig
  fursStatus: FursStatus
  onTestFursConnection: () => void
  certificateFormat: string
  authorityShort: string
}

const FursTabLocationForm = memo(function FursTabLocationForm({
  location,
  fursStatus,
  onTestFursConnection,
  certificateFormat,
  authorityShort,
}: FursTabLocationFormProps) {
  const queryClient = useQueryClient()
  // Maskirane vrednosti ('••••••' oz. '****') se prikažejo v poljih; ob
  // shranjevanju jih buildFursLocationSavePayload pretvori v mask-keep semantiko.
  const [certPath, setCertPath] = useState(location.fursCertPath || '')
  const [certPassword, setCertPassword] = useState(location.fursCertPassword || '')
  const [environment, setEnvironment] = useState<FursEnvironment>(location.fursEnvironment === 'production' ? 'production' : 'test')
  const [saving, setSaving] = useState(false)

  const handleCertPathChange = useCallback((v: string) => setCertPath(v), [])
  const handleCertPasswordChange = useCallback((v: string) => setCertPassword(v), [])
  const handleEnvironmentChange = useCallback((v: string) => setEnvironment(v === 'production' ? 'production' : 'test'), [])

  // ISSUE #37 R125: shrani na LOKACIJO (PUT /api/locations/[id]) — samo furs
  // polja; nespremenjeno maskirano geslo gre kot '••••••' (mask-keep),
  // maskirana pot se NE pošlje (strežniška pot ostane).
  const handleSave = useCallback(async () => {
    setSaving(true)
    try {
      const res = await authFetch(`/api/locations/${location.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildFursLocationSavePayload(certPath, certPassword, environment)),
      })
      if (!res.ok) throw new Error(`FURS location save failed (${res.status})`)
      queryClient.invalidateQueries({ queryKey: queryKeys.locations.all })
      toast.success(`FURS konfiguracija shranjena — lokacija ${location.name}`)
    } catch {
      toast.error('Napaka pri shranjevanju FURS konfiguracije')
    } finally {
      setSaving(false)
    }
  }, [location, certPath, certPassword, environment, queryClient])

  return (
    <div className="space-y-4">
      {/* Status povezave */}
      <ConnectionStatusPanel
        fursStatus={fursStatus}
        environment={environment}
        onTestFursConnection={onTestFursConnection}
      />

      {/* FURS Certifikat — state lokacije */}
      <FursCertificateFields
        certPath={certPath}
        onCertPathChange={handleCertPathChange}
        certPassword={certPassword}
        onCertPasswordChange={handleCertPasswordChange}
        environment={environment}
        onEnvironmentChange={handleEnvironmentChange}
        certificateFormat={certificateFormat}
        authorityShort={authorityShort}
      />

      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={handleSave} disabled={saving} className="min-h-11 min-w-40">
          <Save className="h-4 w-4 mr-2" />
          {saving ? 'Shranjujem...' : 'Shrani FURS konfiguracijo'}
        </Button>
        <p className="text-xs text-muted-foreground">
          Shrani na lokacijo <span className="font-medium">{location.name}</span> (per poslovni prostor).
        </p>
      </div>
    </div>
  )
})
