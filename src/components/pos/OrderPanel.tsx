'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { usePOSStore, SelectedModifier } from '@/lib/store'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { toast } from 'sonner'
import { Plus, Minus, Trash2, ShoppingBag, CreditCard, Banknote, Smartphone, X, Printer, Eye, ImageIcon, ChevronRight, Check, ArrowLeft, UtensilsCrossed, GlassWater, Users, Clock } from 'lucide-react'
import { useState, useRef, useMemo } from 'react'
import { format } from 'date-fns'

// ============================================
// TIPI
// ============================================
interface ModifierGroupType {
  id: string
  sortOrder: number
  modifierGroup: {
    id: string
    name: string
    required: boolean
    minSelect: number
    maxSelect: number | null
    modifiers: { id: string; name: string; price: number; sortOrder: number }[]
  }
}

interface MenuItemType {
  id: string
  name: string
  description: string
  price: number
  image: string
  isAvailable: boolean
  sortOrder: number
  categoryId: string
  category: { id: string; name: string; menu: { id: string; name: string } }
  modifierGroups: ModifierGroupType[]
}

interface MenuType {
  id: string
  name: string
  icon: string
  color: string
  isActive: boolean
  categories: { id: string; name: string; icon: string; color: string; menuItems: MenuItemType[] }[]
}

