'use client'

// ═══════════════════════════════════════════════════════════════
// RestaurantOS — Multi-Location Dashboard
// Upravljanje več lokacij — Chain/Multi-unit standard
// Toast POS + Square Multi-Location
// ═══════════════════════════════════════════════════════════════

import { useQuery } from '@tanstack/react-query'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { authFetch } from '@/components/pos/PinLogin'
import { queryKeys } from '@/lib/query-keys'
import { Store } from 'lucide-react'
import { useState, memo } from 'react'
import dynamic from 'next/dynamic'
import type { LocationData } from './multi-location/types'

// Lazy-loaded pod-komponente
const GlobalStatsCards = dynamic(() => import('./multi-location/GlobalStatsCards').then(m => ({ default: m.GlobalStatsCards })), { ssr: false })
const LocationCard = dynamic(() => import('./multi-location/LocationCard').then(m => ({ default: m.LocationCard })), { ssr: false })
const LocationDetailPanel = dynamic(() => import('./multi-location/LocationDetailPanel').then(m => ({ default: m.LocationDetailPanel })), { ssr: false })

export const MultiLocationDashboard = memo(function MultiLocationDashboard() {
  const [selectedLocation, setSelectedLocation] = useState<string | null>(null)

  const { data: locations, isLoading } = useQuery({
    queryKey: queryKeys.locations.all,
    queryFn: async () => {
      const res = await authFetch('/api/locations')
      if (!res.ok) throw new Error('Napaka pri nalaganju')
      return res.json()
    },
  })

  const { data: locationStats } = useQuery({
    queryKey: [...queryKeys.locations.stats, selectedLocation],
    queryFn: async () => {
      const params = selectedLocation ? `?locationId=${selectedLocation}` : ''
      const res = await authFetch(`/api/dashboard${params}`)
      if (!res.ok) throw new Error('Napaka pri nalaganju')
      return res.json()
    },
    enabled: !!selectedLocation,
  })

  if (isLoading) {
    return (
      <div className="space-y-4 p-4">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-3 gap-4">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-48" />)}</div>
      </div>
    )
  }

  const locs = (locations || []) as LocationData[]

  return (
    <div className="space-y-4 p-2 overflow-y-auto h-full custom-scrollbar">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Store className="h-6 w-6 text-indigo-500" />
          Več lokacij
        </h2>
        <p className="text-muted-foreground">Pregled vseh poslovnih enot na enem mestu</p>
      </div>

      {/* Globalna statistika */}
      <GlobalStatsCards locations={locs} />

      {/* Lokacije */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
        {locs.map((loc) => (
          <LocationCard
            key={loc.id}
            location={loc}
            isSelected={selectedLocation === loc.id}
            onSelect={() => setSelectedLocation(selectedLocation === loc.id ? null : loc.id)}
          />
        ))}

        {locs.length === 0 && (
          <Card className="col-span-full text-center py-16">
            <CardContent>
              <Store className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">Ni dodanih lokacij</h3>
              <p className="text-muted-foreground">Dodajte lokacije v nastavitvah za multi-location upravljanje</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Podrobnosti izbrane lokacije */}
      {selectedLocation && locationStats && (
        <LocationDetailPanel stats={locationStats} />
      )}
    </div>
  )
})
