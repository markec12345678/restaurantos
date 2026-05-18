'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  MapPin, Plus, Building2, Truck, Coffee, UtensilsCrossed, Wine,
  Phone, Mail, Clock, ToggleLeft, ToggleRight, Trash2, Edit2, Check, X,
  ShoppingBag, Users, Package, Globe, ChevronDown, ChevronUp,
} from 'lucide-react'
import { authFetch } from '@/components/pos/PinLogin'

interface LocationData {
  id: string
  name: string
  code: string
  type: string
  address: string
  city: string
  postCode: string
  country: string
  phone: string
  email: string
  businessId: string
  taxId: string
  registerNumber: string
  premisesId: string
  timezone: string
  currency: string
  locale: string
  isOpen: boolean
  isActive: boolean
  latitude: number | null
  longitude: number | null
  createdAt: string
  _count?: {
    orders: number
    tables: number
    employees: number
    inventoryItems: number
  }
}

const typeIcons: Record<string, React.ReactNode> = {
  restaurant: <UtensilsCrossed className="h-4 w-4" />,
  bar: <Wine className="h-4 w-4" />,
  food_truck: <Truck className="h-4 w-4" />,
  pop_up: <Coffee className="h-4 w-4" />,
  cloud_kitchen: <ShoppingBag className="h-4 w-4" />,
}

const typeLabels: Record<string, string> = {
  restaurant: 'Restavracija',
  bar: 'Bar',
  food_truck: 'Food Truck',
  pop_up: 'Pop-up',
  cloud_kitchen: 'Cloud Kitchen',
}

