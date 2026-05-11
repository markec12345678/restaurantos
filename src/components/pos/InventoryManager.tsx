'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import {
  Plus, Pencil, Trash2, Search, AlertTriangle, Package,
  Truck, FileMinus, History, ArrowDownCircle, ArrowUpCircle,
  RotateCcw, SlidersHorizontal, ChevronDown, ChevronUp,
} from 'lucide-react'
import { useState } from 'react'
import { authFetch } from '@/components/pos/PinLogin'

// ============================================
// KONSTANTE
// ============================================

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

const transactionTypeLabels: Record<string, string> = {
  procurement: 'Nabava',
  sale: 'Prodaja',
  'write-off': 'Odpis',
  adjustment: 'Popravek',
  return: 'Vrnitev',
}

const transactionTypeColors: Record<string, string> = {
  procurement: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  sale: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  'write-off': 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  adjustment: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  return: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
}

const writeOffReasons = [
  'Kvar - rok uporabe',
  'Kvar - poškodba',
  'Razbitje',
  'Izguba',
  'Kraja',
  'Napaka pri vnosu',
  'Popravek inventorja',
  'Vrnitev dobavitelju',
  'Drugo',
]

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

// ============================================
// TIP ZA ZALOŽNI ARTIKEL
// ============================================

interface InventoryItemData {
  id: string
  name: string
  description: string
  image: string
  unit: string
  quantity: number
  minQuantity: number
  costPerUnit: number
  supplier: string
  category: string
  expiryDate: string | null
  servingsPerUnit: number
  servingSize: string
  costPerServing: number
  menuItemId: string | null
  menuItem?: { id: string; name: string; price: number; image: string } | null
  lastRestocked: string
}

interface TransactionData {
  id: string
  inventoryItemId: string
  type: string
  quantity: number
  previousQty: number
  newQty: number
  costPerUnit: number
  totalCost: number
  reason: string
  note: string
  supplierDoc: string
  employeeName: string
  orderId: string | null
  createdAt: string
  inventoryItem: { name: string; unit: string; category: string }
}

// ============================================
// MAIN KOMPONENTA
// ============================================

