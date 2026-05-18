'use client'

// ═══════════════════════════════════════════════════════════════
// RestaurantOS — Multi-Location Dashboard
// Upravljanje več lokacij — Chain/Multi-unit standard
// Toast POS + Square Multi-Location
// ═══════════════════════════════════════════════════════════════

import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { authFetch } from '@/components/pos/PinLogin'
import {
  Store, MapPin, DollarSign, Users, ShoppingBag, Clock,
  TrendingUp, TrendingDown, CheckCircle2, XCircle, Phone,
  BarChart3, ArrowUpRight, ArrowDownRight, Star, Truck,
  CalendarDays, Activity,
} from 'lucide-react'
import { useState } from 'react'
import { format } from 'date-fns'
import { sl } from 'date-fns/locale'

interface LocationData {
  id: string
  name: string
  code: string
  type: string
  address: string
  city: string
  country: string
  phone: string
  email: string
  isOpen: boolean
  isActive: boolean
  latitude: number | null
  longitude: number | null
  _count?: {
    orders: number
    employees: number
    tables: number
  }
}

export function MultiLocationDashboard() {
  const [selectedLocation, setSelectedLocation] = useState<string | null>(null)

  const { data: locations, isLoading } = useQuery({
    queryKey: ['locations'],
    queryFn: async () => {
      const res = await authFetch('/api/locations')
      return res.json()
    },
  })

  const { data: locationStats } = useQuery({
    queryKey: ['location-stats', selectedLocation],
    queryFn: async () => {
      const params = selectedLocation ? `?locationId=${selectedLocation}` : ''
      const res = await authFetch(`/api/dashboard${params}`)
      return res.json()
    },
    enabled: !!selectedLocation,
  })

  const formatCurrency = (val: number) => `€${(val || 0).toFixed(2)}`

  const typeLabels: Record<string, string> = {
    restaurant: 'Restavracija',
    food_truck: 'Food Truck',
    pop_up: 'Pop-up',
    cloud_kitchen: 'Cloud Kitchen',
    bar: 'Bar',
  }

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
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Store className="h-4 w-4 text-indigo-600" />
              <span className="text-xs text-muted-foreground">Skupaj lokacij</span>
            </div>
            <div className="text-2xl font-bold text-indigo-600">{locs.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <span className="text-xs text-muted-foreground">Odprte</span>
            </div>
            <div className="text-2xl font-bold text-green-600">{locs.filter(l => l.isOpen).length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Users className="h-4 w-4 text-purple-600" />
              <span className="text-xs text-muted-foreground">Skupaj zaposlenih</span>
            </div>
            <div className="text-2xl font-bold text-purple-600">
              {locs.reduce((sum, l) => sum + (l._count?.employees || 0), 0)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <ShoppingBag className="h-4 w-4 text-amber-600" />
              <span className="text-xs text-muted-foreground">Skupaj mize</span>
            </div>
            <div className="text-2xl font-bold text-amber-600">
              {locs.reduce((sum, l) => sum + (l._count?.tables || 0), 0)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Lokacije */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
        {locs.map((loc) => (
          <Card
            key={loc.id}
            className={`cursor-pointer transition-all hover:shadow-lg ${
              selectedLocation === loc.id ? 'ring-2 ring-indigo-500' : ''
            }`}
            onClick={() => setSelectedLocation(selectedLocation === loc.id ? null : loc.id)}
          >
            <CardContent className="p-4 space-y-3">
              {/* Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${
                    loc.isOpen ? 'bg-green-100 dark:bg-green-900/30' : 'bg-gray-100 dark:bg-gray-900/30'
                  }`}>
                    <Store className={`h-5 w-5 ${loc.isOpen ? 'text-green-600' : 'text-gray-400'}`} />
                  </div>
                  <div>
                    <div className="font-semibold">{loc.name}</div>
                    <div className="text-xs text-muted-foreground">{loc.code} · {typeLabels[loc.type] || loc.type}</div>
                  </div>
                </div>
                <Badge className={loc.isOpen ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' : 'bg-gray-100 text-gray-800'}>
                  {loc.isOpen ? 'Odprto' : 'Zaprto'}
                </Badge>
              </div>

              {/* Naslov */}
              <div className="flex items-start gap-2 text-sm text-muted-foreground">
                <MapPin className="h-4 w-4 mt-0.5 shrink-0" />
                <div>
                  <div>{loc.address}</div>
                  <div>{loc.city}, {loc.country}</div>
                </div>
              </div>

              {/* Kontakt */}
              {loc.phone && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Phone className="h-4 w-4 shrink-0" />
                  <span>{loc.phone}</span>
                </div>
              )}

              {/* Statistika */}
              <div className="grid grid-cols-3 gap-2 pt-2 border-t">
                <div className="text-center">
                  <div className="text-lg font-bold">{loc._count?.orders || 0}</div>
                  <div className="text-xs text-muted-foreground">Naročil</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-bold">{loc._count?.employees || 0}</div>
                  <div className="text-xs text-muted-foreground">Zaposlenih</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-bold">{loc._count?.tables || 0}</div>
                  <div className="text-xs text-muted-foreground">Mize</div>
                </div>
              </div>

              {/* Status indikator */}
              <div className="flex items-center gap-2">
                <div className={`h-2 w-2 rounded-full ${loc.isActive ? 'bg-green-500' : 'bg-red-500'}`} />
                <span className="text-xs text-muted-foreground">{loc.isActive ? 'Aktivna' : 'Neaktivna'}</span>
              </div>
            </CardContent>
          </Card>
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
        <Card className="border-indigo-200 dark:border-indigo-800">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="h-4 w-4 text-indigo-500" />
              Podrobnosti lokacije
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <div className="text-xs text-muted-foreground">Današnja prodaja</div>
                <div className="text-xl font-bold text-green-600">{formatCurrency(locationStats.todayRevenue || 0)}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Naročila danes</div>
                <div className="text-xl font-bold">{locationStats.todayOrders || 0}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Povprečno naročilo</div>
                <div className="text-xl font-bold">{formatCurrency(locationStats.avgOrderValue || 0)}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Zasedenost mize</div>
                <div className="text-xl font-bold">{locationStats.tableOccupancy || 0}%</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
