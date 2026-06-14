'use client'

import { memo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { MapPin, Building2, Phone, Globe, ToggleLeft, ToggleRight, ChevronDown, ChevronUp, Edit2, Trash2 } from 'lucide-react'
import type { LocationsListProps } from './constants'
import { typeIcons, typeLabels } from './constants'

// Seznam lokacij s karticami
export const LocationsList = memo(function LocationsList({
  locations,
  expandedId,
  onToggleLocationActive,
  onToggleExpanded,
  onDeleteLocation,
}: LocationsListProps) {
  return (
    <div className="space-y-3">
      {locations.map(loc => (
        <Card key={loc.id} className={`${!loc.isActive ? 'opacity-60' : ''}`}>
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${loc.isOpen ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                  {typeIcons[loc.type] || <Building2 className="h-4 w-4" />}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold">{loc.name}</h3>
                    <Badge variant="outline" className="font-mono text-xs">{loc.code}</Badge>
                    <Badge variant={loc.type === 'restaurant' ? 'default' : 'secondary'} className="text-xs">
                      {typeLabels[loc.type] || loc.type}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                    {loc.address && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{loc.address}, {loc.city}</span>}
                    {loc.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{loc.phone}</span>}
                    {loc.timezone && <span className="flex items-center gap-1"><Globe className="h-3 w-3" />{loc.timezone}</span>}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={loc.isOpen ? 'default' : 'secondary'} className={loc.isOpen ? 'bg-green-600' : ''}>
                  {loc.isOpen ? 'Odprto' : 'Zaprto'}
                </Badge>
                <button
                  onClick={() => onToggleLocationActive(loc)}
                  className="text-muted-foreground hover:text-foreground transition"
                >
                  {loc.isActive ? <ToggleRight className="h-6 w-6 text-green-600" /> : <ToggleLeft className="h-6 w-6" />}
                </button>
                <button onClick={() => onToggleExpanded(loc.id)} className="text-muted-foreground hover:text-foreground" aria-label={expandedId === loc.id ? 'Skrči' : 'Razširi'} aria-expanded={expandedId === loc.id}>
                  {expandedId === loc.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Razširjeni podatki */}
            {expandedId === loc.id && (
              <div className="mt-4 pt-4 border-t space-y-3">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="text-center p-2 rounded-lg bg-muted/50">
                    <p className="text-xs text-muted-foreground">Naročila</p>
                    <p className="font-bold">{loc._count?.orders || 0}</p>
                  </div>
                  <div className="text-center p-2 rounded-lg bg-muted/50">
                    <p className="text-xs text-muted-foreground">Mize</p>
                    <p className="font-bold">{loc._count?.tables || 0}</p>
                  </div>
                  <div className="text-center p-2 rounded-lg bg-muted/50">
                    <p className="text-xs text-muted-foreground">Zaposleni</p>
                    <p className="font-bold">{loc._count?.employees || 0}</p>
                  </div>
                  <div className="text-center p-2 rounded-lg bg-muted/50">
                    <p className="text-xs text-muted-foreground">Zaloga</p>
                    <p className="font-bold">{loc._count?.inventoryItems || 0}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                  {loc.businessId && <span>Matična: {loc.businessId}</span>}
                  {loc.taxId && <span>DDV: {loc.taxId}</span>}
                  {loc.registerNumber && <span>Blagajna: {loc.registerNumber}</span>}
                  {loc.premisesId && <span>Poslovni prostor: {loc.premisesId}</span>}
                  {loc.currency && <span>Valuta: {loc.currency}</span>}
                  {loc.locale && <span>Jezik: {loc.locale}</span>}
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="gap-1">
                    <Edit2 className="h-3 w-3" /> Uredi
                  </Button>
                  <Button
                    variant="outline" size="sm" className="gap-1 text-red-600 hover:text-red-700"
                    onClick={() => onDeleteLocation(loc)}
                  >
                    <Trash2 className="h-3 w-3" /> Izbriši
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      ))}

      {locations.length === 0 && (
        <div className="text-center py-12">
          <Building2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">Ni dodanih lokacij</p>
          <p className="text-sm text-muted-foreground">Dodajte prvo poslovno enoto za multi-lokacijsko podporo</p>
        </div>
      )}
    </div>
  )
})