// ============================================
// GLAVNA KOMPONENTA
// ============================================
export function OrderPanel() {
  const {
    cart, addToCart, removeFromCart, updateCartQuantity, updateCartNotes, clearCart,
    cartTotal, orderType, setOrderType, selectedTable, setSelectedTable,
    discount, setDiscount, taxRate,
    activeMenuId, setActiveMenuId,
  } = usePOSStore()
  const queryClient = useQueryClient()
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [orderNotes, setOrderNotes] = useState('')
  const [activeCategory, setActiveCategory] = useState('all')
  const [activeSuperGroup, setActiveSuperGroup] = useState('all')
  const [mainTab, setMainTab] = useState('new-order')
  const [orderListTab, setOrderListTab] = useState('all')
  const [selectedOrder, setSelectedOrder] = useState<Record<string, unknown> | null>(null)
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false)
  const [paymentMethod, setPaymentMethod] = useState('')
  const [detailOrder, setDetailOrder] = useState<Record<string, unknown> | null>(null)
  const [receiptOrder, setReceiptOrder] = useState<Record<string, unknown> | null>(null)
  const receiptRef = useRef<HTMLDivElement>(null)

  // Modifier dialog
  const [modifierDialogItem, setModifierDialogItem] = useState<MenuItemType | null>(null)
  const [selectedModifiers, setSelectedModifiers] = useState<Map<string, SelectedModifier>>(new Map())

  // ============================================
  // PODATKI
  // ============================================
  const { data: menus, isLoading: menusLoading } = useQuery({
    queryKey: ['menus'],
    queryFn: async () => { const res = await fetch('/api/menus'); return res.json() },
  })

  const { data: menuItems, isLoading: menuLoading } = useQuery({
    queryKey: ['menu-items'],
    queryFn: async () => { const res = await fetch('/api/menu-items'); return res.json() },
  })

  const { data: tables } = useQuery({
    queryKey: ['tables'],
    queryFn: async () => { const res = await fetch('/api/tables'); return res.json() },
  })

  const { data: orders, isLoading: ordersLoading } = useQuery({
    queryKey: ['orders', orderListTab],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (orderListTab !== 'all') params.set('status', orderListTab)
      const res = await fetch(`/api/orders?${params}`)
      return res.json()
    },
  })

  // ============================================
  // MUTACIJE
  // ============================================
  const placeOrderMutation = useMutation({
    mutationFn: async () => {
      const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0)
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: orderType,
          tableId: orderType === 'dine-in' ? selectedTable : null,
          customerName,
          customerPhone,
          discount,
          taxRate,
          notes: orderNotes,
          orderItems: cart.map(item => ({
            menuItemId: item.id,
            quantity: item.quantity,
            price: item.price,
            notes: item.notes,
            modifiersJson: JSON.stringify(item.modifiers.map(m => ({ name: m.name, price: m.price, modifierGroupName: m.modifierGroupName }))),
          })),
        }),
      })
      if (!res.ok) throw new Error('Failed to place order')
      return res.json()
    },
    onSuccess: () => {
      toast.success('Naročilo uspešno oddano!')
      clearCart()
      setCustomerName('')
      setCustomerPhone('')
      setOrderNotes('')
      setDiscount(0)
      queryClient.invalidateQueries({ queryKey: ['orders'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      queryClient.invalidateQueries({ queryKey: ['tables'] })
    },
    onError: () => { toast.error('Napaka pri oddaji naročila') },
  })

  const updateOrderStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const res = await fetch(`/api/orders/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      if (!res.ok) throw new Error('Failed to update order')
      return res.json()
    },
    onSuccess: () => {
      toast.success('Status naročila posodobljen')
      queryClient.invalidateQueries({ queryKey: ['orders'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      queryClient.invalidateQueries({ queryKey: ['tables'] })
    },
  })

  const processPaymentMutation = useMutation({
    mutationFn: async ({ id, method }: { id: string; method: string }) => {
      const res = await fetch(`/api/orders/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentStatus: 'paid', paymentMethod: method }),
      })
      if (!res.ok) throw new Error('Failed to process payment')
      return res.json()
    },
    onSuccess: () => {
      toast.success('Plačilo uspešno obdelano!')
      setPaymentDialogOpen(false)
      setSelectedOrder(null)
      setPaymentMethod('')
      queryClient.invalidateQueries({ queryKey: ['orders'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })

  // ============================================
  // IZRAČUNI
  // ============================================
  const resolvedMenuId = useMemo(() => {
    if (activeMenuId) return activeMenuId
    if (menus?.length > 0) return menus[0].id
    return null
  }, [activeMenuId, menus])

  const activeMenu = menus?.find((m: MenuType) => m.id === resolvedMenuId)
  const categoriesForMenu = activeMenu?.categories || []

  // ============================================
  // SUPER-GROUPS for drinks menu (Toast POS style sub-groups)
  // ============================================
  const superGroups = useMemo(() => {
    const catNames = categoriesForMenu.map((c: { name: string }) => c.name)
    // Only define super-groups for the drinks menu (Pijača)
    if (!catNames.includes('Penine in Šampanjci')) return []

    return [
      { id: 'vina', name: 'Vina', icon: '🍷', color: '#7c2d12', categoryIds: categoriesForMenu.filter((c: { name: string }) => ['Penine in Šampanjci', 'Bela Vina', 'Rosé Vino', 'Rdeča Vina', 'Tuja Vina', 'Likersko Vino'].includes(c.name)).map((c: { id: string }) => c.id) },
      { id: 'piva', name: 'Piva', icon: '🍺', color: '#d97706', categoryIds: categoriesForMenu.filter((c: { name: string }) => ['Točeno Pivo', 'Pivo', 'Craft Piva', 'Brezalkoholno Pivo'].includes(c.name)).map((c: { id: string }) => c.id) },
      { id: 'zganepijace', name: 'Žgane pijače', icon: '🥃', color: '#6b21a8', categoryIds: categoriesForMenu.filter((c: { name: string }) => ['Viski', 'Gin', 'Likerji', 'Grenčice', 'Destilati, Konjak in Rum'].includes(c.name)).map((c: { id: string }) => c.id) },
      { id: 'napitki', name: 'Napitki', icon: '☕', color: '#92400e', categoryIds: categoriesForMenu.filter((c: { name: string }) => ['Topli Napitki', 'Mešane Pijače'].includes(c.name)).map((c: { id: string }) => c.id) },
      { id: 'brezalkoholne', name: 'Brezalkoholne', icon: '🥤', color: '#0ea5e9', categoryIds: categoriesForMenu.filter((c: { name: string }) => ['Vode', 'Naravni Sokovi', 'Sokovi', 'Gazirane Pijače'].includes(c.name)).map((c: { id: string }) => c.id) },
    ]
  }, [categoriesForMenu])

  const filteredMenuItems = useMemo(() => {
    return menuItems?.filter(
      (item: MenuItemType) => {
        const matchesMenu = !resolvedMenuId || item.category?.menu?.id === resolvedMenuId
        const matchesCategory = activeCategory === 'all' || item.categoryId === activeCategory
        // Also filter by super-group if one is active
        const matchesSuperGroup = activeSuperGroup === 'all' || 
          superGroups.some(sg => sg.id === activeSuperGroup && sg.categoryIds.includes(item.categoryId))
        return matchesMenu && matchesCategory && matchesSuperGroup && item.isAvailable
      }
    ) || []
  }, [menuItems, resolvedMenuId, activeCategory, activeSuperGroup, superGroups])

  const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0)
  const tax = subtotal * taxRate
  const total = subtotal + tax - discount
  const cartItemCount = cart.reduce((s, i) => s + i.quantity, 0)

  // ============================================
  // STATUSNE MAPE
  // ============================================
  const statusColors: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
    'in-progress': 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
    ready: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
    completed: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400',
    cancelled: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  }
  const nextStatus: Record<string, string> = { pending: 'in-progress', 'in-progress': 'ready', ready: 'completed' }
  const statusLabels: Record<string, string> = { pending: 'Čakajoče', 'in-progress': 'V obdelavi', ready: 'Pripravljeno', completed: 'Zaključeno', cancelled: 'Preklicano' }

  // ============================================
  // HANDLERJI
  // ============================================
  const handleItemClick = (item: MenuItemType) => {
    if (item.modifierGroups?.length > 0) {
      setModifierDialogItem(item)
      setSelectedModifiers(new Map())
    } else {
      addToCart({ id: item.id, name: item.name, price: item.price, categoryId: item.categoryId, image: item.image })
    }
  }

  const handleModifierToggle = (group: ModifierGroupType['modifierGroup'], modifier: { id: string; name: string; price: number }) => {
    setSelectedModifiers(prev => {
      const newMap = new Map(prev)
      const key = modifier.id
      if (group.maxSelect && !newMap.has(key)) {
        const currentCount = Array.from(newMap.values()).filter(m => m.modifierGroupId === group.id).length
        if (currentCount >= group.maxSelect) {
          const toRemove = Array.from(newMap.entries()).find(([_, v]) => v.modifierGroupId === group.id)
          if (toRemove) newMap.delete(toRemove[0])
        }
      }
      if (newMap.has(key)) { newMap.delete(key) }
      else {
        newMap.set(key, { id: modifier.id, name: modifier.name, price: modifier.price, modifierGroupId: group.id, modifierGroupName: group.name })
      }
      return newMap
    })
  }

  const handleModifierConfirm = () => {
    if (!modifierDialogItem) return
    const modifiers = Array.from(selectedModifiers.values())
    addToCart({ id: modifierDialogItem.id, name: modifierDialogItem.name, price: modifierDialogItem.price, categoryId: modifierDialogItem.categoryId, image: modifierDialogItem.image, modifiers })
    setModifierDialogItem(null)
    setSelectedModifiers(new Map())
  }

  const modifierExtraPrice = modifierDialogItem ? Array.from(selectedModifiers.values()).reduce((s, m) => s + m.price, 0) : 0

  // ============================================
  // RENDER
  // ============================================
  return (
    <div className="h-full flex flex-col">
      {/* TOP TAB BAR - Naročila / Seznam naročil */}
      <div className="flex items-center border-b border-border bg-card px-4 h-11 flex-shrink-0">
        <Tabs value={mainTab} onValueChange={setMainTab} className="w-full">
          <TabsList className="h-8 bg-transparent p-0 gap-4">
            <TabsTrigger value="new-order" className="h-8 px-0 text-sm font-semibold data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-primary border-b-2 border-transparent data-[state=active]:border-primary rounded-none">
              <ShoppingBag className="h-3.5 w-3.5 mr-1.5" />
              Novo naročilo
            </TabsTrigger>
            <TabsTrigger value="order-list" className="h-8 px-0 text-sm font-semibold data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-primary border-b-2 border-transparent data-[state=active]:border-primary rounded-none">
              <Clock className="h-3.5 w-3.5 mr-1.5" />
              Seznam naročil
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* MAIN CONTENT */}
      <div className="flex-1 overflow-hidden">
        {mainTab === 'new-order' ? (
          /* ============================================
             NOVO NAROČILO - Toast POS Layout
             ============================================ */
          <div className="h-full flex">
            {/* LEFT: Menu Area (65%) */}
            <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
              {/* Order Type + Table Bar */}
              <div className="flex items-center gap-2 px-4 py-2 border-b border-border bg-muted/30 flex-shrink-0">
                <Select value={orderType} onValueChange={setOrderType}>
                  <SelectTrigger className="w-32 h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="dine-in">🍽️ Na mestu</SelectItem>
                    <SelectItem value="takeaway">📦 Za s seboj</SelectItem>
                    <SelectItem value="delivery">🚚 Dostava</SelectItem>
                  </SelectContent>
                </Select>
                {orderType === 'dine-in' && (
                  <Select value={selectedTable || ''} onValueChange={setSelectedTable}>
                    <SelectTrigger className="w-36 h-8 text-xs">
                      <SelectValue placeholder="Izberi mizo" />
                    </SelectTrigger>
                    <SelectContent>
                      {tables?.filter((t: { status: string }) => t.status === 'available' || t.status === 'occupied').map((table: { id: string; number: number; capacity: number }) => (
                        <SelectItem key={table.id} value={table.id}>
                          Miza {table.number} ({table.capacity} mest)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                {selectedTable && orderType === 'dine-in' && (
                  <Badge variant="outline" className="text-xs h-6">
                    <Users className="h-3 w-3 mr-1" />
                    Miza {tables?.find((t: { id: string }) => t.id === selectedTable)?.number}
                  </Badge>
                )}
              </div>

              {/* MENU TABS - Toast Style (Food / Drinks) */}
              <div className="flex gap-1.5 px-4 py-2.5 border-b border-border flex-shrink-0">
                {menus?.map((menu: MenuType, idx: number) => {
                  const isActive = resolvedMenuId === menu.id || (!resolvedMenuId && idx === 0)
                  return (
                    <button
                      key={menu.id}
                      onClick={() => { setActiveMenuId(menu.id); setActiveCategory('all'); setActiveSuperGroup('all') }}
                      className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg text-base font-bold transition-all duration-150 ${
                        isActive
                          ? 'text-white shadow-md scale-[1.02]'
                          : 'bg-muted text-muted-foreground hover:bg-accent'
                      }`}
                      style={isActive ? { backgroundColor: menu.color } : {}}
                    >
                      <span className="text-lg">{menu.icon}</span>
                      {menu.name}
                    </button>
                  )
                })}
              </div>

              {/* CATEGORY NAVIGATION - Smart layout for large category counts */}
              {categoriesForMenu.length > 10 ? (
                /* GROUPED CATEGORIES for drinks menu (21 categories) */
                <div className="border-b border-border flex-shrink-0">
                  {/* Super-group tabs */}
                  <div className="flex gap-1 px-4 py-1.5 overflow-x-auto custom-scrollbar">
                    <button
                      onClick={() => { setActiveCategory('all'); setActiveSuperGroup('all') }}
                      className={`flex-shrink-0 px-3 py-1 rounded-md text-[11px] font-bold transition-colors ${
                        activeCategory === 'all' && activeSuperGroup === 'all'
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted text-muted-foreground hover:bg-accent'
                      }`}
                    >
                      Vse
                    </button>
                    {superGroups.map((sg) => (
                      <button
                        key={sg.id}
                        onClick={() => { setActiveSuperGroup(sg.id); setActiveCategory('all') }}
                        className={`flex-shrink-0 px-3 py-1 rounded-md text-[11px] font-bold transition-colors ${
                          activeSuperGroup === sg.id
                            ? 'text-white'
                            : 'bg-muted text-muted-foreground hover:bg-accent'
                        }`}
                        style={activeSuperGroup === sg.id ? { backgroundColor: sg.color } : {}}
                      >
                        {sg.icon} {sg.name}
                      </button>
                    ))}
                  </div>
                  {/* Sub-categories within active super-group */}
                  {activeSuperGroup !== 'all' && (
                    <div className="flex gap-1 px-4 py-1.5 overflow-x-auto custom-scrollbar">
                      {categoriesForMenu
                        .filter((cat: { id: string; name: string; icon: string; color: string }) => {
                          const sg = superGroups.find(s => s.categoryIds.includes(cat.id))
                          return sg?.id === activeSuperGroup
                        })
                        .map((cat: { id: string; name: string; icon: string; color: string }) => (
                          <button
                            key={cat.id}
                            onClick={() => setActiveCategory(cat.id)}
                            className={`flex-shrink-0 px-2.5 py-1 rounded-full text-[10px] font-semibold transition-colors ${
                              activeCategory === cat.id
                                ? 'text-white'
                                : 'bg-muted/60 text-muted-foreground hover:bg-accent'
                            }`}
                            style={activeCategory === cat.id ? { backgroundColor: cat.color || '#6b7280' } : {}}
                          >
                            {cat.icon} {cat.name}
                          </button>
                        ))}
                    </div>
                  )}
                </div>
              ) : (
                /* SIMPLE PILLS for food menu (8 categories) */
                <div className="flex gap-1.5 px-4 py-2 border-b border-border overflow-x-auto flex-shrink-0 custom-scrollbar">
                  <button
                    onClick={() => setActiveCategory('all')}
                    className={`flex-shrink-0 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                      activeCategory === 'all'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground hover:bg-accent'
                    }`}
                  >
                    Vse
                  </button>
                  {categoriesForMenu.map((cat: { id: string; name: string; icon: string; color: string }) => (
                    <button
                      key={cat.id}
                      onClick={() => setActiveCategory(cat.id)}
                      className={`flex-shrink-0 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                        activeCategory === cat.id
                          ? 'text-white'
                          : 'bg-muted text-muted-foreground hover:bg-accent'
                      }`}
                      style={activeCategory === cat.id ? { backgroundColor: cat.color || '#6b7280' } : {}}
                    >
                      {cat.icon} {cat.name}
                    </button>
                  ))}
                </div>
              )}

              {/* ITEMS GRID - Toast Style Large Buttons */}
              <div className="flex-1 overflow-y-auto p-3 custom-scrollbar">
                {menuLoading || menusLoading ? (
                  <div className="grid grid-cols-3 lg:grid-cols-4 gap-2.5">
                    {[...Array(8)].map((_, i) => <Skeleton key={i} className="h-32 rounded-lg" />)}
                  </div>
                ) : filteredMenuItems.length === 0 ? (
                  <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                    Ni artiklov v tej kategoriji
                  </div>
                ) : (
                  <div className="grid grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2.5">
                    {filteredMenuItems.map((item: MenuItemType) => {
                      const inCart = cart.filter(c => c.id === item.id)
                      const totalQty = inCart.reduce((sum, c) => sum + c.quantity, 0)
                      const hasMods = item.modifierGroups?.length > 0
                      return (
                        <button
                          key={item.id}
                          onClick={() => handleItemClick(item)}
                          className="relative flex flex-col rounded-xl border border-border bg-card hover:bg-accent/50 active:scale-[0.97] transition-all text-left overflow-hidden group"
                        >
                          {/* Quantity badge */}
                          {totalQty > 0 && (
                            <div className="absolute top-1.5 right-1.5 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold shadow-sm">
                              {totalQty}
                            </div>
                          )}
                          {/* Modifier indicator */}
                          {hasMods && (
                            <div className="absolute top-1.5 left-1.5 z-10">
                              <span className="flex items-center gap-0.5 rounded-full bg-secondary/80 text-secondary-foreground text-[9px] font-medium px-1.5 py-0.5">
                                <ChevronRight className="h-2.5 w-2.5" />
                                Izbira
                              </span>
                            </div>
                          )}
                          {/* Image */}
                          <div className="w-full aspect-square bg-muted/40 relative overflow-hidden">
                            {item.image ? (
                              <img
                                src={item.image}
                                alt={item.name}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                                onError={(e) => {
                                  const target = e.target as HTMLImageElement
                                  target.style.display = 'none'
                                  target.nextElementSibling?.classList.remove('hidden')
                                }}
                              />
                            ) : null}
                            <div className={`absolute inset-0 flex items-center justify-center ${item.image ? 'hidden' : ''}`}>
                              <ImageIcon className="h-8 w-8 text-muted-foreground/30" />
                            </div>
                          </div>
                          {/* Info */}
                          <div className="p-2 flex-1 flex flex-col justify-between">
                            <p className="font-semibold text-xs leading-tight line-clamp-2">{item.name}</p>
                            <p className="text-primary font-bold text-sm mt-1">€{item.price.toFixed(2)}</p>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* RIGHT: Cart Panel (35%) */}
            <div className="w-[340px] xl:w-[380px] border-l border-border bg-card flex flex-col flex-shrink-0">
              {/* Cart Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-border flex-shrink-0">
                <div className="flex items-center gap-2">
                  <ShoppingBag className="h-4 w-4 text-primary" />
                  <span className="font-bold text-sm">Naročilo</span>
                  {cartItemCount > 0 && (
                    <Badge variant="secondary" className="text-[10px] h-5 px-1.5">{cartItemCount}</Badge>
                  )}
                </div>
                {cart.length > 0 && (
                  <Button variant="ghost" size="sm" onClick={clearCart} className="h-7 text-xs text-destructive hover:text-destructive">
                    <Trash2 className="h-3 w-3 mr-1" />
                    Zbriši
                  </Button>
                )}
              </div>

              {/* Cart Items */}
              <div className="flex-1 overflow-y-auto custom-scrollbar">
                {cart.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2">
                    <ShoppingBag className="h-10 w-10 opacity-20" />
                    <p className="text-sm">Košarica je prazna</p>
                    <p className="text-xs">Izberi artikle iz menija</p>
                  </div>
                ) : (
                  <div className="p-2 space-y-1">
                    {cart.map((item) => (
                      <div key={item.cartKey} className="flex items-start gap-2 p-2 rounded-lg bg-muted/40 hover:bg-muted/60 transition-colors">
                        {/* Thumbnail */}
                        {item.image ? (
                          <div className="w-10 h-10 rounded-md overflow-hidden flex-shrink-0">
                            <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                          </div>
                        ) : (
                          <div className="w-10 h-10 rounded-md bg-muted flex-shrink-0 flex items-center justify-center">
                            <ImageIcon className="h-4 w-4 text-muted-foreground/40" />
                          </div>
                        )}
                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold truncate">{item.name}</p>
                          <p className="text-[10px] text-muted-foreground">€{item.price.toFixed(2)} na kos</p>
                          {item.modifiers.length > 0 && (
                            <div className="flex flex-wrap gap-0.5 mt-0.5">
                              {item.modifiers.map(m => (
                                <Badge key={m.id} variant="outline" className="text-[8px] h-3.5 px-1 py-0">
                                  {m.name}{m.price > 0 ? ` +€${m.price.toFixed(2)}` : ''}
                                </Badge>
                              ))}
                            </div>
                          )}
                          {item.notes && <p className="text-[9px] text-primary italic mt-0.5">📝 {item.notes}</p>}
                        </div>
                        {/* Controls */}
                        <div className="flex flex-col items-end gap-1 flex-shrink-0">
                          <Button variant="ghost" size="icon" className="h-5 w-5 text-destructive" onClick={() => removeFromCart(item.cartKey)}>
                            <X className="h-2.5 w-2.5" />
                          </Button>
                          <div className="flex items-center gap-0.5">
                            <Button variant="outline" size="icon" className="h-6 w-6" onClick={() => updateCartQuantity(item.cartKey, item.quantity - 1)}>
                              <Minus className="h-2.5 w-2.5" />
                            </Button>
                            <span className="text-xs font-bold w-5 text-center">{item.quantity}</span>
                            <Button variant="outline" size="icon" className="h-6 w-6" onClick={() => updateCartQuantity(item.cartKey, item.quantity + 1)}>
                              <Plus className="h-2.5 w-2.5" />
                            </Button>
                          </div>
                          <p className="text-xs font-bold">€{(item.price * item.quantity).toFixed(2)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Bottom Section */}
              <div className="border-t border-border flex-shrink-0">
                {/* Customer Info - Collapsed */}
                <div className="px-3 py-2 space-y-1.5 border-b border-border">
                  <Input placeholder="Ime stranke" value={customerName} onChange={e => setCustomerName(e.target.value)} className="h-7 text-xs" />
                  <div className="flex gap-1.5">
                    <Input placeholder="Telefon" value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} className="h-7 text-xs flex-1" />
                    <Input placeholder="Popust €" type="number" min="0" step="0.01" value={discount || ''} onChange={e => setDiscount(parseFloat(e.target.value) || 0)} className="h-7 text-xs w-20" />
                  </div>
                  <Input placeholder="Opombe" value={orderNotes} onChange={e => setOrderNotes(e.target.value)} className="h-7 text-xs" />
                </div>

                {/* Totals */}
                <div className="px-3 py-2 space-y-0.5 text-xs">
                  <div className="flex justify-between text-muted-foreground">
                    <span>Vmesna vsota</span>
                    <span>€{subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Davek (10%)</span>
                    <span>€{tax.toFixed(2)}</span>
                  </div>
                  {discount > 0 && (
                    <div className="flex justify-between text-emerald-600">
                      <span>Popust</span>
                      <span>-€{discount.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold text-base pt-1">
                    <span>Skupaj</span>
                    <span>€{Math.max(0, total).toFixed(2)}</span>
                  </div>
                </div>

                {/* Submit Button */}
                <div className="px-3 pb-3">
                  <Button
                    className="w-full h-11 text-base font-bold"
                    disabled={cart.length === 0 || placeOrderMutation.isPending}
                    onClick={() => placeOrderMutation.mutate()}
                  >
                    {placeOrderMutation.isPending ? 'Naročam...' : 'Oddaj naročilo'}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* ============================================
             SEZNAM NAROČIL
             ============================================ */
          <div className="h-full overflow-y-auto p-4 custom-scrollbar">
            <div className="space-y-4">
              <Tabs value={orderListTab} onValueChange={setOrderListTab}>
                <TabsList>
                  <TabsTrigger value="all">Vse</TabsTrigger>
                  <TabsTrigger value="pending">Čakajoče</TabsTrigger>
                  <TabsTrigger value="in-progress">V obdelavi</TabsTrigger>
                  <TabsTrigger value="ready">Pripravljeno</TabsTrigger>
                  <TabsTrigger value="completed">Zaključeno</TabsTrigger>
                </TabsList>
              </Tabs>

              {ordersLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-40" />)}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {(orders || []).map((order: {
                    id: string; orderNumber: number; type: string; status: string; total: number;
                    customerName: string; paymentStatus: string; paymentMethod: string; createdAt: string;
                    table?: { number: number };
                    orderItems: { id: string; menuItem: { name: string }; quantity: number; price: number }[]
                  }) => (
                    <Card key={order.id} className="hover:shadow-md transition-shadow">
                      <CardContent className="p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-semibold">#{order.orderNumber}</p>
                            <p className="text-xs text-muted-foreground">{format(new Date(order.createdAt), 'MMM dd, HH:mm')}</p>
                          </div>
                          <div className="flex gap-1">
                            <Badge variant="outline" className={statusColors[order.status]}>{statusLabels[order.status] || order.status}</Badge>
                            {order.paymentStatus === 'paid' && (
                              <Badge variant="outline" className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400">Plačano</Badge>
                            )}
                          </div>
                        </div>
                        <div className="text-sm">
                          <p>{order.customerName || 'Hodič'} · {order.type === 'dine-in' ? 'Na mestu' : order.type === 'takeaway' ? 'Za s seboj' : 'Dostava'}</p>
                          {order.table && <p className="text-muted-foreground">Miza {order.table.number}</p>}
                        </div>
                        <div className="space-y-1">
                          {order.orderItems.slice(0, 3).map(oi => (
                            <div key={oi.id} className="flex justify-between text-sm">
                              <span>{oi.quantity}x {oi.menuItem.name}</span>
                              <span>€{(oi.price * oi.quantity).toFixed(2)}</span>
                            </div>
                          ))}
                          {order.orderItems.length > 3 && <p className="text-xs text-muted-foreground">+{order.orderItems.length - 3} artiklov več</p>}
                        </div>
                        <Separator />
                        <div className="flex items-center justify-between">
                          <span className="font-bold">€{order.total.toFixed(2)}</span>
                          <div className="flex gap-1 flex-wrap justify-end">
                            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setDetailOrder(order)}>
                              <Eye className="h-3 w-3 mr-1" />Poglej
                            </Button>
                            {order.status !== 'completed' && order.status !== 'cancelled' && nextStatus[order.status] && (
                              <Button size="sm" variant="default" className="h-7 text-xs" onClick={() => updateOrderStatusMutation.mutate({ id: order.id, status: nextStatus[order.status] })} disabled={updateOrderStatusMutation.isPending}>
                                → {statusLabels[nextStatus[order.status]]}
                              </Button>
                            )}
                            {order.paymentStatus !== 'paid' && order.status !== 'cancelled' && (
                              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => { setSelectedOrder(order); setPaymentDialogOpen(true) }}>
                                <CreditCard className="h-3 w-3 mr-1" />Plačaj
                              </Button>
                            )}
                            {order.paymentStatus === 'paid' && (
                              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setReceiptOrder(order)}>
                                <Printer className="h-3 w-3 mr-1" />Račun
                              </Button>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                  {(!orders || orders.length === 0) && (
                    <div className="col-span-full text-center py-12 text-muted-foreground">Ni najdenih naročil</div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ============================================
           MODIFIER DIALOG
           ============================================ */}
      <Dialog open={!!modifierDialogItem} onOpenChange={(open) => { if (!open) { setModifierDialogItem(null); setSelectedModifiers(new Map()) } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              {modifierDialogItem?.image && (
                <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0">
                  <img src={modifierDialogItem.image} alt={modifierDialogItem.name} className="w-full h-full object-cover" />
                </div>
              )}
              <div>
                <p>{modifierDialogItem?.name}</p>
                <p className="text-sm font-normal text-muted-foreground">€{(modifierDialogItem?.price || 0).toFixed(2)}</p>
              </div>
            </DialogTitle>
          </DialogHeader>

          <ScrollArea className="max-h-[50vh]">
            <div className="space-y-4 pr-3">
              {modifierDialogItem?.modifierGroups.map((mg: ModifierGroupType) => (
                <div key={mg.id} className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold">{mg.modifierGroup.name}</span>
                    {mg.modifierGroup.required && <Badge variant="destructive" className="text-[9px] h-4 px-1">Obvezno</Badge>}
                    {mg.modifierGroup.maxSelect && <span className="text-[10px] text-muted-foreground">(max {mg.modifierGroup.maxSelect})</span>}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {mg.modifierGroup.modifiers.map(mod => {
                      const isSelected = selectedModifiers.has(mod.id)
                      return (
                        <button
                          key={mod.id}
                          onClick={() => handleModifierToggle(mg.modifierGroup, mod)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
                            isSelected
                              ? 'bg-primary text-primary-foreground border-primary'
                              : 'bg-card text-card-foreground border-border hover:bg-accent'
                          }`}
                        >
                          {mod.name}{mod.price > 0 ? ` +€${mod.price.toFixed(2)}` : ''}
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setModifierDialogItem(null); setSelectedModifiers(new Map()) }}>Prekliči</Button>
            <Button onClick={handleModifierConfirm}>
              <Check className="h-4 w-4 mr-1" />
              Potrdi €{((modifierDialogItem?.price || 0) + modifierExtraPrice).toFixed(2)}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ============================================
           PAYMENT DIALOG
           ============================================ */}
      <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Obdelava plačila</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-2xl font-bold text-center">€{((selectedOrder?.total as number) || 0).toFixed(2)}</p>
            <div className="grid grid-cols-3 gap-3">
              <Button variant={paymentMethod === 'cash' ? 'default' : 'outline'} className="flex flex-col gap-1 h-auto py-3" onClick={() => setPaymentMethod('cash')}>
                <Banknote className="h-5 w-5" /><span className="text-xs">Gotovina</span>
              </Button>
              <Button variant={paymentMethod === 'card' ? 'default' : 'outline'} className="flex flex-col gap-1 h-auto py-3" onClick={() => setPaymentMethod('card')}>
                <CreditCard className="h-5 w-5" /><span className="text-xs">Kartica</span>
              </Button>
              <Button variant={paymentMethod === 'valuto' ? 'default' : 'outline'} className="flex flex-col gap-1 h-auto py-3" onClick={() => setPaymentMethod('valuto')}>
                <Smartphone className="h-5 w-5" /><span className="text-xs">Valuto</span>
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPaymentDialogOpen(false)}>Prekliči</Button>
            <Button disabled={!paymentMethod || processPaymentMutation.isPending} onClick={() => { if (selectedOrder?.id && paymentMethod) processPaymentMutation.mutate({ id: selectedOrder.id as string, method: paymentMethod }) }}>
              Potrdi plačilo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ============================================
           ORDER DETAIL DIALOG
           ============================================ */}
      <Dialog open={!!detailOrder} onOpenChange={(open) => !open && setDetailOrder(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              Naročilo #{(detailOrder?.orderNumber as number) || ''}
              <Badge variant="outline" className={statusColors[(detailOrder?.status as string) || ''] || ''}>
                {statusLabels[(detailOrder?.status as string)] || String(detailOrder?.status || '')}
              </Badge>
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><p className="text-muted-foreground">Stranka</p><p className="font-medium">{String(detailOrder?.customerName || 'Hodič')}</p></div>
              <div><p className="text-muted-foreground">Vrsta</p><p className="font-medium">{detailOrder?.type === 'dine-in' ? 'Na mestu' : detailOrder?.type === 'takeaway' ? 'Za s seboj' : 'Dostava'}</p></div>
              <div><p className="text-muted-foreground">Miza</p><p className="font-medium">{detailOrder?.table ? `Miza ${(detailOrder.table as { number: number }).number}` : 'Brez'}</p></div>
              <div>
                <p className="text-muted-foreground">Plačilo</p>
                <div className="flex items-center gap-1">
                  <Badge variant="outline" className={detailOrder?.paymentStatus === 'paid' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-yellow-100 text-yellow-800'}>
                    {detailOrder?.paymentStatus === 'paid' ? 'Plačano' : 'Neplačano'}
                  </Badge>
                  {detailOrder?.paymentMethod && <span className="text-xs text-muted-foreground uppercase">{String(detailOrder.paymentMethod)}</span>}
                </div>
              </div>
              <div><p className="text-muted-foreground">Čas</p><p className="font-medium">{detailOrder?.createdAt ? format(new Date(detailOrder.createdAt as string), 'MMM dd, yyyy HH:mm') : 'Brez'}</p></div>
            </div>
            <Separator />
            <div className="space-y-2">
              <p className="text-sm font-semibold">Artikli</p>
              {((detailOrder?.orderItems as { id: string; menuItem: { name: string; image: string }; quantity: number; price: number; notes: string; status: string; modifiersJson?: string }[]) || []).map(oi => (
                <div key={oi.id} className="flex items-start justify-between text-sm py-1 gap-2">
                  <div className="flex items-start gap-2 flex-1">
                    {oi.menuItem.image ? (
                      <div className="w-9 h-9 rounded-md overflow-hidden flex-shrink-0">
                        <img src={oi.menuItem.image} alt={oi.menuItem.name} className="w-full h-full object-cover" />
                      </div>
                    ) : (
                      <div className="w-9 h-9 rounded-md bg-muted flex-shrink-0 flex items-center justify-center">
                        <ImageIcon className="h-3.5 w-3.5 text-muted-foreground/50" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{oi.quantity}x {oi.menuItem.name}</span>
                        <Badge variant="outline" className="text-[10px] h-4 capitalize">{oi.status}</Badge>
                      </div>
                      {oi.modifiersJson && (() => {
                        try {
                          const mods = JSON.parse(oi.modifiersJson)
                          if (mods.length > 0) return (
                            <div className="flex flex-wrap gap-0.5 mt-0.5">
                              {mods.map((m: { name: string; price: number }, mi: number) => (
                                <Badge key={mi} variant="outline" className="text-[9px] h-3.5 px-1 py-0">{m.name}{m.price > 0 ? ` +€${m.price.toFixed(2)}` : ''}</Badge>
                              ))}
                            </div>
                          )
                        } catch {}
                        return null
                      })()}
                      {oi.notes && <p className="text-xs text-muted-foreground italic mt-0.5">{oi.notes}</p>}
                    </div>
                  </div>
                  <span className="font-medium flex-shrink-0">€{(oi.price * oi.quantity).toFixed(2)}</span>
                </div>
              ))}
            </div>
            <Separator />
            <div className="space-y-1 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Vmesna vsota</span><span>€{((detailOrder?.subtotal as number) || 0).toFixed(2)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Davek</span><span>€{((detailOrder?.tax as number) || 0).toFixed(2)}</span></div>
              {Number(detailOrder?.discount || 0) > 0 && <div className="flex justify-between text-emerald-600"><span>Popust</span><span>-€{((detailOrder?.discount as number) || 0).toFixed(2)}</span></div>}
              <div className="flex justify-between font-bold"><span>Skupaj</span><span>€{((detailOrder?.total as number) || 0).toFixed(2)}</span></div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ============================================
           RECEIPT DIALOG
           ============================================ */}
      <Dialog open={!!receiptOrder} onOpenChange={(open) => !open && setReceiptOrder(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Račun #{(receiptOrder?.orderNumber as number) || ''}</DialogTitle>
          </DialogHeader>
          <div ref={receiptRef} className="font-mono text-xs space-y-2 p-4 bg-white text-black rounded">
            <div className="text-center">
              <p className="font-bold">RestaurantOS</p>
              <p>Restavracija</p>
              <p className="text-[10px] text-gray-500">{receiptOrder?.createdAt ? format(new Date(receiptOrder.createdAt as string), 'dd.MM.yyyy HH:mm') : ''}</p>
            </div>
            <Separator />
            {((receiptOrder?.orderItems as { quantity: number; menuItem: { name: string }; price: number }[]) || []).map((oi, i) => (
              <div key={i} className="flex justify-between">
                <span>{oi.quantity}x {oi.menuItem.name}</span>
                <span>€{(oi.price * oi.quantity).toFixed(2)}</span>
              </div>
            ))}
            <Separator />
            <div className="flex justify-between"><span>Vmesna vsota</span><span>€{((receiptOrder?.subtotal as number) || 0).toFixed(2)}</span></div>
            <div className="flex justify-between"><span>Davek</span><span>€{((receiptOrder?.tax as number) || 0).toFixed(2)}</span></div>
            {Number(receiptOrder?.discount || 0) > 0 && <div className="flex justify-between"><span>Popust</span><span>-€{((receiptOrder?.discount as number) || 0).toFixed(2)}</span></div>}
            <div className="flex justify-between font-bold text-sm"><span>SKUPAJ</span><span>€{((receiptOrder?.total as number) || 0).toFixed(2)}</span></div>
            <div className="text-center text-[10px] text-gray-400 pt-2">Hvala za obisk!</div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReceiptOrder(null)}>Zapri</Button>
            <Button onClick={() => { if (receiptRef.current) { const w = window.open('', '', 'width=400,height=600'); if (w) { w.document.write(receiptRef.current.innerHTML); w.document.close(); w.print() } } }}>
              <Printer className="h-4 w-4 mr-1" />Natisni
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
