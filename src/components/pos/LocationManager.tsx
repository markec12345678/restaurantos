'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Switch } from '@/components/ui/switch'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import {
  Plus, Pencil, Trash2, Search, MapPin, Building2,
  CheckCircle2, XCircle, Clock, Wifi, WifiOff,
  ShoppingBag, Users, Package,
} from 'lucide-react'
import { useState, useMemo } from 'react'
import { authFetch } from '@/components/pos/PinLogin'

// ============================================
// TIPI
// ============================================

interface LocationItem {
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
  _count?: {
    orders: number
    tables: number
    employees: number
    inventoryItems: number
  }
  createdAt: string
  updatedAt: string
}

const locationTypes = [
  { value: 'restaurant', label: 'Restavracija' },
  { value: 'food_truck', label: 'Food Truck' },
  { value: 'pop_up', label: 'Pop-up' },
  { value: 'cloud_kitchen', label: 'Cloud Kitchen' },
  { value: 'bar', label: 'Bar' },
]

function getTypeLabel(type: string) {
  return locationTypes.find(t => t.value === type)?.label || type
}

function getTypeIcon(type: string) {
  switch (type) {
    case 'restaurant': return Building2
    case 'food_truck': return ShoppingBag
    default: return MapPin
  }
}

// ============================================
// GLAVNA KOMPONENTA
// ============================================

