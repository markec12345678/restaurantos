'use client'

import { memo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Store, MapPin, Phone } from 'lucide-react'
import type { LocationData } from './types'
import { TYPE_LABELS } from './types'

// ============================================
// KARTICA POSAMEZNE LOKACIJE
// ============================================
export const LocationCard = memo(function LocationCard({
  location,
  isSelected,
  onSelect,
}: {
  location: LocationData
  isSelected: boolean
  onSelect: () => void
}) {
  return (
    <Card
      className={`cursor-pointer transition-all hover:shadow-lg ${
        isSelected ? 'ring-2 ring-indigo-500' : ''
      }`}
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect() } }}
    >
      <CardContent className="p-4 space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${
              location.isOpen ? 'bg-green-100 dark:bg-green-900/30' : 'bg-gray-100 dark:bg-gray-900/30'
            }`}>
              <Store className={`h-5 w-5 ${location.isOpen ? 'text-green-600' : 'text-gray-500'}`} />
            </div>
            <div>
              <div className="font-semibold">{location.name}</div>
              <div className="text-xs text-muted-foreground">{location.code} · {TYPE_LABELS[location.type] || location.type}</div>
            </div>
          </div>
          <Badge className={location.isOpen ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' : 'bg-gray-100 text-gray-800'}>
            {location.isOpen ? 'Odprto' : 'Zaprto'}
          </Badge>
        </div>

        {/* Naslov */}
        <div className="flex items-start gap-2 text-sm text-muted-foreground">
          <MapPin className="h-4 w-4 mt-0.5 shrink-0" />
          <div>
            <div>{location.address}</div>
            <div>{location.city}, {location.country}</div>
          </div>
        </div>

        {/* Kontakt */}
        {location.phone && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Phone className="h-4 w-4 shrink-0" />
            <span>{location.phone}</span>
          </div>
        )}

        {/* Statistika */}
        <div className="grid grid-cols-3 gap-2 pt-2 border-t">
          <div className="text-center">
            <div className="text-lg font-bold">{location._count?.orders || 0}</div>
            <div className="text-xs text-muted-foreground">Naročil</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold">{location._count?.employees || 0}</div>
            <div className="text-xs text-muted-foreground">Zaposlenih</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold">{location._count?.tables || 0}</div>
            <div className="text-xs text-muted-foreground">Mize</div>
          </div>
        </div>

        {/* Status indikator */}
        <div className="flex items-center gap-2">
          <div className={`h-2 w-2 rounded-full ${location.isActive ? 'bg-green-500' : 'bg-red-500'}`}><span className="sr-only">{location.isActive ? 'Aktivna' : 'Neaktivna'}</span></div>
          <span className="text-xs text-muted-foreground">{location.isActive ? 'Aktivna' : 'Neaktivna'}</span>
        </div>
      </CardContent>
    </Card>
  )
})
