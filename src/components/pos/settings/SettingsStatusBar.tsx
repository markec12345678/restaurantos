'use client'

import { memo, useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Badge } from '@/components/ui/badge'
import { MapPinned, Monitor } from 'lucide-react'
import { getCountryConfig } from '@/lib/country-config'
import { authFetch } from '@/components/pos/PinLogin'
import { readDeviceLocation } from '@/components/pos/pin-login/resolveDeviceLocation'
import {
  FURS_LOCATIONS_KEY,
  normalizeLocationsResponse,
  pickCurrentLocation,
} from '../furs/constants'
import type { SettingsStatusBarProps } from './constants'

// --- Komponenta ---

export const SettingsStatusBar = memo(function SettingsStatusBar({
  form,
  fursStatus,
  cisStatus,
  lastSaved,
  currentCountryCode,
}: SettingsStatusBarProps) {
  const currentCountryConfig = getCountryConfig(currentCountryCode)

  // Task 24-c: HR → CIS (Porezna uprava), ostalo → FURS — status + okolje državno
  // ozaveščeni (fiskalni modul je določen z izbrano državo)
  const isCisCountry = currentCountryCode === 'HR'
  const fiscalStatus = isCisCountry ? cisStatus : fursStatus

  // ISSUE #37 R125: fiskalno okolje za SI pride iz LOKACIJE (per poslovni prostor)
  // — isti vir kot FursTab/FursManager (device binding > prva aktivna lokacija).
  // CIS (HR) ostane na settings formi (cisEnvironment).
  const [deviceLocationId, setDeviceLocationId] = useState<string | null | undefined>(undefined)
  useEffect(() => {
    const timer = setTimeout(() => setDeviceLocationId(readDeviceLocation()), 0)
    return () => clearTimeout(timer)
  }, [])

  const { data: locations } = useQuery({
    queryKey: FURS_LOCATIONS_KEY,
    queryFn: async () => {
      const res = await authFetch('/api/locations')
      if (!res.ok) throw new Error(`Locations failed (${res.status})`)
      return normalizeLocationsResponse(await res.json())
    },
    enabled: !isCisCountry,
  })

  const fursLocation = pickCurrentLocation(locations ?? [], deviceLocationId)
  const fiscalEnvironment = isCisCountry ? form.cisEnvironment : fursLocation?.fursEnvironment

  return (
    <div className="flex items-center justify-between text-xs text-muted-foreground border-t pt-4">
      <div className="flex items-center gap-4">
        <span className="flex items-center gap-1.5">
          <MapPinned className="h-3.5 w-3.5" />
          {currentCountryConfig.flag} {currentCountryConfig.nameLocal}
        </span>
        <span className="flex items-center gap-1.5">
          <Monitor className="h-3.5 w-3.5" />
          Okolje: <Badge variant={fiscalEnvironment === 'production' ? 'destructive' : 'outline'} className="text-[9px] h-4">
            {fiscalEnvironment === 'production' ? 'PRODUKCIJA' : 'TEST'}
          </Badge>
        </span>
        <span>Blagajna: {form.registerNumber || 'BLG-001'}</span>
        <span>Davek: {form.defaultVatRate}% / {form.reducedVatRate}%</span>
      </div>
      <div className="flex items-center gap-4">
        {lastSaved && <span>Zadnje shranjevanje: {lastSaved}</span>}
        <span className="flex items-center gap-1">
          <div className={`h-2 w-2 rounded-full ${fiscalStatus === 'connected' ? 'bg-emerald-500' : fiscalStatus === 'error' ? 'bg-red-500' : 'bg-muted-foreground'}`}><span className="sr-only">{fiscalStatus === 'connected' ? 'Povezan' : fiscalStatus === 'error' ? 'Napaka' : 'Nepovezan'}</span></div>
          {fiscalStatus === 'connected' ? `${currentCountryConfig.fiscalization.authorityShort} povezan` : fiscalStatus === 'error' ? `${currentCountryConfig.fiscalization.authorityShort} napaka` : `${currentCountryConfig.fiscalization.authorityShort} nepovezan`}
        </span>
      </div>
    </div>
  )
})
