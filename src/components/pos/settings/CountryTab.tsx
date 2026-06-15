'use client'

import { memo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { MapPinned } from 'lucide-react'
import type { CountryTabProps } from './constants'
import { CountrySelector } from './CountrySelector'
import { CountrySummary } from './CountrySummary'

// ============================================
// Main CountryTab component
// ============================================
export const CountryTab = memo(function CountryTab({
  selectedCountry,
  onCountryChange,
}: CountryTabProps) {
  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <MapPinned className="h-5 w-5 text-primary" />
            Izberite državo poslovanja
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Izbira države samodejno nastavi davčne stopnje, valuto, fiskalizacijski sistem in privzeti jezik.
            To je prva nastavitev, ki jo morate opraviti pred uporabo sistema.
          </p>
        </CardHeader>
        <CardContent>
          <CountrySelector selectedCountry={selectedCountry} onCountryChange={onCountryChange} />
        </CardContent>
      </Card>

      <CountrySummary selectedCountry={selectedCountry} />
    </>
  )
})
