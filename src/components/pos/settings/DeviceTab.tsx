'use client'

import { memo, useCallback, useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { MonitorSmartphone, Save, Store, Trash2 } from 'lucide-react'
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
// ============================================

/** Lokalna hierarhična tipka — pod ['locations'] (prefix invalidacija deluje). */
const DEVICE_LOCATIONS_KEY = ['locations', 'device-binding'] as const

export const DEVICE_TAB_NOT_BOUND = 'Naprava ni vezana — prijava je klasična (samo PIN)'
export const DEVICE_TAB_UNKNOWN_LOCATION =
  'Vezana lokacija ni več v sistemu (neznana lokacija) — izberite novo ali pobrišite binding.'
export const DEVICE_TAB_LOAD_ERROR =
  'Seznama lokacij ni mogoče naložiti — preverite povezavo in poskusite znova.'

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

  // Branje bindinga: client-only (window/localStorage) in šele PO hidraciji —
  // odložen init prek setTimeout(0) je vzorec usePinLogin (react-hooks v7
  // set-state-in-effect pravilo: brez neposrednega sinhronega setState v
  // mount-only efektu + brez SSR hydration mismatcha).
  useEffect(() => {
    const timer = setTimeout(() => {
      const resolved = readDeviceLocation()
      setDeviceLocationId(resolved)
      if (resolved) setSelectedLocationId(resolved)
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
    </div>
  )
})
