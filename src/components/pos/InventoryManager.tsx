'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { toast } from 'sonner'
import { Plus, Pencil, Trash2, Search, AlertTriangle, Package } from 'lucide-react'
import { useState } from 'react'

const invCategories = ['all', 'general', 'produce', 'meat', 'dairy', 'beverages', 'dry-goods']

const categoryLabels: Record<string, string> = {
  all: 'Vse kategorije',
  general: 'Splošno',
  produce: 'Sveže',
  meat: 'Meso',
  dairy: 'Mlečno',
  beverages: 'Pijače',
  'dry-goods': 'Suho blago',
}

const stockLevelColor = (quantity: number, minQuantity: number) => {
  if (quantity <= 0) return 'destructive'
  if (quantity <= minQuantity) return 'secondary'
  return 'default'
}

const stockLevelText = (quantity: number, minQuantity: number) => {
  if (quantity <= 0) return 'Ni na zalogi'
  if (quantity <= minQuantity * 0.5) return 'Kritično'
  if (quantity <= minQuantity) return 'Nizko'
  return 'Na zalogi'
}

export function InventoryManager() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [filterCategory, setFilterCategory] = useState('all')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<Record<string, unknown> | null>(null)
  const [formData, setFormData] = useState({
    name: '', unit: 'pcs', quantity: '', minQuantity: '10', costPerUnit: '',
    supplier: '', category: 'general', expiryDate: '', menuItemId: '',
  })
  const [quickUpdateId, setQuickUpdateId] = useState<string | null>(null)
  const [quickUpdateQty, setQuickUpdateQty] = useState('')

  const { data: items, isLoading } = useQuery({
    queryKey: ['inventory', filterCategory],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (filterCategory !== 'all') params.set('category', filterCategory)
      const res = await fetch(`/api/inventory?${params}`)
      return res.json()
    },
  })

  const { data: menuItems } = useQuery({
    queryKey: ['menu-items'],
    queryFn: async () => {
      const res = await fetch('/api/menu-items')
      return res.json()
    },
  })

  const filteredItems = (items || []).filter((item: { name: string }) =>
    item.name.toLowerCase().includes(search.toLowerCase())
  )

  const lowStockItems = (items || []).filter((item: { quantity: number; minQuantity: number }) => item.quantity <= item.minQuantity)

  const createMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await fetch('/api/inventory', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
      if (!res.ok) throw new Error('Failed')
      return res.json()
    },
    onSuccess: () => { toast.success('Artikel zaloge ustvarjen'); queryClient.invalidateQueries({ queryKey: ['inventory'] }); setDialogOpen(false) },
  })

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...data }: { id: string } & Record<string, unknown>) => {
      const res = await fetch(`/api/inventory/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
      if (!res.ok) throw new Error('Failed')
      return res.json()
    },
    onSuccess: () => { toast.success('Artikel zaloge posodobljen'); queryClient.invalidateQueries({ queryKey: ['inventory'] }); setDialogOpen(false); setEditingItem(null) },
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/inventory/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed')
      return res.json()
    },
    onSuccess: () => { toast.success('Artikel zaloge izbrisan'); queryClient.invalidateQueries({ queryKey: ['inventory'] }) },
  })

  const openCreate = () => {
    setEditingItem(null)
    setFormData({ name: '', unit: 'pcs', quantity: '', minQuantity: '10', costPerUnit: '', supplier: '', category: 'general', expiryDate: '', menuItemId: '' })
    setDialogOpen(true)
  }

  const openEdit = (item: Record<string, unknown>) => {
    setEditingItem(item)
    setFormData({
      name: String(item.name),
      unit: String(item.unit),
      quantity: String(item.quantity),
      minQuantity: String(item.minQuantity),
      costPerUnit: String(item.costPerUnit),
      supplier: String(item.supplier || ''),
      category: String(item.category),
      expiryDate: item.expiryDate ? new Date(item.expiryDate as string).toISOString().split('T')[0] : '',
      menuItemId: String(item.menuItemId || ''),
    })
    setDialogOpen(true)
  }

  const handleSubmit = () => {
    const payload = {
      ...formData,
      quantity: parseFloat(formData.quantity) || 0,
      minQuantity: parseFloat(formData.minQuantity) || 10,
      costPerUnit: parseFloat(formData.costPerUnit) || 0,
      expiryDate: formData.expiryDate || null,
      menuItemId: formData.menuItemId || null,
    }
    if (editingItem) {
      updateMutation.mutate({ id: editingItem.id as string, ...payload })
    } else {
      createMutation.mutate(payload)
    }
  }

  const handleQuickUpdate = (id: string) => {
    updateMutation.mutate({ id, quantity: parseFloat(quickUpdateQty) || 0 })
    setQuickUpdateId(null)
    setQuickUpdateQty('')
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Zaloga</h2>
          <p className="text-muted-foreground">Spremljajte zaloge in dobave</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Dodaj artikel
        </Button>
      </div>

      {/* Low Stock Alerts */}
      {lowStockItems.length > 0 && (
        <Card className="border-red-200 dark:border-red-900/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              <span className="font-semibold text-red-600">Opozorila nizke zaloge ({lowStockItems.length})</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {lowStockItems.map((item: { id: string; name: string; quantity: number; minQuantity: number; unit: string }) => (
                <Badge key={item.id} variant="destructive" className="text-xs">
                  {item.name}: {item.quantity} {item.unit} (min: {item.minQuantity})
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Search & Filter */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-48 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Išči v zalogi..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={filterCategory} onValueChange={setFilterCategory}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Vse kategorije" />
          </SelectTrigger>
          <SelectContent>
            {invCategories.map(c => (
              <SelectItem key={c} value={c}>{categoryLabels[c] || c}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-36" />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredItems.map((item: Record<string, unknown>) => {
            const qty = Number(item.quantity)
            const minQty = Number(item.minQuantity)
            const pct = minQty > 0 ? Math.min((qty / (minQty * 2)) * 100, 100) : 100

            return (
              <Card key={item.id as string} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <Package className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="font-medium text-sm">{String(item.name)}</p>
                        <p className="text-xs text-muted-foreground">{String(item.supplier || 'Brez dobavitelja')}</p>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(item)}>
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteMutation.mutate(item.id as string)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-sm">
                    <span className="font-semibold">{qty} {String(item.unit)}</span>
                    <Badge variant={stockLevelColor(qty, minQty)} className="text-xs">
                      {stockLevelText(qty, minQty)}
                    </Badge>
                  </div>

                  <Progress value={pct} className="h-1.5" />

                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Min: {minQty} {String(item.unit)}</span>
                    <span>${Number(item.costPerUnit).toFixed(2)}/{String(item.unit)}</span>
                  </div>

                  {/* Quick stock update */}
                  {quickUpdateId === item.id ? (
                    <div className="flex gap-1">
                      <Input
                        type="number"
                        value={quickUpdateQty}
                        onChange={(e) => setQuickUpdateQty(e.target.value)}
                        placeholder="Nova količina"
                        className="h-7 text-xs"
                      />
                      <Button size="sm" className="h-7 text-xs" onClick={() => handleQuickUpdate(item.id as string)}>Shrani</Button>
                      <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setQuickUpdateId(null)}>X</Button>
                    </div>
                  ) : (
                    <Button variant="outline" size="sm" className="w-full h-7 text-xs" onClick={() => { setQuickUpdateId(item.id as string); setQuickUpdateQty(String(qty)) }}>
                      Hitra posodobitev zaloge
                    </Button>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {filteredItems.length === 0 && !isLoading && (
        <p className="text-center py-12 text-muted-foreground">Ni najdenih artiklov v zalogi</p>
      )}

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingItem ? 'Uredi artikel zaloge' : 'Dodaj artikel v zalogo'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div><Label>Ime</Label><Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Enota</Label><Input value={formData.unit} onChange={(e) => setFormData({ ...formData, unit: e.target.value })} /></div>
              <div><Label>Količina</Label><Input type="number" value={formData.quantity} onChange={(e) => setFormData({ ...formData, quantity: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Min. količina</Label><Input type="number" value={formData.minQuantity} onChange={(e) => setFormData({ ...formData, minQuantity: e.target.value })} /></div>
              <div><Label>Strošek/enota ($)</Label><Input type="number" step="0.01" value={formData.costPerUnit} onChange={(e) => setFormData({ ...formData, costPerUnit: e.target.value })} /></div>
            </div>
            <div><Label>Dobavitelj</Label><Input value={formData.supplier} onChange={(e) => setFormData({ ...formData, supplier: e.target.value })} /></div>
            <div><Label>Kategorija</Label>
              <Select value={formData.category} onValueChange={(v) => setFormData({ ...formData, category: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['general', 'produce', 'meat', 'dairy', 'beverages', 'dry-goods'].map(c => (
                    <SelectItem key={c} value={c}>{categoryLabels[c] || c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Povezan artikel</Label>
              <Select value={formData.menuItemId || 'none'} onValueChange={(v) => setFormData({ ...formData, menuItemId: v === 'none' ? '' : v })}>
                <SelectTrigger><SelectValue placeholder="Brez" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Brez</SelectItem>
                  {menuItems?.map((mi: { id: string; name: string }) => (
                    <SelectItem key={mi.id} value={mi.id}>{mi.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Rok uporabe</Label><Input type="date" value={formData.expiryDate} onChange={(e) => setFormData({ ...formData, expiryDate: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Prekliči</Button>
            <Button onClick={handleSubmit} disabled={!formData.name}>{editingItem ? 'Posodobi' : 'Ustvari'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
