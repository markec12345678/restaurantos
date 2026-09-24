'use client'

import { useState, useCallback, useEffect, memo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import dynamic from 'next/dynamic'
import { authFetch } from '@/components/pos/PinLogin'
import { queryKeys } from '@/lib/query-keys'
import { readDeviceLocation } from '@/components/pos/pin-login/resolveDeviceLocation'
import {
  FURS_LOCATIONS_KEY,
  buildFursLocationSavePayload,
  normalizeLocationsResponse,
  pickCurrentLocation,
  type FursEnvironment,
  type LocationFursConfig,
  type TestResult,
  type FursStatus as FursStatusType,
} from './furs/constants'
import { MapPinned } from 'lucide-react'

// Lazy-loaded pod-komponente
const FursStatusCards = dynamic(() => import('./furs/FursStatusCards').then((m) => m.FursStatusCards), { ssr: false })
const CertificateConfig = dynamic(() => import('./furs/CertificateConfig').then((m) => m.CertificateConfig), { ssr: false })
const TestResults = dynamic(() => import('./furs/TestResults').then((m) => m.TestResults), { ssr: false })
const CurrentConfig = dynamic(() => import('./furs/CurrentConfig').then((m) => m.CurrentConfig), { ssr: false })
const FursSpecification = dynamic(() => import('./furs/FursSpecification').then((m) => m.FursSpecification), { ssr: false })
const FursStatusDisplay = dynamic(() => import('./FursStatus').then(m => ({ default: m.FursStatus })), { ssr: false })

// ============================================
// FURS MANAGER — modul 'furs'
// ISSUE #37 R125: FURS konfiguracija je vezana na LOKACIJO (per poslovni
// prostor) — branje prek GET /api/locations, shranjevanje prek
// PUT /api/locations/[id] (samo furs polja, mask-keep za geslo).
// Status /api/furs panel ostaja nespremenjen.
// ============================================
export const FursManager = memo(function FursManager() {
  // Lokacije z FURS polji (maskirane skrivnosti + hasFursCert)
  const { data: locations, isLoading, isError: locationsError } = useQuery({
    queryKey: FURS_LOCATIONS_KEY,
    queryFn: async () => {
      const res = await authFetch('/api/locations')
      if (!res.ok) throw new Error(`Locations failed (${res.status})`)
      return normalizeLocationsResponse(await res.json())
    },
  })

  const { data: fursStatus } = useQuery({
    queryKey: queryKeys.furs.status,
    queryFn: async () => {
      const res = await authFetch('/api/furs')
      return res.json() as Promise<FursStatusType>
    },
    refetchInterval: 60000,
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

  if (isLoading) {
    return <div className="space-y-4">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-40" />)}</div>
  }

  return (
    <div className="space-y-6">
      {locationsError ? (
        <div role="alert" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-400">
          Seznama lokacij ni mogoče naložiti — FURS konfiguracija ni dostopna. Preverite povezavo in poskusite znova.
        </div>
      ) : !currentLocation ? (
        <div className="flex items-start gap-2 rounded-lg border bg-muted/30 p-3 text-sm text-muted-foreground">
          <MapPinned className="h-4 w-4 mt-0.5 shrink-0" aria-hidden="true" />
          <p>Ni aktivnih lokacij — dodajte ali aktivirajte lokacijo (modul Lokacije), da nastavite FURS konfiguracijo za poslovni prostor.</p>
        </div>
      ) : (
        <FursManagerPanels
          key={currentLocation.id}
          currentLocation={currentLocation}
          fursStatus={fursStatus}
        />
      )}
    </div>
  )
})

// --- Paneli z lastno FURS state lokacije (remount ob spremembi lokacije) ---
interface FursManagerPanelsProps {
  currentLocation: LocationFursConfig
  fursStatus: FursStatusType | undefined
}

const FursManagerPanels = memo(function FursManagerPanels({ currentLocation, fursStatus }: FursManagerPanelsProps) {
  const queryClient = useQueryClient()
  // Maskirane vrednosti ('••••••' oz. '****') se prikažejo v poljih; ob
  // shranjevanju jih buildFursLocationSavePayload pretvori v mask-keep semantiko.
  const [certPath, setCertPath] = useState(currentLocation.fursCertPath || '')
  const [certPassword, setCertPassword] = useState(currentLocation.fursCertPassword || '')
  const [environment, setEnvironment] = useState<FursEnvironment>(currentLocation.fursEnvironment === 'production' ? 'production' : 'test')
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<TestResult | null>(null)
  const [saving, setSaving] = useState(false)

  const testConnection = useCallback(async () => {
    setTesting(true)
    setTestResult(null)
    try {
      const res = await authFetch('/api/furs', { method: 'GET' })
      const data = await res.json()
      setTestResult({ success: data.connected, ...data })
    } catch {
      setTestResult({ success: false, error: 'Povezava ni uspela' })
    } finally {
      setTesting(false)
    }
  }, [])

  // ISSUE #37 R125: shrani na LOKACIJO (PUT /api/locations/[id]) — samo furs
  // polja; nespremenjeno maskirano geslo gre kot '••••••' (mask-keep),
  // maskirana pot se NE pošlje (strežniška pot ostane).
  const saveCertificate = useCallback(async () => {
    setSaving(true)
    try {
      const res = await authFetch(`/api/locations/${currentLocation.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildFursLocationSavePayload(certPath, certPassword, environment)),
      })
      if (!res.ok) throw new Error(`FURS location save failed (${res.status})`)
      queryClient.invalidateQueries({ queryKey: queryKeys.locations.all })
      toast.success(`FURS certifikat shranjen! (lokacija: ${currentLocation.name})`)
    } catch {
      toast.error('Napaka pri shranjevanju')
    }
    finally { setSaving(false) }
  }, [currentLocation, certPath, certPassword, environment, queryClient])

  const testInvoice = useCallback(async () => {
    setTesting(true)
    setTestResult(null)
    try {
      const res = await authFetch('/api/furs', { method: 'GET' })
      const data = await res.json()
      setTestResult(data)
      if (data.connected) toast.success(`FURS povezava OK (${data.environment || 'test'})`)
      else toast.error(`FURS ni dosegljiv: ${data.message || 'Neznana napaka'}`)
    } catch {
      setTestResult({ success: false, error: 'Testna povezava ni uspela' })
      toast.error('Napaka pri testiranju FURS povezave')
    } finally { setTesting(false) }
  }, [])

  const handleCertPathChange = useCallback((v: string) => setCertPath(v), [])
  const handleCertPasswordChange = useCallback((v: string) => setCertPassword(v), [])
  const handleEnvironmentChange = useCallback((v: FursEnvironment) => setEnvironment(v), [])

  const isSimulation = fursStatus?.isSimulation !== false
  const isConnected = fursStatus?.connected || false

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <MapPinned className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span>
          FURS konfiguracija je vezana na lokacijo (per poslovni prostor):{' '}
          <span className="font-medium text-foreground">{currentLocation.name}</span>
        </span>
      </div>
      <FursStatusDisplay
        fursStatus={fursStatus}
        environment={environment}
        certPath={certPath}
        isConnected={isConnected}
        isSimulation={isSimulation}
      />
      <FursStatusCards isConnected={isConnected} environment={environment} certPath={certPath} verifiedCount={fursStatus?.verifiedCount || 0} />
      <CertificateConfig certPath={certPath} certPassword={certPassword} environment={environment} saving={saving} onCertPathChange={handleCertPathChange} onCertPasswordChange={handleCertPasswordChange} onEnvironmentChange={handleEnvironmentChange} onSave={saveCertificate} />
      <TestResults testing={testing} testResult={testResult} onTestConnection={testConnection} onTestInvoice={testInvoice} />
      <CurrentConfig location={currentLocation} />
      <FursSpecification />
    </div>
  )
})