export function LocationManager() {
  const queryClient = useQueryClient()

  const [search, setSearch] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<LocationItem | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<LocationItem | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    type: 'restaurant' as string,
    address: '',
    city: '',
    postCode: '',
    country: 'SI',
    phone: '',
    email: '',
    businessId: '',
    taxId: '',
    registerNumber: '',
    premisesId: '',
    timezone: 'Europe/Ljubljana',
    currency: 'EUR',
    locale: 'sl-SI',
    isActive: true,
  })

  // ============================================
  // QUERIES
  // ============================================

  const { data, isLoading } = useQuery({
    queryKey: ['locations'],
    queryFn: async () => {
      const res = await authFetch('/api/locations')
      return res.json()
    },
  })

  const locations: LocationItem[] = Array.isArray(data?.locations) ? data.locations : []
  const stats = data?.stats || { total: 0, active: 0, open: 0 }

  const filteredLocations = useMemo(() => {
    if (!search.trim()) return locations
    const q = search.toLowerCase()
    return locations.filter(l =>
      l.name.toLowerCase().includes(q) ||
      l.code.toLowerCase().includes(q) ||
      l.city.toLowerCase().includes(q)
    )
  }, [locations, search])

  // ============================================
  // MUTATIONS
  // ============================================

  const createMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await authFetch('/api/locations', {
        method: 'POST',
        body: JSON.stringify(data),
      })
      return res.json()
    },
    onSuccess: () => {
      toast.success('Lokacija uspešno ustvarjena')
      queryClient.invalidateQueries({ queryKey: ['locations'] })
      setDialogOpen(false)
    },
    onError: () => toast.error('Napaka pri ustvarjanju lokacije'),
  })

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...data }: { id: string } & Record<string, unknown>) => {
      const res = await authFetch(`/api/locations/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      })
      return res.json()
    },
    onSuccess: () => {
      toast.success('Lokacija uspešno posodobljena')
      queryClient.invalidateQueries({ queryKey: ['locations'] })
      setDialogOpen(false)
      setEditingItem(null)
    },
    onError: () => toast.error('Napaka pri posodabljanju lokacije'),
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await authFetch(`/api/locations/${id}`, { method: 'DELETE' })
      return res.json()
    },
    onSuccess: () => {
      toast.success('Lokacija deaktivirana')
      queryClient.invalidateQueries({ queryKey: ['locations'] })
      setDeleteDialogOpen(false)
      setDeleteTarget(null)
    },
    onError: () => toast.error('Napaka pri deaktivaciji lokacije'),
  })

  const toggleOpenMutation = useMutation({
    mutationFn: async ({ id, isOpen }: { id: string; isOpen: boolean }) => {
      const res = await authFetch(`/api/locations/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ isOpen }),
      })
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['locations'] })
    },
  })

  // ============================================
  // HANDLERJI
  // ============================================

  const openCreate = () => {
    setEditingItem(null)
    setFormData({
      name: '', code: '', type: 'restaurant', address: '', city: '', postCode: '',
      country: 'SI', phone: '', email: '', businessId: '', taxId: '',
      registerNumber: '', premisesId: '', timezone: 'Europe/Ljubljana',
      currency: 'EUR', locale: 'sl-SI', isActive: true,
    })
    setDialogOpen(true)
  }

  const openEdit = (item: LocationItem) => {
    setEditingItem(item)
    setFormData({
      name: item.name,
      code: item.code,
      type: item.type,
      address: item.address,
      city: item.city,
      postCode: item.postCode,
      country: item.country,
      phone: item.phone,
      email: item.email,
      businessId: item.businessId,
      taxId: item.taxId,
      registerNumber: item.registerNumber,
      premisesId: item.premisesId,
      timezone: item.timezone,
      currency: item.currency,
      locale: item.locale,
      isActive: item.isActive,
    })
    setDialogOpen(true)
  }

  const handleSubmit = () => {
    if (!formData.name.trim()) { toast.error('Ime je obvezno'); return }
    if (!formData.code.trim()) { toast.error('Koda je obvezna'); return }

    const payload = {
      ...formData,
      code: formData.code.toUpperCase().replace(/[^A-Z0-9_-]/g, ''),
    }

    if (editingItem) {
      updateMutation.mutate({ id: editingItem.id, ...payload })
    } else {
      createMutation.mutate(payload)
    }
  }

  // ============================================
  // RENDER
  // ============================================

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-3 gap-3">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-20" />)}
        </div>
        <Skeleton className="h-96" />
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto p-4 space-y-4 custom-scrollbar">
      {/* Glava */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <MapPin className="h-5 w-5 text-primary" />
            Lokacije
          </h2>
          <p className="text-sm text-muted-foreground">Upravljanje več lokacij, poslovnih enot in filial</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Dodaj lokacijo
        </Button>
      </div>

      {/* Povzetek */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <MapPin className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.total}</p>
                <p className="text-xs text-muted-foreground">Skupaj lokacij</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">{stats.active}</p>
                <p className="text-xs text-muted-foreground">Aktivnih</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">
                <Wifi className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold text-green-700 dark:text-green-400">{stats.open}</p>
                <p className="text-xs text-muted-foreground">Trenutno odprtih</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-800/30 text-gray-700 dark:text-gray-400">
                <WifiOff className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-700 dark:text-gray-400">{stats.total - stats.open}</p>
                <p className="text-xs text-muted-foreground">Zaprtih</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Iskanje */}
      <Card>
        <CardContent className="p-4">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Išči po imenu, kodi ali mestu..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
          </div>
        </CardContent>
      </Card>

      {/* Tabela */}
      <Card>
        <CardContent className="p-0">
          {filteredLocations.length === 0 ? (
            <div className="text-center py-16">
              <MapPin className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
              <h3 className="text-lg font-semibold mb-1">Ni lokacij</h3>
              <p className="text-sm text-muted-foreground mb-4">Dodajte prvo lokacijo za upravljanje več poslovnih enot</p>
              <Button onClick={openCreate}><Plus className="h-4 w-4 mr-2" />Dodaj lokacijo</Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Lokacija</TableHead>
                  <TableHead>Koda</TableHead>
                  <TableHead>Tip</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Naročila</TableHead>
                  <TableHead>Zaposleni</TableHead>
                  <TableHead className="text-right">Dejanja</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLocations.map(item => {
                  const TypeIcon = getTypeIcon(item.type)
                  return (
                    <TableRow key={item.id} className={!item.isActive ? 'opacity-60' : ''}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <TypeIcon className="h-4 w-4 text-primary flex-shrink-0" />
                          <div>
                            <span className="font-medium text-sm">{item.name}</span>
                            <p className="text-xs text-muted-foreground">{item.city || item.address || 'Brez naslova'}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="text-xs font-mono">{item.code}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">{getTypeLabel(item.type)}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={item.isOpen}
                            onCheckedChange={(checked) => toggleOpenMutation.mutate({ id: item.id, isOpen: checked })}
                            disabled={!item.isActive}
                          />
                          <span className="text-xs">{item.isOpen ? 'Odprta' : 'Zaprta'}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">
                        <div className="flex items-center gap-1">
                          <ShoppingBag className="h-3.5 w-3.5 text-muted-foreground" />
                          {item._count?.orders || 0}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">
                        <div className="flex items-center gap-1">
                          <Users className="h-3.5 w-3.5 text-muted-foreground" />
                          {item._count?.employees || 0}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7" title="Uredi" onClick={() => openEdit(item)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" title="Deaktiviraj" onClick={() => { setDeleteTarget(item); setDeleteDialogOpen(true) }} disabled={!item.isActive}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Dijalog za vnos/urejanje */}
      <Dialog open={dialogOpen} onOpenChange={open => { if (!open) setEditingItem(null); setDialogOpen(open) }}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-primary" />
              {editingItem ? 'Uredi lokacijo' : 'Dodaj lokacijo'}
            </DialogTitle>
            <DialogDescription>
              {editingItem ? 'Posodobite nastavitve lokacije.' : 'Dodajte novo poslovno enoto ali filialo.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-sm font-semibold">Ime *</Label>
                <Input placeholder="npr. Filiala Ljubljana" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-semibold">Koda *</Label>
                <Input placeholder="npr. LJU" value={formData.code} onChange={e => setFormData({ ...formData, code: e.target.value.toUpperCase() })} maxLength={20} />
                <p className="text-xs text-muted-foreground">Velike črke, številke, _ ali -</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-sm font-semibold">Tip</Label>
                <Select value={formData.type} onValueChange={v => setFormData({ ...formData, type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {locationTypes.map(t => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-semibold">Država</Label>
                <Select value={formData.country} onValueChange={v => setFormData({ ...formData, country: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SI">Slovenija</SelectItem>
                    <SelectItem value="HR">Hrvaška</SelectItem>
                    <SelectItem value="IT">Italija</SelectItem>
                    <SelectItem value="AT">Avstrija</SelectItem>
                    <SelectItem value="DE">Nemčija</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm font-semibold">Naslov</Label>
              <Input placeholder="Slovenska cesta 1" value={formData.address} onChange={e => setFormData({ ...formData, address: e.target.value })} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-sm font-semibold">Mesto</Label>
                <Input placeholder="Ljubljana" value={formData.city} onChange={e => setFormData({ ...formData, city: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-semibold">Poštna št.</Label>
                <Input placeholder="1000" value={formData.postCode} onChange={e => setFormData({ ...formData, postCode: e.target.value })} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-sm font-semibold">Telefon</Label>
                <Input placeholder="+386 1 234 5678" value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-semibold">E-pošta</Label>
                <Input placeholder="lokacija@restavracija.si" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-sm font-semibold">Matična št.</Label>
                <Input placeholder="12345678" value={formData.businessId} onChange={e => setFormData({ ...formData, businessId: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-semibold">ID za DDV</Label>
                <Input placeholder="SI12345678" value={formData.taxId} onChange={e => setFormData({ ...formData, taxId: e.target.value })} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-sm font-semibold">Blagajna</Label>
                <Input placeholder="BLG-002" value={formData.registerNumber} onChange={e => setFormData({ ...formData, registerNumber: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-semibold">ID prostora (FURS)</Label>
                <Input placeholder="Poslovni prostor ID" value={formData.premisesId} onChange={e => setFormData({ ...formData, premisesId: e.target.value })} />
              </div>
            </div>

            <div className="flex items-center justify-between rounded-lg border p-3">
              <div className="space-y-0.5">
                <Label className="text-sm font-semibold">Aktivna</Label>
                <p className="text-xs text-muted-foreground">Neaktivne lokacije ne sprejemajo naročil</p>
              </div>
              <Switch checked={formData.isActive} onCheckedChange={checked => setFormData({ ...formData, isActive: checked })} />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => { setDialogOpen(false); setEditingItem(null) }}>Prekliči</Button>
            <Button onClick={handleSubmit} disabled={createMutation.isPending || updateMutation.isPending}>
              {createMutation.isPending || updateMutation.isPending ? (
                <><span className="animate-spin mr-2">⏳</span>Shranjujem...</>
              ) : editingItem ? 'Posodobi' : <><Plus className="h-4 w-4 mr-1.5" />Ustvari</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dijalog za brisanje */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deaktiviraj lokacijo</AlertDialogTitle>
            <AlertDialogDescription>
              Ali ste prepričani, da želite deaktivirati lokacijo <strong>&bdquo;{deleteTarget?.name}&rdquo;</strong>? Lokacija ne bo izbrisana, ampak le deaktivirana.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Prekliči</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Deaktiviraj
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