export function InventoryManager() {
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState('stock')
  const [search, setSearch] = useState('')
  const [filterCategory, setFilterCategory] = useState('all')

  // --- Dijalog za urejanje artikla ---
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<InventoryItemData | null>(null)
  const [formData, setFormData] = useState({
    name: '', description: '', image: '', unit: 'pcs', quantity: '', minQuantity: '10', costPerUnit: '',
    supplier: '', category: 'general', expiryDate: '', menuItemId: '',
    servingsPerUnit: '1', servingSize: '', costPerServing: '',
  })

  // --- Nabava (restock) ---
  const [restockDialogOpen, setRestockDialogOpen] = useState(false)
  const [restockItemId, setRestockItemId] = useState<string>('')
  const [restockData, setRestockData] = useState({
    quantity: '', costPerUnit: '', supplierDoc: '', employeeName: '', note: '',
  })

  // --- Razknjižba (write-off) ---
  const [writeOffDialogOpen, setWriteOffDialogOpen] = useState(false)
  const [writeOffItemId, setWriteOffItemId] = useState<string>('')
  const [writeOffData, setWriteOffData] = useState({
    quantity: '', type: 'write-off', reason: '', note: '', employeeName: '',
  })

  // --- Zgodovina filtri ---
  const [txTypeFilter, setTxTypeFilter] = useState('all')
  const [txDateFrom, setTxDateFrom] = useState('')
  const [txDateTo, setTxDateTo] = useState('')
  const [expandedItem, setExpandedItem] = useState<string | null>(null)

  // ============================================
  // QUERIES
  // ============================================

  const { data: items, isLoading } = useQuery<InventoryItemData[]>({
    queryKey: ['inventory', filterCategory],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (filterCategory !== 'all') params.set('category', filterCategory)
      const res = await authFetch(`/api/inventory?${params}`)
      return res.json()
    },
  })

  const { data: menuItems } = useQuery({
    queryKey: ['menu-items'],
    queryFn: async () => {
      const res = await authFetch('/api/menu-items')
      return res.json()
    },
  })

  const { data: transactionsData, isLoading: txLoading } = useQuery<{
    transactions: TransactionData[]
    total: number
    summary: { type: string; count: number; totalQuantity: number; totalCost: number }[]
  }>({
    queryKey: ['inventory-transactions', txTypeFilter, txDateFrom, txDateTo],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (txTypeFilter !== 'all') params.set('type', txTypeFilter)
      if (txDateFrom) params.set('from', txDateFrom)
      if (txDateTo) params.set('to', txDateTo)
      params.set('limit', '200')
      const res = await authFetch(`/api/inventory/transactions?${params}`)
      return res.json()
    },
    enabled: activeTab === 'history',
  })

  const filteredItems = (items || []).filter((item) =>
    item.name.toLowerCase().includes(search.toLowerCase())
  )

  const lowStockItems = (items || []).filter((item) => item.quantity <= item.minQuantity)

  // ============================================
  // MUTATIONS
  // ============================================

  const createMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await authFetch('/api/inventory', { method: 'POST', body: JSON.stringify(data) })
      if (!res.ok) throw new Error('Napaka pri ustvarjanju')
      return res.json()
    },
    onSuccess: () => { toast.success('Artikel zaloge ustvarjen'); queryClient.invalidateQueries({ queryKey: ['inventory'] }); setDialogOpen(false) },
  })

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...data }: { id: string } & Record<string, unknown>) => {
      const res = await authFetch(`/api/inventory/${id}`, { method: 'PUT', body: JSON.stringify(data) })
      if (!res.ok) throw new Error('Napaka pri posodobitvi')
      return res.json()
    },
    onSuccess: () => { toast.success('Artikel zaloge posodobljen'); queryClient.invalidateQueries({ queryKey: ['inventory'] }); setDialogOpen(false); setEditingItem(null) },
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await authFetch(`/api/inventory/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Napaka pri brisanju')
      return res.json()
    },
    onSuccess: () => { toast.success('Artikel zaloge izbrisan'); queryClient.invalidateQueries({ queryKey: ['inventory'] }) },
  })

  const restockMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await authFetch('/api/inventory/restock', { method: 'POST', body: JSON.stringify(data) })
      if (!res.ok) { const err = await res.json(); throw new Error(err.error || 'Napaka') }
      return res.json()
    },
    onSuccess: () => { toast.success('Nabava uspešno vnešena'); queryClient.invalidateQueries({ queryKey: ['inventory'] }); queryClient.invalidateQueries({ queryKey: ['inventory-transactions'] }); setRestockDialogOpen(false) },
    onError: (err) => toast.error(err.message),
  })

  const writeOffMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await authFetch('/api/inventory/adjust', { method: 'POST', body: JSON.stringify(data) })
      if (!res.ok) { const err = await res.json(); throw new Error(err.error || 'Napaka') }
      return res.json()
    },
    onSuccess: () => { toast.success('Razknjižba uspešno izvedena'); queryClient.invalidateQueries({ queryKey: ['inventory'] }); queryClient.invalidateQueries({ queryKey: ['inventory-transactions'] }); setWriteOffDialogOpen(false) },
    onError: (err) => toast.error(err.message),
  })

  // ============================================
  // HANDLERJI
  // ============================================

  const openCreate = () => {
    setEditingItem(null)
    setFormData({ name: '', description: '', image: '', unit: 'pcs', quantity: '', minQuantity: '10', costPerUnit: '', supplier: '', category: 'general', expiryDate: '', menuItemId: '', servingsPerUnit: '1', servingSize: '', costPerServing: '' })
    setDialogOpen(true)
  }

  const openEdit = (item: InventoryItemData) => {
    setEditingItem(item)
    setFormData({
      name: item.name,
      description: item.description || '',
      image: item.image || '',
      unit: item.unit,
      quantity: String(item.quantity),
      minQuantity: String(item.minQuantity),
      costPerUnit: String(item.costPerUnit),
      supplier: item.supplier || '',
      category: item.category,
      expiryDate: item.expiryDate ? new Date(item.expiryDate).toISOString().split('T')[0] : '',
      menuItemId: item.menuItemId || '',
      servingsPerUnit: String(item.servingsPerUnit || 1),
      servingSize: item.servingSize || '',
      costPerServing: String(item.costPerServing || 0),
    })
    setDialogOpen(true)
  }

  const handleSubmit = () => {
    const payload = {
      ...formData,
      quantity: parseFloat(formData.quantity) || 0,
      minQuantity: parseFloat(formData.minQuantity) || 10,
      costPerUnit: parseFloat(formData.costPerUnit) || 0,
      servingsPerUnit: parseFloat(formData.servingsPerUnit) || 1,
      costPerServing: parseFloat(formData.costPerServing) || 0,
      expiryDate: formData.expiryDate || null,
      menuItemId: formData.menuItemId || null,
    }
    if (editingItem) {
      updateMutation.mutate({ id: editingItem.id, ...payload })
    } else {
      createMutation.mutate(payload)
    }
  }

  const openRestock = (itemId: string) => {
    const item = (items || []).find((i) => i.id === itemId)
    setRestockItemId(itemId)
    setRestockData({
      quantity: '', costPerUnit: item ? String(item.costPerUnit) : '', supplierDoc: '', employeeName: '', note: '',
    })
    setRestockDialogOpen(true)
  }

  const handleRestock = () => {
    if (!restockItemId || !restockData.quantity) {
      toast.error('Izpolnite količino')
      return
    }
    restockMutation.mutate({
      inventoryItemId: restockItemId,
      quantity: parseFloat(restockData.quantity),
      costPerUnit: restockData.costPerUnit ? parseFloat(restockData.costPerUnit) : undefined,
      supplierDoc: restockData.supplierDoc,
      employeeName: restockData.employeeName,
      note: restockData.note,
    })
  }

  const openWriteOff = (itemId: string) => {
    setWriteOffItemId(itemId)
    setWriteOffData({ quantity: '', type: 'write-off', reason: '', note: '', employeeName: '' })
    setWriteOffDialogOpen(true)
  }

  const handleWriteOff = () => {
    if (!writeOffItemId || !writeOffData.quantity) {
      toast.error('Izpolnite količino')
      return
    }
    if (!writeOffData.reason) {
      toast.error('Izberite razlog')
      return
    }
    writeOffMutation.mutate({
      inventoryItemId: writeOffItemId,
      quantity: parseFloat(writeOffData.quantity),
      type: writeOffData.type,
      reason: writeOffData.reason,
      note: writeOffData.note,
      employeeName: writeOffData.employeeName,
    })
  }

  // Prikaz datumov
  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr)
    return d.toLocaleDateString('sl-SI', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  // ============================================
  // RENDER
  // ============================================

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Zaloga</h2>
          <p className="text-muted-foreground">Upravljanje zalog, nabave in razknjižbe</p>
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
              {lowStockItems.slice(0, 10).map((item) => (
                <Badge key={item.id} variant="destructive" className="text-xs cursor-pointer" onClick={() => openRestock(item.id)}>
                  {item.name}: {item.quantity} {item.unit} (min: {item.minQuantity})
                </Badge>
              ))}
              {lowStockItems.length > 10 && (
                <Badge variant="destructive" className="text-xs">+{lowStockItems.length - 10} več</Badge>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* GLAVNI ZAVIHKI */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="stock" className="gap-1.5">
            <Package className="h-3.5 w-3.5" /> Zaloge
          </TabsTrigger>
          <TabsTrigger value="procurement" className="gap-1.5">
            <Truck className="h-3.5 w-3.5" /> Nabava
          </TabsTrigger>
          <TabsTrigger value="writeoff" className="gap-1.5">
            <FileMinus className="h-3.5 w-3.5" /> Razknjižbe
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-1.5">
            <History className="h-3.5 w-3.5" /> Zgodovina
          </TabsTrigger>
        </TabsList>

        {/* ===================== TAB: ZALOGE ===================== */}
        <TabsContent value="stock" className="space-y-4 mt-4">
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
            <Badge variant="outline" className="text-xs">{filteredItems.length} artiklov</Badge>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-44" />)}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {filteredItems.map((item) => {
                const qty = item.quantity
                const minQty = item.minQuantity
                const pct = minQty > 0 ? Math.min((qty / (minQty * 2)) * 100, 100) : 100
                const isExpanded = expandedItem === item.id

                return (
                  <Card key={item.id} className="hover:shadow-md transition-shadow overflow-hidden">
                    {/* Slika artikla */}
                    {item.image && (
                      <div className="relative w-full h-32 bg-muted overflow-hidden">
                        <img
                          src={item.image}
                          alt={item.name}
                          className="w-full h-full object-cover"
                          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                        />
                        <div className="absolute top-2 right-2">
                          <Badge variant={stockLevelColor(qty, minQty)} className="text-xs shadow-sm">
                            {stockLevelText(qty, minQty)}
                          </Badge>
                        </div>
                      </div>
                    )}
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2 min-w-0">
                          {item.image ? null : <Package className="h-4 w-4 text-muted-foreground flex-shrink-0" />}
                          <div className="min-w-0">
                            <p className="font-medium text-sm truncate">{item.name}</p>
                            {item.description ? (
                              <p className="text-xs text-muted-foreground truncate">{item.description}</p>
                            ) : (
                              <p className="text-xs text-muted-foreground truncate">{item.supplier || 'Brez dobavitelja'}</p>
                            )}
                          </div>
                        </div>
                        {!item.image && (
                          <Badge variant={stockLevelColor(qty, minQty)} className="text-xs flex-shrink-0">
                            {stockLevelText(qty, minQty)}
                          </Badge>
                        )}
                        <div className="flex gap-1 flex-shrink-0">
                          <Button variant="ghost" size="icon" className="h-7 w-7" title="Nabava" onClick={() => openRestock(item.id)}>
                            <ArrowDownCircle className="h-3.5 w-3.5 text-green-600" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7" title="Razknjižba" onClick={() => openWriteOff(item.id)}>
                            <ArrowUpCircle className="h-3.5 w-3.5 text-red-600" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7" title="Uredi" onClick={() => openEdit(item)}>
                            <Pencil className="h-3 w-3" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" title="Izbriši" onClick={() => deleteMutation.mutate(item.id)}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-sm">
                        <span className="font-semibold">{qty} {item.unit}</span>
                        <span className="text-xs text-muted-foreground">{item.supplier || ''}</span>
                      </div>

                      <Progress value={pct} className="h-1.5" />

                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>Min: {minQty} {item.unit}</span>
                        <span>€{item.costPerUnit.toFixed(2)}/{item.unit}</span>
                      </div>

                      {/* Normativi info */}
                      {item.servingsPerUnit > 1 && (
                        <div className="text-xs text-muted-foreground border-t pt-2 space-y-0.5">
                          <div className="flex justify-between">
                            <span>Servisov/enoto:</span>
                            <span className="font-medium">{item.servingsPerUnit}</span>
                          </div>
                          {item.servingSize && (
                            <div className="flex justify-between">
                              <span>Velikost servisa:</span>
                              <span className="font-medium">{item.servingSize}</span>
                            </div>
                          )}
                          <div className="flex justify-between">
                            <span>Strošek/servis:</span>
                            <span className="font-medium">€{item.costPerServing.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Možnih servisov:</span>
                            <span className="font-medium">{Math.floor(qty * item.servingsPerUnit)}</span>
                          </div>
                        </div>
                      )}

                      {/* Expandable: povezani meni artikel */}
                      {item.menuItem && (
                        <button onClick={() => setExpandedItem(isExpanded ? null : item.id)} className="flex items-center gap-1 text-xs text-primary w-full">
                          {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                          Povezano: {item.menuItem.name} (€{item.menuItem.price.toFixed(2)})
                        </button>
                      )}
                      {isExpanded && item.menuItem && (
                        <div className="text-xs text-muted-foreground bg-muted/50 rounded p-2 space-y-1">
                          <div>Cena menija: €{item.menuItem.price.toFixed(2)}</div>
                          <div>Strošek servisa: €{item.costPerServing.toFixed(2)}</div>
                          <div className="font-medium text-green-600">
                            Bruto marža: €{(item.menuItem.price - item.costPerServing).toFixed(2)} ({item.costPerServing > 0 ? Math.round(((item.menuItem.price - item.costPerServing) / item.menuItem.price) * 100) : 0}%)
                          </div>
                        </div>
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
        </TabsContent>

        {/* ===================== TAB: NABAVA ===================== */}
        <TabsContent value="procurement" className="space-y-4 mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Truck className="h-5 w-5 text-green-600" />
                Vnos nabave
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Vnesite prevzem blaga v zalogo. Ob vnosu se količina samodejno prišteje k trenutni zalogi in ustvari se transakcijski zapis.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Hitri vnos nabave */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <Label className="text-sm font-semibold">Izberite artikel</Label>
                  <Select value={restockItemId} onValueChange={(v) => {
                    setRestockItemId(v)
                    const item = (items || []).find((i) => i.id === v)
                    if (item) {
                      setRestockData(prev => ({ ...prev, costPerUnit: String(item.costPerUnit) }))
                    }
                  }}>
                    <SelectTrigger>
                      <SelectValue placeholder="Izberite artikel iz zaloge..." />
                    </SelectTrigger>
                    <SelectContent className="max-h-60">
                      {(items || []).sort((a, b) => a.name.localeCompare(b.name)).map((item) => (
                        <SelectItem key={item.id} value={item.id}>
                          <span className="flex items-center gap-2">
                            <span className={`h-2 w-2 rounded-full ${item.quantity <= item.minQuantity ? 'bg-red-500' : 'bg-green-500'}`} />
                            {item.name} — {item.quantity} {item.unit}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {restockItemId && (() => {
                    const selItem = (items || []).find((i) => i.id === restockItemId)
                    if (!selItem) return null
                    return (
                      <div className="bg-muted/50 rounded-lg p-3 space-y-1 text-sm">
                        <div className="flex justify-between"><span className="text-muted-foreground">Trenutna zaloga:</span><span className="font-medium">{selItem.quantity} {selItem.unit}</span></div>
                        <div className="flex justify-between"><span className="text-muted-foreground">Enota:</span><span className="font-medium">{selItem.unit}</span></div>
                        <div className="flex justify-between"><span className="text-muted-foreground">Trenutna nabavna cena:</span><span className="font-medium">€{selItem.costPerUnit.toFixed(2)}</span></div>
                        <div className="flex justify-between"><span className="text-muted-foreground">Dobavitelj:</span><span className="font-medium">{selItem.supplier || 'Ni določen'}</span></div>
                      </div>
                    )
                  })()}
                </div>

                <div className="space-y-3">
                  <div>
                    <Label>Količina (v enotah zaloge) *</Label>
                    <Input type="number" min="0.01" step="0.01" placeholder="npr. 12" value={restockData.quantity} onChange={(e) => setRestockData({ ...restockData, quantity: e.target.value })} />
                    {restockItemId && restockData.quantity && (() => {
                      const selItem = (items || []).find((i) => i.id === restockItemId)
                      if (!selItem) return null
                      const newQty = selItem.quantity + parseFloat(restockData.quantity)
                      return <p className="text-xs text-muted-foreground mt-1">Nova zaloga: <span className="font-medium text-green-600">{newQty} {selItem.unit}</span></p>
                    })()}
                  </div>
                  <div>
                    <Label>Nabavna cena na enoto (€)</Label>
                    <Input type="number" step="0.01" placeholder="Pustite prazno za trenutno ceno" value={restockData.costPerUnit} onChange={(e) => setRestockData({ ...restockData, costPerUnit: e.target.value })} />
                  </div>
                  <div>
                    <Label>Številka dobavnice</Label>
                    <Input placeholder="npr. DN-2024-001" value={restockData.supplierDoc} onChange={(e) => setRestockData({ ...restockData, supplierDoc: e.target.value })} />
                  </div>
                  <div>
                    <Label>Prevzel</Label>
                    <Input placeholder="Ime zaposlenega" value={restockData.employeeName} onChange={(e) => setRestockData({ ...restockData, employeeName: e.target.value })} />
                  </div>
                  <div>
                    <Label>Opomba</Label>
                    <Textarea placeholder="Dodatne opombe..." value={restockData.note} onChange={(e) => setRestockData({ ...restockData, note: e.target.value })} rows={2} />
                  </div>
                  <Button className="w-full" onClick={handleRestock} disabled={!restockItemId || !restockData.quantity || restockMutation.isPending}>
                    <Truck className="h-4 w-4 mr-2" />
                    {restockMutation.isPending ? 'Vnašam...' : 'Vnesi nabavo'}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Hitri seznam za nabavo - artikli pod minimumom */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-orange-500" />
                Artikli pod minimumom ({lowStockItems.length})
              </CardTitle>
              <p className="text-sm text-muted-foreground">Kliknite na artikel za hitro vnašanje nabave</p>
            </CardHeader>
            <CardContent>
              {lowStockItems.length === 0 ? (
                <p className="text-center py-6 text-muted-foreground">Vsi artikli so nad minimalno količino</p>
              ) : (
                <div className="space-y-2">
                  {lowStockItems.map((item) => (
                    <div key={item.id} className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 cursor-pointer transition-colors" onClick={() => openRestock(item.id)}>
                      <div className="flex items-center gap-3">
                        <div className={`h-3 w-3 rounded-full ${item.quantity <= 0 ? 'bg-red-500' : item.quantity <= item.minQuantity * 0.5 ? 'bg-orange-500' : 'bg-yellow-500'}`} />
                        <div>
                          <p className="font-medium text-sm">{item.name}</p>
                          <p className="text-xs text-muted-foreground">{item.supplier || 'Brez dobavitelja'}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-sm">{item.quantity} / {item.minQuantity} {item.unit}</p>
                        <p className="text-xs text-red-500">Manjka: {Math.max(0, item.minQuantity - item.quantity)} {item.unit}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ===================== TAB: RAZKNJIŽBE ===================== */}
        <TabsContent value="writeoff" className="space-y-4 mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <FileMinus className="h-5 w-5 text-red-600" />
                Razknjižba zaloge
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Odpis zaloge za kvar, razbitje, izgubo ali popravek inventorja. Ob razknjižbi se količina samodejno odšteje od zaloge in ustvari se transakcijski zapis.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <Label className="text-sm font-semibold">Izberite artikel</Label>
                  <Select value={writeOffItemId} onValueChange={setWriteOffItemId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Izberite artikel iz zaloge..." />
                    </SelectTrigger>
                    <SelectContent className="max-h-60">
                      {(items || []).sort((a, b) => a.name.localeCompare(b.name)).map((item) => (
                        <SelectItem key={item.id} value={item.id}>
                          {item.name} — {item.quantity} {item.unit}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {writeOffItemId && (() => {
                    const selItem = (items || []).find((i) => i.id === writeOffItemId)
                    if (!selItem) return null
                    return (
                      <div className="bg-muted/50 rounded-lg p-3 space-y-1 text-sm">
                        <div className="flex justify-between"><span className="text-muted-foreground">Trenutna zaloga:</span><span className="font-medium">{selItem.quantity} {selItem.unit}</span></div>
                        <div className="flex justify-between"><span className="text-muted-foreground">Nabavna vrednost:</span><span className="font-medium">€{(selItem.quantity * selItem.costPerUnit).toFixed(2)}</span></div>
                      </div>
                    )
                  })()}
                </div>

                <div className="space-y-3">
                  <div>
                    <Label>Vrsta razknjižbe *</Label>
                    <Select value={writeOffData.type} onValueChange={(v) => setWriteOffData({ ...writeOffData, type: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="write-off">Odpis (kvar, razbitje, izguba)</SelectItem>
                        <SelectItem value="adjustment">Popravek inventorja</SelectItem>
                        <SelectItem value="return">Vrnitev dobavitelju</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Količina za odpis (v enotah) *</Label>
                    <Input type="number" min="0.01" step="0.01" placeholder="npr. 2" value={writeOffData.quantity} onChange={(e) => setWriteOffData({ ...writeOffData, quantity: e.target.value })} />
                    {writeOffItemId && writeOffData.quantity && (() => {
                      const selItem = (items || []).find((i) => i.id === writeOffItemId)
                      if (!selItem) return null
                      const newQty = Math.max(0, selItem.quantity - parseFloat(writeOffData.quantity))
                      const costLoss = parseFloat(writeOffData.quantity) * selItem.costPerUnit
                      return (
                        <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
                          <p>Nova zaloga: <span className="font-medium text-red-600">{newQty} {selItem.unit}</span></p>
                          <p>Strošek odpisa: <span className="font-medium text-red-600">€{costLoss.toFixed(2)}</span></p>
                        </div>
                      )
                    })()}
                  </div>
                  <div>
                    <Label>Razlog *</Label>
                    <Select value={writeOffData.reason} onValueChange={(v) => setWriteOffData({ ...writeOffData, reason: v })}>
                      <SelectTrigger><SelectValue placeholder="Izberite razlog..." /></SelectTrigger>
                      <SelectContent>
                        {writeOffReasons.map((r) => (
                          <SelectItem key={r} value={r}>{r}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Izvedel</Label>
                    <Input placeholder="Ime zaposlenega" value={writeOffData.employeeName} onChange={(e) => setWriteOffData({ ...writeOffData, employeeName: e.target.value })} />
                  </div>
                  <div>
                    <Label>Opomba</Label>
                    <Textarea placeholder="Dodatne opombe..." value={writeOffData.note} onChange={(e) => setWriteOffData({ ...writeOffData, note: e.target.value })} rows={2} />
                  </div>
                  <Button className="w-full" variant="destructive" onClick={handleWriteOff} disabled={!writeOffItemId || !writeOffData.quantity || !writeOffData.reason || writeOffMutation.isPending}>
                    <FileMinus className="h-4 w-4 mr-2" />
                    {writeOffMutation.isPending ? 'Izvajam...' : 'Izvedi razknjižbo'}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Hitri odpis - več artiklov hkrati */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <SlidersHorizontal className="h-5 w-5" />
                Hitri odpis iz zaloge
              </CardTitle>
              <p className="text-sm text-muted-foreground">Kliknite na gumb <ArrowUpCircle className="h-3 w-3 inline text-red-600" /> na artiklu v zavihku Zaloge za hitro razknjižbo posameznega artikla.</p>
            </CardHeader>
            <CardContent>
              <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                <p className="text-sm font-medium">Kako se razknjižuje zaloga:</p>
                <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                  <li><strong>Avtomatsko ob prodaji</strong> — ko je naročilo označeno kot zaključeno, se zaloga samodejno zmanjša glede na normative (servisi na enoto)</li>
                  <li><strong>Ročni odpis</strong> — za kvar, razbitje, izgubo ali popravek inventorja (ta obrazec zgoraj)</li>
                  <li><strong>Vrnitev dobavitelju</strong> — ko vračate blago dobavitelju</li>
                  <li><strong>Popravek inventorja</strong> — ob fizičnem štetju zaloge, ko dejansko stanje ne ustreza sistemu</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ===================== TAB: ZGODOVINA ===================== */}
        <TabsContent value="history" className="space-y-4 mt-4">
          {/* Filtri */}
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-wrap gap-3 items-center">
                <div>
                  <Label className="text-xs">Vrsta transakcije</Label>
                  <Select value={txTypeFilter} onValueChange={setTxTypeFilter}>
                    <SelectTrigger className="w-44 h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Vse vrste</SelectItem>
                      <SelectItem value="procurement">Nabava</SelectItem>
                      <SelectItem value="sale">Prodaja</SelectItem>
                      <SelectItem value="write-off">Odpis</SelectItem>
                      <SelectItem value="adjustment">Popravek</SelectItem>
                      <SelectItem value="return">Vrnitev</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Od datuma</Label>
                  <Input type="date" value={txDateFrom} onChange={(e) => setTxDateFrom(e.target.value)} className="h-9 w-40" />
                </div>
                <div>
                  <Label className="text-xs">Do datuma</Label>
                  <Input type="date" value={txDateTo} onChange={(e) => setTxDateTo(e.target.value)} className="h-9 w-40" />
                </div>
                <Button variant="outline" size="sm" className="h-9 mt-4" onClick={() => { setTxTypeFilter('all'); setTxDateFrom(''); setTxDateTo('') }}>
                  <RotateCcw className="h-3.5 w-3.5 mr-1" /> Počisti
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Povzetek */}
          {transactionsData?.summary && transactionsData.summary.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {transactionsData.summary.map((s) => (
                <Card key={s.type} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setTxTypeFilter(s.type)}>
                  <CardContent className="p-3 text-center">
                    <div className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium mb-1 ${transactionTypeColors[s.type] || 'bg-gray-100'}`}>
                      {transactionTypeLabels[s.type] || s.type}
                    </div>
                    <p className="text-lg font-bold">{s.count}</p>
                    <p className="text-xs text-muted-foreground">€{Math.abs(s.totalCost).toFixed(2)}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Tabela transakcij */}
          {txLoading ? (
            <div className="space-y-2">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-14" />)}</div>
          ) : (
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="text-left p-3 font-medium">Datum</th>
                        <th className="text-left p-3 font-medium">Artikel</th>
                        <th className="text-left p-3 font-medium">Vrsta</th>
                        <th className="text-right p-3 font-medium">Količina</th>
                        <th className="text-right p-3 font-medium">Prej</th>
                        <th className="text-right p-3 font-medium">Potem</th>
                        <th className="text-right p-3 font-medium">Vrednost</th>
                        <th className="text-left p-3 font-medium">Razlog</th>
                        <th className="text-left p-3 font-medium">Izvedel</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(transactionsData?.transactions || []).map((tx) => (
                        <tr key={tx.id} className="border-b hover:bg-muted/30 transition-colors">
                          <td className="p-3 whitespace-nowrap">{formatDate(tx.createdAt)}</td>
                          <td className="p-3">
                            <div>
                              <p className="font-medium">{tx.inventoryItem.name}</p>
                              <p className="text-xs text-muted-foreground">{tx.inventoryItem.unit}</p>
                            </div>
                          </td>
                          <td className="p-3">
                            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${transactionTypeColors[tx.type] || 'bg-gray-100'}`}>
                              {transactionTypeLabels[tx.type] || tx.type}
                            </span>
                          </td>
                          <td className={`p-3 text-right font-medium ${tx.quantity > 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {tx.quantity > 0 ? '+' : ''}{tx.quantity} {tx.inventoryItem.unit}
                          </td>
                          <td className="p-3 text-right text-muted-foreground">{tx.previousQty}</td>
                          <td className="p-3 text-right font-medium">{tx.newQty}</td>
                          <td className={`p-3 text-right ${tx.quantity > 0 ? 'text-green-600' : 'text-red-600'}`}>
                            €{Math.abs(tx.totalCost).toFixed(2)}
                          </td>
                          <td className="p-3 max-w-40 truncate">{tx.reason || '—'}</td>
                          <td className="p-3 text-muted-foreground">{tx.employeeName || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {(transactionsData?.transactions || []).length === 0 && (
                  <p className="text-center py-8 text-muted-foreground">Ni najdenih transakcij</p>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* ===================== DIALOG: UREDI ARTIKEL ===================== */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingItem ? 'Uredi artikel zaloge' : 'Dodaj artikel v zalogo'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div><Label>Ime *</Label><Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} /></div>
            <div>
              <Label>Opis</Label>
              <Textarea value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} placeholder="Opis artikla (npr. Goveji patty za burgerje, 150g)" rows={2} />
            </div>
            <div>
              <Label>Slika (URL)</Label>
              <div className="flex gap-2">
                <Input value={formData.image} onChange={(e) => setFormData({ ...formData, image: e.target.value })} placeholder="/inventory-images/artikel.png" />
                {formData.image && (
                  <div className="w-10 h-10 rounded border overflow-hidden flex-shrink-0">
                    <img src={formData.image} alt="Predogled" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
                  </div>
                )}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Enota</Label><Input value={formData.unit} onChange={(e) => setFormData({ ...formData, unit: e.target.value })} placeholder="npr. steklenica, kg, L, kos" /></div>
              <div><Label>Količina</Label><Input type="number" value={formData.quantity} onChange={(e) => setFormData({ ...formData, quantity: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Min. količina</Label><Input type="number" value={formData.minQuantity} onChange={(e) => setFormData({ ...formData, minQuantity: e.target.value })} /></div>
              <div><Label>Nabavna cena/enota (€)</Label><Input type="number" step="0.01" value={formData.costPerUnit} onChange={(e) => setFormData({ ...formData, costPerUnit: e.target.value })} /></div>
            </div>

            {/* Normativi */}
            <div className="border-t pt-3 space-y-3">
              <p className="text-sm font-semibold">Normativi (serviranje)</p>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label>Servisov/enoto</Label>
                  <Input type="number" min="1" step="1" value={formData.servingsPerUnit} onChange={(e) => {
                    const spu = parseFloat(e.target.value) || 1
                    const cpu = parseFloat(formData.costPerUnit) || 0
                    setFormData({ ...formData, servingsPerUnit: e.target.value, costPerServing: spu > 0 ? String(Math.round((cpu / spu) * 100) / 100) : '0' })
                  }} />
                </div>
                <div>
                  <Label>Velikost servisa</Label>
                  <Input value={formData.servingSize} onChange={(e) => setFormData({ ...formData, servingSize: e.target.value })} placeholder="npr. 0.10L" />
                </div>
                <div>
                  <Label>Strošek/servis (€)</Label>
                  <Input type="number" step="0.01" value={formData.costPerServing} readOnly className="bg-muted" />
                </div>
              </div>
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
            <div><Label>Povezan meni artikel</Label>
              <Select value={formData.menuItemId || 'none'} onValueChange={(v) => setFormData({ ...formData, menuItemId: v === 'none' ? '' : v })}>
                <SelectTrigger><SelectValue placeholder="Brez" /></SelectTrigger>
                <SelectContent className="max-h-48">
                  <SelectItem value="none">Brez povezave</SelectItem>
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

      {/* ===================== DIALOG: NABAVA (hitra) ===================== */}
      <Dialog open={restockDialogOpen} onOpenChange={setRestockDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowDownCircle className="h-5 w-5 text-green-600" />
              Vnos nabave
            </DialogTitle>
          </DialogHeader>
          {restockItemId && (() => {
            const selItem = (items || []).find((i) => i.id === restockItemId)
            return selItem ? (
              <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3 mb-3 space-y-1 text-sm">
                <p className="font-medium">{selItem.name}</p>
                <p className="text-muted-foreground">Trenutna zaloga: <span className="font-medium">{selItem.quantity} {selItem.unit}</span></p>
              </div>
            ) : null
          })()}
          <div className="space-y-3">
            <div>
              <Label>Količina (v enotah) *</Label>
              <Input type="number" min="0.01" step="0.01" placeholder="npr. 12" value={restockData.quantity} onChange={(e) => setRestockData({ ...restockData, quantity: e.target.value })} />
            </div>
            <div>
              <Label>Nabavna cena na enoto (€)</Label>
              <Input type="number" step="0.01" placeholder="Pustite prazno za trenutno" value={restockData.costPerUnit} onChange={(e) => setRestockData({ ...restockData, costPerUnit: e.target.value })} />
            </div>
            <div>
              <Label>Št. dobavnice</Label>
              <Input placeholder="npr. DN-2024-001" value={restockData.supplierDoc} onChange={(e) => setRestockData({ ...restockData, supplierDoc: e.target.value })} />
            </div>
            <div>
              <Label>Prevzel</Label>
              <Input placeholder="Ime zaposlenega" value={restockData.employeeName} onChange={(e) => setRestockData({ ...restockData, employeeName: e.target.value })} />
            </div>
            <div>
              <Label>Opomba</Label>
              <Textarea placeholder="Opombe..." value={restockData.note} onChange={(e) => setRestockData({ ...restockData, note: e.target.value })} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRestockDialogOpen(false)}>Prekliči</Button>
            <Button onClick={handleRestock} disabled={!restockData.quantity || restockMutation.isPending} className="bg-green-600 hover:bg-green-700">
              <Truck className="h-4 w-4 mr-2" />
              {restockMutation.isPending ? 'Vnašam...' : 'Potrdi nabavo'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===================== DIALOG: RAZKNJIŽBA (hitra) ===================== */}
      <Dialog open={writeOffDialogOpen} onOpenChange={setWriteOffDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowUpCircle className="h-5 w-5 text-red-600" />
              Razknjižba zaloge
            </DialogTitle>
          </DialogHeader>
          {writeOffItemId && (() => {
            const selItem = (items || []).find((i) => i.id === writeOffItemId)
            return selItem ? (
              <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-3 mb-3 space-y-1 text-sm">
                <p className="font-medium">{selItem.name}</p>
                <p className="text-muted-foreground">Trenutna zaloga: <span className="font-medium">{selItem.quantity} {selItem.unit}</span> (vrednost: €{(selItem.quantity * selItem.costPerUnit).toFixed(2)})</p>
              </div>
            ) : null
          })()}
          <div className="space-y-3">
            <div>
              <Label>Vrsta *</Label>
              <Select value={writeOffData.type} onValueChange={(v) => setWriteOffData({ ...writeOffData, type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="write-off">Odpis</SelectItem>
                  <SelectItem value="adjustment">Popravek inventorja</SelectItem>
                  <SelectItem value="return">Vrnitev dobavitelju</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Količina za odpis *</Label>
              <Input type="number" min="0.01" step="0.01" placeholder="npr. 2" value={writeOffData.quantity} onChange={(e) => setWriteOffData({ ...writeOffData, quantity: e.target.value })} />
            </div>
            <div>
              <Label>Razlog *</Label>
              <Select value={writeOffData.reason} onValueChange={(v) => setWriteOffData({ ...writeOffData, reason: v })}>
                <SelectTrigger><SelectValue placeholder="Izberite razlog..." /></SelectTrigger>
                <SelectContent>
                  {writeOffReasons.map((r) => (
                    <SelectItem key={r} value={r}>{r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Izvedel</Label>
              <Input placeholder="Ime zaposlenega" value={writeOffData.employeeName} onChange={(e) => setWriteOffData({ ...writeOffData, employeeName: e.target.value })} />
            </div>
            <div>
              <Label>Opomba</Label>
              <Textarea placeholder="Opombe..." value={writeOffData.note} onChange={(e) => setWriteOffData({ ...writeOffData, note: e.target.value })} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setWriteOffDialogOpen(false)}>Prekliči</Button>
            <Button onClick={handleWriteOff} disabled={!writeOffData.quantity || !writeOffData.reason || writeOffMutation.isPending} variant="destructive">
              <FileMinus className="h-4 w-4 mr-2" />
              {writeOffMutation.isPending ? 'Izvajam...' : 'Potrdi razknjižbo'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
