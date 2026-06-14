'use client'

import { memo } from 'react'
import { Badge } from '@/components/ui/badge'
import { MapPinned, Monitor } from 'lucide-react'
import { getCountryConfig } from '@/lib/country-config'
import type { SettingsStatusBarProps } from './constants'

// --- Komponenta ---

export const SettingsStatusBar = memo(function SettingsStatusBar({
  form,
  fursStatus,
  lastSaved,
  currentCountryCode,
}: SettingsStatusBarProps) {
  const currentCountryConfig = getCountryConfig(currentCountryCode)

  return (
    <div className="flex items-center justify-between text-xs text-muted-foreground border-t pt-4">
      <div className="flex items-center gap-4">
        <span className="flex items-center gap-1.5">
          <MapPinned className="h-3.5 w-3.5" />
          {currentCountryConfig.flag} {currentCountryConfig.nameLocal}
        </span>
        <span className="flex items-center gap-1.5">
          <Monitor className="h-3.5 w-3.5" />
          Okolje: <Badge variant={form.fursEnvironment === 'production' ? 'destructive' : 'outline'} className="text-[9px] h-4">
            {form.fursEnvironment === 'production' ? 'PRODUKCIJA' : 'TEST'}
          </Badge>
        </span>
        <span>Blagajna: {form.registerNumber || 'BLG-001'}</span>
        <span>Davek: {form.defaultVatRate}% / {form.reducedVatRate}%</span>
      </div>
      <div className="flex items-center gap-4">
        {lastSaved && <span>Zadnje shranjevanje: {lastSaved}</span>}
        <span className="flex items-center gap-1">
          <div className={`h-2 w-2 rounded-full ${fursStatus === 'connected' ? 'bg-emerald-500' : fursStatus === 'error' ? 'bg-red-500' : 'bg-gray-400'}`}><span className="sr-only">{fursStatus === 'connected' ? 'Povezan' : fursStatus === 'error' ? 'Napaka' : 'Nepovezan'}</span></div>
          {fursStatus === 'connected' ? `${currentCountryConfig.fiscalization.authorityShort} povezan` : fursStatus === 'error' ? `${currentCountryConfig.fiscalization.authorityShort} napaka` : `${currentCountryConfig.fiscalization.authorityShort} nepovezan`}
        </span>
      </div>
    </div>
  )
})