export function LocationManager() {
  const queryClient = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [showSync, setShowSync] = useState(false)
  const [syncSource, setSyncSource] = useState<string>('')
  const [syncResult, setSyncResult] = useState<any>(null)
  const [syncing, setSyncing] = useState(false)

  const [form, setForm] = useState({
    name: '', code: '', type: 'restaurant', address: '', city: '', postCode: '',
    country: 'SI', phone: '', email: '', businessId: '', taxId: '', registerNumber: '',
    premisesId: '', timezone: 'Europe/Ljubljana', currency: 'EUR', locale: 'sl-SI',
    latitude: '', longitude: '',
  })

  const { data, isLoading } = useQuery({
    queryKey: ['locations'],
    queryFn: async () => {
      const res = await authFetch('/api/locations')
      return res.json()
    },
  })

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await authFetch('/api/locations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error('Napaka pri ustvarjanju')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['locations'] })
      setShowForm(false)
      resetForm()
    },
  })

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const res = await authFetch(`/api/locations/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive }),
      })
      if (!res.ok) throw new Error('Napaka')
      return res.json()
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['locations'] }),
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await authFetch(`/api/locations/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Napaka pri brisanju')
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['locations'] }),
  })

  function resetForm() {
    setForm({
      name: '', code: '', type: 'restaurant', address: '', city: '', postCode: '',
      country: 'SI', phone: '', email: '', businessId: '', taxId: '', registerNumber: '',
      premisesId: '', timezone: 'Europe/Ljubljana', currency: 'EUR', locale: 'sl-SI',
      latitude: '', longitude: '',
    })
    setEditingId(null)
  }

  function handleSubmit() {
    const payload = {
      ...form,
      latitude: form.latitude ? parseFloat(form.latitude) : undefined,
      longitude: form.longitude ? parseFloat(form.longitude) : undefined,
    }
    createMutation.mutate(payload)
  }

  if (isLoading) {
    return <div className="space-y-4">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-40" />)}</div>
  }

  const locations: LocationData[] = data?.locations || []
  const stats = data?.stats || { total: 0, active: 0, open: 0 }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Building2 className="h-6 w-6" />
            Lokacije
          </h2>
          <p className="text-muted-foreground">Upravljanje poslovnih enot in lokacij</p>
        </div>
        <Button onClick={() => { setShowForm(!showForm); resetForm() }} className="gap-2">
          <Plus className="h-4 w-4" /> Nova lokacija
        </Button>
        {locations.length > 1 && (
          <Button variant="outline" onClick={() => setShowSync(!showSync)} className="gap-2">
            🔄 Sinhroniziraj meni
          </Button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card><CardContent className="p-4 text-center">
          <p className="text-xs text-muted-foreground">Skupaj</p>
          <p className="text-2xl font-bold">{stats.total}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <p className="text-xs text-muted-foreground">Aktivne</p>
          <p className="text-2xl font-bold text-green-600">{stats.active}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <p className="text-xs text-muted-foreground">Odprte</p>
          <p className="text-2xl font-bold text-blue-600">{stats.open}</p>
        </CardContent></Card>
      </div>

      {/* Menu sync */}
      {showSync && (
        <Card className="border-purple-500/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">🔄 Sinhronizacija menijev</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Sinhroniziraj menije, kategorije in artikle iz izvorne lokacije na ciljne lokacije.
              Cene se privzeto NE prenašajo (lahko se razlikujejo med lokacijami).
            </p>
            <div className="space-y-2">
              <label className="text-sm font-medium">Izvorna lokacija (master)</label>
              <select
                value={syncSource}
                onChange={e => setSyncSource(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border bg-background text-sm"
              >
                <option value="">Izberi izvorno lokacijo...</option>
                {locations.map(loc => (
                  <option key={loc.id} value={loc.id}>{loc.name} ({loc.code})</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Ciljne lokacije</label>
              <div className="text-xs text-muted-foreground">
                Vse ostale aktivne lokacije bodo prejele meni iz izvorne lokacije
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={async () => {
                  if (!syncSource) return
                  setSyncing(true)
                  setSyncResult(null)
                  try {
                    const targetIds = locations.filter(l => l.id !== syncSource).map(l => l.id)
                    const res = await authFetch('/api/locations/sync', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        sourceLocationId: syncSource,
                        targetLocationIds: targetIds,
                        syncMenuStructure: true,
                        syncItems: true,
                        syncPricing: false,
                        syncModifiers: true,
                        dryRun: false,
                      }),
                    })
                    const data = await res.json()
                    setSyncResult(data)
                  } catch (err) {
                    setSyncResult({ success: false, error: 'Napaka pri sinhronizaciji' })
                  } finally {
                    setSyncing(false)
                  }
                }}
                disabled={!syncSource || syncing}
                className="flex-1"
              >
                {syncing ? 'Sinhroniziram...' : 'Sinhroniziraj'}
              </Button>
              <Button variant="outline" onClick={() => { setShowSync(false); setSyncResult(null) }}>Zapri</Button>
            </div>
            {syncResult && (
              <div className={`p-4 rounded-xl border ${syncResult.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                {syncResult.success ? (
                  <div className="space-y-2">
                    <p className="font-bold text-green-700">Sinhronizacija uspešna!</p>
                    {syncResult.results?.map((r: any, i: number) => (
                      <div key={i} className="text-sm">
                        <p className="font-medium">{r.targetLocationName}:</p>
                        <p className="text-xs text-muted-foreground">
                          Meniji: +{r.menusCreated} | Kategorije: +{r.categoriesCreated} | Artikli: +{r.itemsCreated} posodobljeni: {r.itemsUpdated}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-red-700">{syncResult.error || 'Napaka'}</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Create form */}
      {showForm && (
        <Card className="border-blue-500/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Nova lokacija</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Input placeholder="Ime lokacije *" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
              <Input placeholder="Koda (npr. LJU) *" value={form.code} onChange={e => setForm(p => ({ ...p, code: e.target.value.toUpperCase() }))} />
              <select value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value }))} className="col-span-2 px-3 py-2 rounded-lg border bg-background text-sm">
                {Object.entries(typeLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
              <Input placeholder="Naslov" value={form.address} onChange={e => setForm(p => ({ ...p, address: e.target.value }))} />
              <div className="flex gap-2">
                <Input placeholder="Mesto" value={form.city} onChange={e => setForm(p => ({ ...p, city: e.target.value }))} className="flex-1" />
                <Input placeholder="PT" value={form.postCode} onChange={e => setForm(p => ({ ...p, postCode: e.target.value }))} className="w-20" />
              </div>
              <Input placeholder="Telefon" value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} />
              <Input placeholder="E-pošta" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} />
              <Input placeholder="Matična št." value={form.businessId} onChange={e => setForm(p => ({ ...p, businessId: e.target.value }))} />
              <Input placeholder="DDV ID" value={form.taxId} onChange={e => setForm(p => ({ ...p, taxId: e.target.value }))} />
              <Input placeholder="Blagajna št." value={form.registerNumber} onChange={e => setForm(p => ({ ...p, registerNumber: e.target.value }))} />
              <Input placeholder="ID posl. prostora" value={form.premisesId} onChange={e => setForm(p => ({ ...p, premisesId: e.target.value }))} />
            </div>
            <div className="flex gap-2">
              <Button onClick={handleSubmit} disabled={!form.name || !form.code || createMutation.isPending} className="flex-1">
                {createMutation.isPending ? 'Ustvarjam...' : 'Ustvari lokacijo'}
              </Button>
              <Button variant="outline" onClick={() => { setShowForm(false); resetForm() }}>Prekliči</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Locations list */}
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
                    onClick={() => toggleActiveMutation.mutate({ id: loc.id, isActive: !loc.isActive })}
                    className="text-muted-foreground hover:text-foreground transition"
                  >
                    {loc.isActive ? <ToggleRight className="h-6 w-6 text-green-600" /> : <ToggleLeft className="h-6 w-6" />}
                  </button>
                  <button onClick={() => setExpandedId(expandedId === loc.id ? null : loc.id)} className="text-muted-foreground hover:text-foreground">
                    {expandedId === loc.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* Expanded details */}
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
                      onClick={() => { if (confirm(`Izbriši lokacijo "${loc.name}"?`)) deleteMutation.mutate(loc.id) }}
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
    </div>
  )
}
