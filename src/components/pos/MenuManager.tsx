'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { Plus, Pencil, Trash2, Search, LayoutGrid, List, UtensilsCrossed, Tag, ImageIcon, BookOpen, Settings2 } from 'lucide-react'
import { useState } from 'react'

export function MenuManager() {
  const queryClient = useQueryClient()
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [search, setSearch] = useState('')
  const [filterCategory, setFilterCategory] = useState('all')
  const [filterMenu, setFilterMenu] = useState('all')
  const [activeTab, setActiveTab] = useState('items')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<Record<string, unknown> | null>(null)
  const [itemForm, setItemForm] = useState({ name: '', description: '', price: '', categoryId: '', isAvailable: true, image: '', modifierGroupIds: [] as string[] })
  const [catDialogOpen, setCatDialogOpen] = useState(false)
  const [catForm, setCatForm] = useState({ name: '', icon: '🍽️', color: '#f59e0b', menuId: '' })
  const [menuDialogOpen, setMenuDialogOpen] = useState(false)
  const [menuForm, setMenuForm] = useState({ name: '', icon: '📋', color: '#f59e0b' })

  const { data: menus } = useQuery({
    queryKey: ['menus'],
    queryFn: async () => {
      const res = await fetch('/api/menus')
      return res.json()
    },
  })

  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const res = await fetch('/api/categories')
      return res.json()
    },
  })

  const { data: modifierGroups } = useQuery({
    queryKey: ['modifier-groups'],
    queryFn: async () => {
      const res = await fetch('/api/modifier-groups')
      return res.json()
    },
  })

  const { data: menuItems, isLoading } = useQuery({
    queryKey: ['menu-items'],
    queryFn: async () => {
      const res = await fetch('/api/menu-items')
      return res.json()
    },
  })

  const filteredItems = (menuItems || []).filter((item: { name: string; categoryId: string; category?: { menu?: { id: string } } }) => {
    const matchesSearch = item.name.toLowerCase().includes(search.toLowerCase())
    const matchesCat = filterCategory === 'all' || item.categoryId === filterCategory
    const matchesMenu = filterMenu === 'all' || item.category?.menu?.id === filterMenu
    return matchesSearch && matchesCat && matchesMenu
  })

  // Menu mutations
  const createMenuMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await fetch('/api/menus', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
      if (!res.ok) throw new Error('Failed')
      return res.json()
    },
    onSuccess: () => { toast.success('Meni ustvarjen'); queryClient.invalidateQueries({ queryKey: ['menus'] }); setMenuDialogOpen(false) },
  })

  // Menu item mutations
  const createItemMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await fetch('/api/menu-items', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
      if (!res.ok) throw new Error('Failed')
      return res.json()
    },
    onSuccess: () => { toast.success('Artikel ustvarjen'); queryClient.invalidateQueries({ queryKey: ['menu-items'] }); setDialogOpen(false) },
  })

  const updateItemMutation = useMutation({
    mutationFn: async ({ id, ...data }: { id: string } & Record<string, unknown>) => {
      const res = await fetch(`/api/menu-items/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
      if (!res.ok) throw new Error('Failed')
      return res.json()
    },
    onSuccess: () => { toast.success('Artikel posodobljen'); queryClient.invalidateQueries({ queryKey: ['menu-items'] }); setDialogOpen(false); setEditingItem(null) },
  })

  const deleteItemMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/menu-items/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed')
      return res.json()
    },
    onSuccess: () => { toast.success('Artikel izbrisan'); queryClient.invalidateQueries({ queryKey: ['menu-items'] }) },
  })

  const toggleAvailabilityMutation = useMutation({
    mutationFn: async ({ id, isAvailable }: { id: string; isAvailable: boolean }) => {
      const res = await fetch(`/api/menu-items/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ isAvailable }) })
      if (!res.ok) throw new Error('Failed')
      return res.json()
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['menu-items'] }) },
  })

  // Category mutations
  const createCatMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await fetch('/api/categories', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
      if (!res.ok) throw new Error('Failed')
      return res.json()
    },
    onSuccess: () => { toast.success('Kategorija ustvarjena'); queryClient.invalidateQueries({ queryKey: ['categories'] }); setCatDialogOpen(false) },
  })

  const openCreateItem = () => {
    setEditingItem(null)
    setItemForm({ name: '', description: '', price: '', categoryId: categories?.[0]?.id || '', isAvailable: true, image: '', modifierGroupIds: [] })
    setDialogOpen(true)
  }

  const openEditItem = (item: Record<string, unknown>) => {
    setEditingItem(item)
    const existingModGroups = (item.modifierGroups as { modifierGroup: { id: string } }[])?.map(mg => mg.modifierGroup.id) || []
    setItemForm({
      name: String(item.name),
      description: String(item.description || ''),
      price: String(item.price),
      categoryId: String(item.categoryId),
      isAvailable: Boolean(item.isAvailable),
      image: String(item.image || ''),
      modifierGroupIds: existingModGroups,
    })
    setDialogOpen(true)
  }

  const handleItemSubmit = () => {
    const payload = { ...itemForm, price: parseFloat(itemForm.price) }
    if (editingItem) {
      updateItemMutation.mutate({ id: editingItem.id as string, ...payload })
    } else {
      createItemMutation.mutate(payload)
    }
  }

  // Get categories grouped by menu for display
  const categoriesByMenu = (categories || []).reduce((acc: Record<string, typeof categories>, cat: { menuId?: string; menu?: { id: string; name: string } }) => {
    const menuId = cat.menu?.id || cat.menuId || 'uncategorized'
    if (!acc[menuId]) acc[menuId] = []
    acc[menuId].push(cat)
    return acc
  }, {})

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Upravljanje jedilnika</h2>
          <p className="text-muted-foreground">Upravljajte menije, kategorije in artikle</p>
        </div>
        <Button onClick={openCreateItem}>
          <Plus className="h-4 w-4 mr-2" />
          Dodaj artikel
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="items">
            <UtensilsCrossed className="h-4 w-4 mr-1" />
            Artikli
          </TabsTrigger>
          <TabsTrigger value="categories">
            <Tag className="h-4 w-4 mr-1" />
            Kategorije
          </TabsTrigger>
          <TabsTrigger value="menus">
            <BookOpen className="h-4 w-4 mr-1" />
            Meniji
          </TabsTrigger>
          <TabsTrigger value="modifiers">
            <Settings2 className="h-4 w-4 mr-1" />
            Dodatki
          </TabsTrigger>
        </TabsList>

        {/* Tab artiklov */}
        <TabsContent value="items" className="space-y-4">
          <div className="flex flex-wrap gap-3 items-center">
            <div className="relative flex-1 min-w-48 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Išči artikle..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={filterMenu} onValueChange={(v) => { setFilterMenu(v); setFilterCategory('all') }}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Vsi meniji" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Vsi meniji</SelectItem>
                {menus?.map((m: { id: string; name: string; icon: string }) => (
                  <SelectItem key={m.id} value={m.id}>{m.icon} {m.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterCategory} onValueChange={setFilterCategory}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Vse kategorije" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Vse kategorije</SelectItem>
                {categories?.filter((c: { menu?: { id: string } }) => filterMenu === 'all' || c.menu?.id === filterMenu).map((cat: { id: string; name: string; icon: string }) => (
                  <SelectItem key={cat.id} value={cat.id}>{cat.icon} {cat.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex border rounded-md">
              <Button variant={viewMode === 'grid' ? 'default' : 'ghost'} size="icon" className="h-9 w-9 rounded-r-none" onClick={() => setViewMode('grid')}>
                <LayoutGrid className="h-4 w-4" />
              </Button>
              <Button variant={viewMode === 'list' ? 'default' : 'ghost'} size="icon" className="h-9 w-9 rounded-l-none" onClick={() => setViewMode('list')}>
                <List className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {[...Array(8)].map((_, i) => <Skeleton key={i} className="h-32" />)}
            </div>
          ) : viewMode === 'grid' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {filteredItems.map((item: Record<string, unknown>) => {
                const cat = categories?.find((c: { id: string }) => c.id === item.categoryId)
                const itemModGroups = (item.modifierGroups as { modifierGroup: { name: string } }[]) || []
                return (
                  <Card key={item.id as string} className={`hover:shadow-md transition-shadow overflow-hidden ${!item.isAvailable ? 'opacity-60' : ''}`}>
                    <div className="w-full aspect-[16/9] bg-muted/50 relative overflow-hidden">
                      {item.image ? (
                        <img
                          src={String(item.image)}
                          alt={String(item.name)}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement
                            target.style.display = 'none'
                            target.nextElementSibling?.classList.remove('hidden')
                          }}
                        />
                      ) : null}
                      <div className={`absolute inset-0 flex items-center justify-center ${item.image ? 'hidden' : ''}`}>
                        <ImageIcon className="h-10 w-10 text-muted-foreground/30" />
                      </div>
                      <div className="absolute top-2 right-2 flex gap-1">
                        <Button variant="secondary" size="icon" className="h-7 w-7 shadow-sm" onClick={() => openEditItem(item)}>
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button variant="secondary" size="icon" className="h-7 w-7 shadow-sm text-destructive" onClick={() => deleteItemMutation.mutate(item.id as string)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                    <CardContent className="p-3 space-y-2">
                      <div>
                        <p className="font-medium text-sm">{String(item.name)}</p>
                        <p className="text-primary font-bold text-sm">€{Number(item.price).toFixed(2)}</p>
                      </div>
                      {item.description && <p className="text-xs text-muted-foreground line-clamp-2">{String(item.description)}</p>}
                      <div className="flex items-center justify-between flex-wrap gap-1">
                        {cat && <Badge variant="outline" className="text-xs">{String(cat.icon)} {String(cat.name)}</Badge>}
                        {itemModGroups.length > 0 && (
                          <Badge variant="secondary" className="text-[9px] h-4 px-1">
                            +{itemModGroups.length} {itemModGroups.length === 1 ? 'dodatek' : 'dodatkov'}
                          </Badge>
                        )}
                        <Switch
                          checked={Boolean(item.isAvailable)}
                          onCheckedChange={(checked) => toggleAvailabilityMutation.mutate({ id: item.id as string, isAvailable: checked })}
                          className="scale-75"
                        />
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          ) : (
            <div className="space-y-2">
              {filteredItems.map((item: Record<string, unknown>) => {
                const cat = categories?.find((c: { id: string }) => c.id === item.categoryId)
                const itemModGroups = (item.modifierGroups as { modifierGroup: { name: string } }[]) || []
                return (
                  <div key={item.id as string} className={`flex items-center justify-between p-3 rounded-lg border bg-card ${!item.isAvailable ? 'opacity-60' : ''}`}>
                    <div className="flex items-center gap-3">
                      {item.image ? (
                        <div className="w-12 h-12 rounded-md overflow-hidden flex-shrink-0">
                          <img src={String(item.image)} alt={String(item.name)} className="w-full h-full object-cover" />
                        </div>
                      ) : (
                        <div className="w-12 h-12 rounded-md bg-muted flex-shrink-0 flex items-center justify-center">
                          <ImageIcon className="h-5 w-5 text-muted-foreground/40" />
                        </div>
                      )}
                      <div>
                        <p className="font-medium text-sm">{String(item.name)}</p>
                        <p className="text-xs text-muted-foreground">{String(item.description || '')}</p>
                        {itemModGroups.length > 0 && (
                          <div className="flex flex-wrap gap-0.5 mt-0.5">
                            {itemModGroups.map((mg, i) => (
                              <Badge key={i} variant="secondary" className="text-[9px] h-3.5 px-1">
                                {mg.modifierGroup.name}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {cat && <Badge variant="outline" className="text-xs">{String(cat.icon)} {String(cat.name)}</Badge>}
                      <span className="font-bold text-sm">€{Number(item.price).toFixed(2)}</span>
                      <Switch checked={Boolean(item.isAvailable)} onCheckedChange={(c) => toggleAvailabilityMutation.mutate({ id: item.id as string, isAvailable: c })} className="scale-75" />
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditItem(item)}><Pencil className="h-3 w-3" /></Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteItemMutation.mutate(item.id as string)}><Trash2 className="h-3 w-3" /></Button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {filteredItems.length === 0 && !isLoading && (
            <p className="text-center py-12 text-muted-foreground">Ni najdenih artiklov</p>
          )}
        </TabsContent>

        {/* Tab kategorij - organized by menu */}
        <TabsContent value="categories" className="space-y-4">
          <Button onClick={() => { setCatForm({ name: '', icon: '🍽️', color: '#f59e0b', menuId: menus?.[0]?.id || '' }); setCatDialogOpen(true) }}>
            <Plus className="h-4 w-4 mr-2" />
            Dodaj kategorijo
          </Button>

          {menus?.map((menu: { id: string; name: string; icon: string; color: string }) => {
            const menuCategories = categories?.filter((c: { menuId?: string; menu?: { id: string } }) =>
              (c.menu?.id || c.menuId) === menu.id
            ) || []
            return (
              <div key={menu.id} className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-1 rounded-full" style={{ backgroundColor: menu.color }} />
                  <h3 className="text-lg font-semibold">{menu.icon} {menu.name}</h3>
                  <Badge variant="outline">{menuCategories.length} kategorij</Badge>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  {menuCategories.map((cat: Record<string, unknown>) => (
                    <Card key={cat.id as string} className="hover:shadow-md transition-shadow">
                      <CardContent className="p-4 flex items-center gap-3">
                        <div
                          className="flex h-10 w-10 items-center justify-center rounded-lg text-xl"
                          style={{ backgroundColor: `${String(cat.color)}20` }}
                        >
                          {String(cat.icon)}
                        </div>
                        <div className="flex-1">
                          <p className="font-medium">{String(cat.name)}</p>
                          <p className="text-xs text-muted-foreground">{(cat.menuItems as unknown[])?.length || 0} artiklov</p>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )
          })}
        </TabsContent>

        {/* Tab menijev */}
        <TabsContent value="menus" className="space-y-4">
          <Button onClick={() => { setMenuForm({ name: '', icon: '📋', color: '#f59e0b' }); setMenuDialogOpen(true) }}>
            <Plus className="h-4 w-4 mr-2" />
            Dodaj meni
          </Button>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {menus?.map((menu: { id: string; name: string; icon: string; color: string; isActive: boolean; categories: { id: string }[] }) => {
              const menuCategories = categories?.filter((c: { menuId?: string; menu?: { id: string } }) =>
                (c.menu?.id || c.menuId) === menu.id
              ) || []
              return (
                <Card key={menu.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-6 space-y-3">
                    <div className="flex items-center gap-3">
                      <div
                        className="flex h-14 w-14 items-center justify-center rounded-xl text-2xl"
                        style={{ backgroundColor: `${menu.color}20` }}
                      >
                        {menu.icon}
                      </div>
                      <div>
                        <p className="font-semibold text-lg">{menu.name}</p>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">{menuCategories.length} kategorij</Badge>
                          <Badge variant={menu.isActive ? 'default' : 'secondary'}>
                            {menu.isActive ? 'Aktiven' : 'Neaktiven'}
                          </Badge>
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {menuCategories.map((cat: { id: string; name: string; icon: string }) => (
                        <Badge key={cat.id} variant="outline" className="text-xs">
                          {cat.icon} {cat.name}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </TabsContent>

        {/* Tab dodatkov (modifier groups) */}
        <TabsContent value="modifiers" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {modifierGroups?.map((mg: {
              id: string
              name: string
              required: boolean
              minSelect: number
              maxSelect: number | null
              modifiers: { id: string; name: string; price: number }[]
              menuItems: { menuItem: { id: string; name: string } }[]
            }) => (
              <Card key={mg.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold">{mg.name}</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        {mg.required && <Badge variant="destructive" className="text-[9px] h-4 px-1">Obvezno</Badge>}
                        {mg.maxSelect && <Badge variant="outline" className="text-[9px] h-4 px-1">Max {mg.maxSelect}</Badge>}
                        {!mg.required && mg.minSelect === 0 && <Badge variant="secondary" className="text-[9px] h-4 px-1">Izbirno</Badge>}
                      </div>
                    </div>
                    <Badge variant="outline">{mg.modifiers.length} opcij</Badge>
                  </div>
                  <div className="space-y-1">
                    {mg.modifiers.map((mod) => (
                      <div key={mod.id} className="flex items-center justify-between py-1 px-2 rounded bg-muted/50 text-sm">
                        <span>{mod.name}</span>
                        {mod.price > 0 && <span className="text-primary font-medium">+€{mod.price.toFixed(2)}</span>}
                      </div>
                    ))}
                  </div>
                  {mg.menuItems.length > 0 && (
                    <div className="pt-2 border-t">
                      <p className="text-xs text-muted-foreground mb-1">Uporabljeno pri:</p>
                      <div className="flex flex-wrap gap-0.5">
                        {mg.menuItems.map((mi) => (
                          <Badge key={mi.menuItem.id} variant="outline" className="text-[9px] h-4 px-1">
                            {mi.menuItem.name}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* Item Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingItem ? 'Uredi artikel' : 'Dodaj artikel'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {itemForm.image && (
              <div className="w-full aspect-[16/9] rounded-lg overflow-hidden bg-muted/50">
                <img src={itemForm.image} alt="Preview" className="w-full h-full object-cover" />
              </div>
            )}
            <div>
              <Label>URL slike</Label>
              <Input value={itemForm.image} onChange={(e) => setItemForm({ ...itemForm, image: e.target.value })} placeholder="/menu-images/ime-artikla.png" />
            </div>
            <div>
              <Label>Ime</Label>
              <Input value={itemForm.name} onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })} />
            </div>
            <div>
              <Label>Opis</Label>
              <Textarea value={itemForm.description} onChange={(e) => setItemForm({ ...itemForm, description: e.target.value })} />
            </div>
            <div>
              <Label>Cena (€)</Label>
              <Input type="number" step="0.01" value={itemForm.price} onChange={(e) => setItemForm({ ...itemForm, price: e.target.value })} />
            </div>
            <div>
              <Label>Meni</Label>
              <Select
                value={categories?.find((c: { id: string }) => c.id === itemForm.categoryId)?.menu?.id || ''}
                onValueChange={(menuId) => {
                  const firstCatInMenu = categories?.find((c: { menu?: { id: string } }) => c.menu?.id === menuId)
                  setItemForm({ ...itemForm, categoryId: firstCatInMenu?.id || '' })
                }}
              >
                <SelectTrigger><SelectValue placeholder="Izberi meni" /></SelectTrigger>
                <SelectContent>
                  {menus?.map((m: { id: string; name: string; icon: string }) => (
                    <SelectItem key={m.id} value={m.id}>{m.icon} {m.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Kategorija</Label>
              <Select value={itemForm.categoryId} onValueChange={(v) => setItemForm({ ...itemForm, categoryId: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {categories?.map((cat: { id: string; name: string; icon: string; menu?: { id: string; name: string } }) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.icon} {cat.name} {cat.menu ? `(${cat.menu.name})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Dodatki (modifier skupine)</Label>
              <div className="space-y-1 mt-1">
                {modifierGroups?.map((mg: { id: string; name: string; required: boolean }) => (
                  <label key={mg.id} className="flex items-center gap-2 p-2 rounded border cursor-pointer hover:bg-accent text-sm">
                    <input
                      type="checkbox"
                      checked={itemForm.modifierGroupIds.includes(mg.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setItemForm({ ...itemForm, modifierGroupIds: [...itemForm.modifierGroupIds, mg.id] })
                        } else {
                          setItemForm({ ...itemForm, modifierGroupIds: itemForm.modifierGroupIds.filter(id => id !== mg.id) })
                        }
                      }}
                      className="rounded"
                    />
                    <span>{mg.name}</span>
                    {mg.required && <Badge variant="destructive" className="text-[9px] h-3.5 px-1 ml-auto">Obvezno</Badge>}
                  </label>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={itemForm.isAvailable} onCheckedChange={(c) => setItemForm({ ...itemForm, isAvailable: c })} />
              <Label>Na voljo</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Prekliči</Button>
            <Button onClick={handleItemSubmit} disabled={!itemForm.name || !itemForm.price || !itemForm.categoryId}>
              {editingItem ? 'Posodobi' : 'Ustvari'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Category Dialog */}
      <Dialog open={catDialogOpen} onOpenChange={setCatDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Dodaj kategorijo</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Meni</Label>
              <Select value={catForm.menuId} onValueChange={(v) => setCatForm({ ...catForm, menuId: v })}>
                <SelectTrigger><SelectValue placeholder="Izberi meni" /></SelectTrigger>
                <SelectContent>
                  {menus?.map((m: { id: string; name: string; icon: string }) => (
                    <SelectItem key={m.id} value={m.id}>{m.icon} {m.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Ime</Label>
              <Input value={catForm.name} onChange={(e) => setCatForm({ ...catForm, name: e.target.value })} />
            </div>
            <div>
              <Label>Ikona (emoji)</Label>
              <Input value={catForm.icon} onChange={(e) => setCatForm({ ...catForm, icon: e.target.value })} />
            </div>
            <div>
              <Label>Barva</Label>
              <Input type="color" value={catForm.color} onChange={(e) => setCatForm({ ...catForm, color: e.target.value })} className="h-10" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCatDialogOpen(false)}>Prekliči</Button>
            <Button onClick={() => createCatMutation.mutate(catForm)} disabled={!catForm.name || !catForm.menuId}>
              Ustvari
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Menu Dialog */}
      <Dialog open={menuDialogOpen} onOpenChange={setMenuDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Dodaj meni</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Ime</Label>
              <Input value={menuForm.name} onChange={(e) => setMenuForm({ ...menuForm, name: e.target.value })} placeholder="npr. Hrana, Pijača" />
            </div>
            <div>
              <Label>Ikona (emoji)</Label>
              <Input value={menuForm.icon} onChange={(e) => setMenuForm({ ...menuForm, icon: e.target.value })} />
            </div>
            <div>
              <Label>Barva</Label>
              <Input type="color" value={menuForm.color} onChange={(e) => setMenuForm({ ...menuForm, color: e.target.value })} className="h-10" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMenuDialogOpen(false)}>Prekliči</Button>
            <Button onClick={() => createMenuMutation.mutate(menuForm)} disabled={!menuForm.name}>
              Ustvari
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
