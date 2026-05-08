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
import { Plus, Pencil, Trash2, Search, LayoutGrid, List, UtensilsCrossed, Tag, ImageIcon } from 'lucide-react'
import { useState } from 'react'

export function MenuManager() {
  const queryClient = useQueryClient()
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [search, setSearch] = useState('')
  const [filterCategory, setFilterCategory] = useState('all')
  const [activeTab, setActiveTab] = useState('items')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<Record<string, unknown> | null>(null)
  const [itemForm, setItemForm] = useState({ name: '', description: '', price: '', categoryId: '', isAvailable: true, image: '' })
  const [catDialogOpen, setCatDialogOpen] = useState(false)
  const [editingCat, setEditingCat] = useState<Record<string, unknown> | null>(null)
  const [catForm, setCatForm] = useState({ name: '', icon: '🍽️', color: '#f59e0b' })

  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const res = await fetch('/api/categories')
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

  const filteredItems = (menuItems || []).filter((item: { name: string; categoryId: string }) => {
    const matchesSearch = item.name.toLowerCase().includes(search.toLowerCase())
    const matchesCat = filterCategory === 'all' || item.categoryId === filterCategory
    return matchesSearch && matchesCat
  })

  // Menu item mutations
  const createItemMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await fetch('/api/menu-items', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
      if (!res.ok) throw new Error('Failed')
      return res.json()
    },
    onSuccess: () => { toast.success('Menu item created'); queryClient.invalidateQueries({ queryKey: ['menu-items'] }); setDialogOpen(false) },
  })

  const updateItemMutation = useMutation({
    mutationFn: async ({ id, ...data }: { id: string } & Record<string, unknown>) => {
      const res = await fetch(`/api/menu-items/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
      if (!res.ok) throw new Error('Failed')
      return res.json()
    },
    onSuccess: () => { toast.success('Menu item updated'); queryClient.invalidateQueries({ queryKey: ['menu-items'] }); setDialogOpen(false); setEditingItem(null) },
  })

  const deleteItemMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/menu-items/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed')
      return res.json()
    },
    onSuccess: () => { toast.success('Menu item deleted'); queryClient.invalidateQueries({ queryKey: ['menu-items'] }) },
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
    onSuccess: () => { toast.success('Category created'); queryClient.invalidateQueries({ queryKey: ['categories'] }); setCatDialogOpen(false) },
  })

  // Note: No PUT/DELETE for categories in API spec, so skip for now

  const openCreateItem = () => {
    setEditingItem(null)
    setItemForm({ name: '', description: '', price: '', categoryId: categories?.[0]?.id || '', isAvailable: true, image: '' })
    setDialogOpen(true)
  }

  const openEditItem = (item: Record<string, unknown>) => {
    setEditingItem(item)
    setItemForm({
      name: String(item.name),
      description: String(item.description || ''),
      price: String(item.price),
      categoryId: String(item.categoryId),
      isAvailable: Boolean(item.isAvailable),
      image: String(item.image || ''),
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Menu Management</h2>
          <p className="text-muted-foreground">Manage your menu items and categories</p>
        </div>
        <Button onClick={openCreateItem}>
          <Plus className="h-4 w-4 mr-2" />
          Add Item
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="items">
            <UtensilsCrossed className="h-4 w-4 mr-1" />
            Menu Items
          </TabsTrigger>
          <TabsTrigger value="categories">
            <Tag className="h-4 w-4 mr-1" />
            Categories
          </TabsTrigger>
        </TabsList>

        {/* Menu Items Tab */}
        <TabsContent value="items" className="space-y-4">
          <div className="flex flex-wrap gap-3 items-center">
            <div className="relative flex-1 min-w-48 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search items..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={filterCategory} onValueChange={setFilterCategory}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories?.map((cat: { id: string; name: string; icon: string }) => (
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
                return (
                  <Card key={item.id as string} className={`hover:shadow-md transition-shadow overflow-hidden ${!item.isAvailable ? 'opacity-60' : ''}`}>
                    {/* Item image header */}
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
                      {/* Edit/Delete overlay buttons */}
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
                        <p className="text-primary font-bold text-sm">${Number(item.price).toFixed(2)}</p>
                      </div>
                      {item.description && <p className="text-xs text-muted-foreground line-clamp-2">{String(item.description)}</p>}
                      <div className="flex items-center justify-between">
                        {cat && <Badge variant="outline" className="text-xs">{String(cat.icon)} {String(cat.name)}</Badge>}
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
                return (
                  <div key={item.id as string} className={`flex items-center justify-between p-3 rounded-lg border bg-card ${!item.isAvailable ? 'opacity-60' : ''}`}>
                    <div className="flex items-center gap-3">
                      {/* List view thumbnail */}
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
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {cat && <Badge variant="outline" className="text-xs">{String(cat.icon)} {String(cat.name)}</Badge>}
                      <span className="font-bold text-sm">${Number(item.price).toFixed(2)}</span>
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
            <p className="text-center py-12 text-muted-foreground">No menu items found</p>
          )}
        </TabsContent>

        {/* Categories Tab */}
        <TabsContent value="categories" className="space-y-4">
          <Button onClick={() => { setEditingCat(null); setCatForm({ name: '', icon: '🍽️', color: '#f59e0b' }); setCatDialogOpen(true) }}>
            <Plus className="h-4 w-4 mr-2" />
            Add Category
          </Button>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {categories?.map((cat: Record<string, unknown>) => (
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
                    <p className="text-xs text-muted-foreground">{String(cat.color)}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* Item Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingItem ? 'Edit Menu Item' : 'Add Menu Item'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {/* Image preview */}
            {itemForm.image && (
              <div className="w-full aspect-[16/9] rounded-lg overflow-hidden bg-muted/50">
                <img src={itemForm.image} alt="Preview" className="w-full h-full object-cover" />
              </div>
            )}
            <div>
              <Label>Image URL</Label>
              <Input value={itemForm.image} onChange={(e) => setItemForm({ ...itemForm, image: e.target.value })} placeholder="/menu-images/item-name.png" />
            </div>
            <div>
              <Label>Name</Label>
              <Input value={itemForm.name} onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })} />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea value={itemForm.description} onChange={(e) => setItemForm({ ...itemForm, description: e.target.value })} />
            </div>
            <div>
              <Label>Price ($)</Label>
              <Input type="number" step="0.01" value={itemForm.price} onChange={(e) => setItemForm({ ...itemForm, price: e.target.value })} />
            </div>
            <div>
              <Label>Category</Label>
              <Select value={itemForm.categoryId} onValueChange={(v) => setItemForm({ ...itemForm, categoryId: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {categories?.map((cat: { id: string; name: string; icon: string }) => (
                    <SelectItem key={cat.id} value={cat.id}>{cat.icon} {cat.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={itemForm.isAvailable} onCheckedChange={(c) => setItemForm({ ...itemForm, isAvailable: c })} />
              <Label>Available</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleItemSubmit} disabled={!itemForm.name || !itemForm.price || !itemForm.categoryId}>
              {editingItem ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Category Dialog */}
      <Dialog open={catDialogOpen} onOpenChange={setCatDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Category</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Name</Label>
              <Input value={catForm.name} onChange={(e) => setCatForm({ ...catForm, name: e.target.value })} />
            </div>
            <div>
              <Label>Icon (emoji)</Label>
              <Input value={catForm.icon} onChange={(e) => setCatForm({ ...catForm, icon: e.target.value })} />
            </div>
            <div>
              <Label>Color</Label>
              <Input type="color" value={catForm.color} onChange={(e) => setCatForm({ ...catForm, color: e.target.value })} className="h-10" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCatDialogOpen(false)}>Cancel</Button>
            <Button onClick={() => createCatMutation.mutate(catForm)} disabled={!catForm.name}>
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
