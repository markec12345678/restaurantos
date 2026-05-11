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
import { Plus, Minus, Trash2, ShoppingBag, CreditCard, X, Printer, Eye, ChevronRight, Check, ArrowLeft, UtensilsCrossed, GlassWater, Users, Clock, Search, XCircle, FileWarning, Keyboard } from 'lucide-react'

// ============================================
// FALLBACK ZA JEDI BREZ SLIKE + BARVNI AKCENTI (Square/Toast POS stil)
// Profesionalni POS sistemi uporabljajo barvno kodiranje po kategorijah
// za hitro vizualno prepoznavo artiklov brez iskanja po imenu.
// ============================================
const categoryEmojiMap: Record<string, { emoji: string; bg: string; text: string; accent: string }> = {
  'Predjedi': { emoji: '🥗', bg: 'bg-emerald-100 dark:bg-emerald-900/40', text: 'text-emerald-700 dark:text-emerald-300', accent: '#10b981' },
  'Juhe': { emoji: '🍲', bg: 'bg-amber-100 dark:bg-amber-900/40', text: 'text-amber-700 dark:text-amber-300', accent: '#f59e0b' },
  'Glavne jedi': { emoji: '🍽️', bg: 'bg-orange-100 dark:bg-orange-900/40', text: 'text-orange-700 dark:text-orange-300', accent: '#f97316' },
  'Testenine': { emoji: '🍝', bg: 'bg-yellow-100 dark:bg-yellow-900/40', text: 'text-yellow-700 dark:text-yellow-300', accent: '#eab308' },
  'Pica': { emoji: '🍕', bg: 'bg-red-100 dark:bg-red-900/40', text: 'text-red-700 dark:text-red-300', accent: '#ef4444' },
  'Burgerji': { emoji: '🍔', bg: 'bg-orange-100 dark:bg-orange-900/40', text: 'text-orange-700 dark:text-orange-300', accent: '#f97316' },
  'Sladice': { emoji: '🍰', bg: 'bg-pink-100 dark:bg-pink-900/40', text: 'text-pink-700 dark:text-pink-300', accent: '#ec4899' },
  'Priloge': { emoji: '🍟', bg: 'bg-lime-100 dark:bg-lime-900/40', text: 'text-lime-700 dark:text-lime-300', accent: '#84cc16' },
  'Penine in Šampanjci': { emoji: '🥂', bg: 'bg-amber-100 dark:bg-amber-900/40', text: 'text-amber-700 dark:text-amber-300', accent: '#d4a017' },
  'Bela Vina': { emoji: '🍷', bg: 'bg-emerald-100 dark:bg-emerald-900/40', text: 'text-emerald-700 dark:text-emerald-300', accent: '#059669' },
  'Rosé Vino': { emoji: '🌹', bg: 'bg-pink-100 dark:bg-pink-900/40', text: 'text-pink-700 dark:text-pink-300', accent: '#e11d48' },
  'Rdeča Vina': { emoji: '🍷', bg: 'bg-red-100 dark:bg-red-900/40', text: 'text-red-700 dark:text-red-300', accent: '#b91c1c' },
  'Tuja Vina': { emoji: '🌍', bg: 'bg-purple-100 dark:bg-purple-900/40', text: 'text-purple-700 dark:text-purple-300', accent: '#7c3aed' },
  'Likersko Vino': { emoji: '🍯', bg: 'bg-amber-100 dark:bg-amber-900/40', text: 'text-amber-700 dark:text-amber-300', accent: '#92400e' },
  'Točeno Pivo': { emoji: '🍺', bg: 'bg-yellow-100 dark:bg-yellow-900/40', text: 'text-yellow-700 dark:text-yellow-300', accent: '#ca8a04' },
  'Pivo': { emoji: '🍻', bg: 'bg-amber-100 dark:bg-amber-900/40', text: 'text-amber-700 dark:text-amber-300', accent: '#d97706' },
  'Craft Piva': { emoji: ' IPA', bg: 'bg-orange-100 dark:bg-orange-900/40', text: 'text-orange-700 dark:text-orange-300', accent: '#ea580c' },
  'Brezalkoholno Pivo': { emoji: '🧃', bg: 'bg-sky-100 dark:bg-sky-900/40', text: 'text-sky-700 dark:text-sky-300', accent: '#0284c7' },
  'Viski': { emoji: '🥃', bg: 'bg-amber-100 dark:bg-amber-900/40', text: 'text-amber-700 dark:text-amber-300', accent: '#92400e' },
  'Gin': { emoji: '🍸', bg: 'bg-cyan-100 dark:bg-cyan-900/40', text: 'text-cyan-700 dark:text-cyan-300', accent: '#0891b2' },
  'Likerji': { emoji: '🍹', bg: 'bg-fuchsia-100 dark:bg-fuchsia-900/40', text: 'text-fuchsia-700 dark:text-fuchsia-300', accent: '#a21caf' },
  'Grenčice': { emoji: '🫒', bg: 'bg-lime-100 dark:bg-lime-900/40', text: 'text-lime-700 dark:text-lime-300', accent: '#4d7c0f' },
  'Destilati, Konjak in Rum': { emoji: '🥃', bg: 'bg-purple-100 dark:bg-purple-900/40', text: 'text-purple-700 dark:text-purple-300', accent: '#6b21a8' },
  'Topli Napitki': { emoji: '☕🍵', bg: 'bg-amber-100 dark:bg-amber-900/40', text: 'text-amber-700 dark:text-amber-300', accent: '#78350f' },
  'Mešane Pijače': { emoji: '🍹', bg: 'bg-rose-100 dark:bg-rose-900/40', text: 'text-rose-700 dark:text-rose-300', accent: '#e11d48' },
  'Vode': { emoji: '💧', bg: 'bg-sky-100 dark:bg-sky-900/40', text: 'text-sky-700 dark:text-sky-300', accent: '#0ea5e9' },
  'Naravni Sokovi': { emoji: '🧃', bg: 'bg-orange-100 dark:bg-orange-900/40', text: 'text-orange-700 dark:text-orange-300', accent: '#ea580c' },
  'Sokovi': { emoji: '🧃', bg: 'bg-orange-100 dark:bg-orange-900/40', text: 'text-orange-700 dark:text-orange-300', accent: '#c2410c' },
  'Gazirane Pijače': { emoji: '🥤', bg: 'bg-red-100 dark:bg-red-900/40', text: 'text-red-700 dark:text-red-300', accent: '#dc2626' },
}
const defaultCategoryStyle = { emoji: '🍽️', bg: 'bg-muted', text: 'text-muted-foreground', accent: '#6b7280' }

// ============================================
// EKSTRAKCIJA VELIKOSTI IZ IMENA ARTIKLA
// Profesionalni POS (Square, Toast, Aloha) prikazujejo
// velikost kot vidno oznako na gumbu/kartici, da natakar
// takoj ve, ali je kozarec ali steklenica, 0.3L ali 0.5L.
// ============================================
function extractSizeLabel(name: string): { label: string; shortLabel: string } | null {
  // Vzorci za velikosti: (0.30L), (0.50L), (kozarec), (steklenica), itd.
  const patterns = [
    // Količina v oklepaju: (0.05L), (0.50L), (1.00L)
    { regex: /\(([0-9]+\.?[0-9]*)\s*L\)/i, format: (m: RegExpMatchArray) => ({ label: m[1] + ' L', shortLabel: m[1].replace(/\.0+$/, '') + 'L' }) },
    // Kozarec / steklenica
    { regex: /\(kozarec\)/i, format: () => ({ label: 'Kozarec', shortLabel: 'Koz.' }) },
    { regex: /\(steklenica\)/i, format: () => ({ label: 'Steklenica', shortLabel: 'Stek.' }) },
    // Velikost brez oklepaja
    { regex: /([0-9]+\.?[0-9]*)\s*L(?!i)/i, format: (m: RegExpMatchArray) => ({ label: m[1] + ' L', shortLabel: m[1].replace(/\.0+$/, '') + 'L' }) },
    // Mala / velika
    { regex: /\bmala\b/i, format: () => ({ label: 'Mala', shortLabel: 'M' }) },
    { regex: /\bvelika\b/i, format: () => ({ label: 'Velika', shortLabel: 'V' }) },
  ]
  
  for (const { regex, format } of patterns) {
    const match = name.match(regex)
    if (match) return format(match as RegExpMatchArray)
  }
  return null
}

// ============================================
// EKSTRAKCIJA TIPA ARTIKLA ZA OZNAKO NA SLIKI
// Ko AI-generirane slike niso dovolj razločljive
// (npr. čaj izgleda kot kava), ta funkcija doda
// izrazito oznako tipa na sliko artikla.
// ============================================
function extractTypeLabel(name: string): { label: string; emoji: string; color: string } | null {
  const typePatterns: { regex: RegExp; label: string; emoji: string; color: string }[] = [
    // Čaj
    { regex: /\bčaj\b|\bcaj\b/i, label: 'ČAJ', emoji: '🍵', color: '#22c55e' },
    // Kakav
    { regex: /\bkakav\b/i, label: 'KAKAV', emoji: '🍫', color: '#92400e' },
    // Vroča čokolada
    { regex: /\bvroča\s*čokolada|\bvroca\s*cokolada/i, label: 'ČOKOLADA', emoji: '🍫', color: '#78350f' },
    // Ledena kava
    { regex: /\bledena\b/i, label: 'LEDENA', emoji: '🧊', color: '#0ea5e9' },
    // Espresso
    { regex: /\bespresso\b/i, label: 'ESPRESSO', emoji: '☕', color: '#78350f' },
    // Cappuccino
    { regex: /\bcappuccino\b/i, label: 'CAPPUCCINO', emoji: '☕', color: '#a16207' },
    // Macchiato
    { regex: /\bmacchiato\b/i, label: 'MACCHIATO', emoji: '☕', color: '#92400e' },
    // Bela kava
    { regex: /\bbela\s*kava\b/i, label: 'BELA KAVA', emoji: '🥛', color: '#f5f5f4' },
    // Kava s smetano
    { regex: /\bkava\s*s\s*smetano/i, label: 'SMETANA', emoji: '🍦', color: '#fef3c7' },
    // Kava z mlekom
    { regex: /\bkava\s*z\s*mlekom/i, label: 'Z MLEKOM', emoji: '🥛', color: '#fef9c3' },
    // Riževo mleko
    { regex: /\briževim?\s*mlekom/i, label: 'RIŽEVO', emoji: '🌾', color: '#fef3c7' },
    // Brez kofeina
    { regex: /\bbrez\s*kofeina/i, label: 'BREZ KOF.', emoji: '🚫☕', color: '#6b7280' },
    // Babyccino
    { regex: /\bbabyccino\b/i, label: 'BABY', emoji: '👶', color: '#fda4af' },
    // Pivo
    { regex: /\bpivo\b/i, label: 'PIVO', emoji: '🍺', color: '#d97706' },
    // Vino
    { regex: /\bvino\b|\bvina\b/i, label: 'VINO', emoji: '🍷', color: '#991b1b' },
  ]
  
  for (const { regex, label, emoji, color } of typePatterns) {
    if (regex.test(name)) return { label, emoji, color }
  }
  return null
}

function getCategoryStyle(categoryName: string) {
  return categoryEmojiMap[categoryName] || defaultCategoryStyle
}
import { useState, useMemo, useEffect, useCallback } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { usePOSShortcuts } from '@/lib/use-pos-shortcuts'
import { format } from 'date-fns'
import { ReceiptDialog } from '@/components/pos/ReceiptDialog'
import { PaymentDialog } from '@/components/pos/PaymentDialog'
import { VoidItemDialog } from '@/components/pos/VoidItemDialog'
import { StornoDialog } from '@/components/pos/StornoDialog'
import { authFetch } from '@/components/pos/PinLogin'

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
    cartTotal, cartSubtotal, cartTaxTotal, cartVatBreakdown,
    orderType, setOrderType, selectedTable, setSelectedTable,
    discount, setDiscount, taxRate,
    activeMenuId, setActiveMenuId,
    editingOrderId, setEditingOrderId, editingOrderNumber, setEditingOrderNumber,
    appliedDiscountId, setAppliedDiscountId, diningOptionId, setDiningOptionId,
  } = usePOSStore()
  const queryClient = useQueryClient()
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [orderNotes, setOrderNotes] = useState('')
  const [activeCategory, setActiveCategory] = useState('all')
  const [activeSuperGroup, setActiveSuperGroup] = useState('all')
  const [itemSearch, setItemSearch] = useState('')
  const [mainTab, setMainTab] = useState('new-order')
  const [orderListTab, setOrderListTab] = useState('all')
  const [selectedOrder, setSelectedOrder] = useState<Record<string, unknown> | null>(null)
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false)
  const [detailOrder, setDetailOrder] = useState<Record<string, unknown> | null>(null)
  const [receiptOrder, setReceiptOrder] = useState<Record<string, unknown> | null>(null)
  const [autoPayOrder, setAutoPayOrder] = useState<Record<string, unknown> | null>(null)
  const [autoReceiptOrderId, setAutoReceiptOrderId] = useState<string | null>(null)
  const [voidItem, setVoidItem] = useState<{ id: string; name: string; quantity: number; price: number; vatRate: number; voided: boolean; orderId: string } | null>(null)
  const [stornoOrder, setStornoOrder] = useState<Record<string, unknown> | null>(null)

  // Modifier dialog
  const [modifierDialogItem, setModifierDialogItem] = useState<MenuItemType | null>(null)
  const [selectedModifiers, setSelectedModifiers] = useState<Map<string, SelectedModifier>>(new Map())

  // Clear cart confirmation
  const [clearCartConfirm, setClearCartConfirm] = useState(false)

  // Menu item add animation
  const [lastAddedId, setLastAddedId] = useState<string | null>(null)

  // Keyboard shortcuts dialog
  const [shortcutsOpen, setShortcutsOpen] = useState(false)

  // Keyboard shortcuts
  usePOSShortcuts({
    onNewOrder: () => { clearCart(); setCustomerName(''); setCustomerPhone(''); setOrderNotes(''); setDiscount(0); setEditingOrderId(null); setEditingOrderNumber(null); setMainTab('new-order') },
    onPay: () => { if (cart.length > 0) placeOrderMutation.mutate() },
    onSearch: () => setItemSearch(prev => prev ? '' : ' '),
    onClearCart: () => { if (cart.length > 0) setClearCartConfirm(true) },
    onOrderList: () => setMainTab('order-list'),
    onEscape: () => { if (itemSearch) setItemSearch(''); if (modifierDialogItem) { setModifierDialogItem(null); setSelectedModifiers(new Map()) } },
  })

  // ============================================
  // PODATKI
  // ============================================
  const { data: menus, isLoading: menusLoading } = useQuery({
    queryKey: ['menus'],
    queryFn: async () => { const res = await authFetch('/api/menus'); return res.json() },
  })

  const { data: menuItems, isLoading: menuLoading } = useQuery({
    queryKey: ['menu-items'],
    queryFn: async () => { const res = await authFetch('/api/menu-items'); return res.json() },
  })

  const { data: tables } = useQuery({
    queryKey: ['tables'],
    queryFn: async () => { const res = await authFetch('/api/tables'); return res.json() },
  })

  const { data: orders, isLoading: ordersLoading } = useQuery({
    queryKey: ['orders', orderListTab],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (orderListTab !== 'all') params.set('status', orderListTab)
      const res = await authFetch(`/api/orders?${params}`)
      return res.json()
    },
  })

  // Konfiguracijski podatki za naročilo
  const { data: discounts } = useQuery({
    queryKey: ['discounts-active'],
    queryFn: async () => {
      const res = await authFetch('/api/discounts')
      if (!res.ok) return []
      const all = await res.json()
      return all.filter((d: { isActive: boolean }) => d.isActive)
    },
  })

  const { data: diningOptions } = useQuery({
    queryKey: ['dining-options'],
    queryFn: async () => {
      const res = await authFetch('/api/configuration/dining-options')
      if (!res.ok) return []
      return res.json()
    },
  })

  // ============================================
  // MUTACIJE
  // ============================================
  const placeOrderMutation = useMutation({
    mutationFn: async () => {
      // Če urejamo obstoječe naročilo, dodaj artikle
      if (editingOrderId) {
        const res = await authFetch(`/api/orders/${editingOrderId}/add-items`, {
          method: 'POST',
          body: JSON.stringify({
            orderItems: cart.map(item => ({
              menuItemId: item.id,
              quantity: item.quantity,
              price: item.price,
              notes: item.notes,
              modifiersJson: JSON.stringify(item.modifiers.map(m => ({ name: m.name, price: m.price, modifierGroupName: m.modifierGroupName }))),
            })),
          }),
        })
        if (!res.ok) throw new Error('Failed to add items')
        return res.json()
      }

      // Novo naročilo
      const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0)
      const res = await authFetch('/api/orders', {
        method: 'POST',
        body: JSON.stringify({
          type: orderType,
          tableId: orderType === 'dine-in' ? selectedTable : null,
          diningOptionId: diningOptionId || undefined,
          customerName,
          customerPhone,
          discount: cappedDiscount,
          appliedDiscountId: appliedDiscountId || undefined,
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
    onSuccess: (data) => {
      if (editingOrderId) {
        toast.success(`Artikli dodani k naročilu #${editingOrderNumber}!`)
      } else {
        toast.success('Naročilo uspešno oddano! Plačaj in natisni račun.')
      }
      // Samodejno odpri plačilno okno z novim naročilom
      if (data && !editingOrderId) {
        setAutoPayOrder(data)
        setPaymentDialogOpen(true)
      }
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
      const res = await authFetch(`/api/orders/${id}`, {
        method: 'PUT',
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
        const matchesSuperGroup = activeSuperGroup === 'all' || 
          superGroups.some(sg => sg.id === activeSuperGroup && sg.categoryIds.includes(item.categoryId))
        const matchesSearch = !itemSearch || item.name.toLowerCase().includes(itemSearch.toLowerCase())
        return matchesMenu && matchesCategory && matchesSuperGroup && matchesSearch && item.isAvailable
      }
    ) || []
  }, [menuItems, resolvedMenuId, activeCategory, activeSuperGroup, superGroups, itemSearch])

  // Uporabimo store funkcije za konsistenten izračun (cartTotal() pravilno
  // porazdeli popust po DDV stopnjah, lokalni izračun tega ni delal)
  const subtotal = cartSubtotal()
  const vatBreakdown = cartVatBreakdown()
  const totalTax = cartTaxTotal()
  const cappedDiscount = Math.min(discount, subtotal)
  const total = cartTotal()
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
  const paymentStatusLabels: Record<string, string> = { unpaid: 'Neplačano', paid: 'Plačano', partial: 'Delno', storno: 'Stornirano' }
  const paymentStatusColors: Record<string, string> = {
    unpaid: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
    paid: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
    partial: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
    storno: 'bg-red-200 text-red-900 dark:bg-red-900/40 dark:text-red-300',
  }

  // ============================================
  // HANDLERJI
  // ============================================
  const handleItemClick = (item: MenuItemType) => {
    if (item.modifierGroups?.length > 0) {
      setModifierDialogItem(item)
      setSelectedModifiers(new Map())
    } else {
      addToCart({ id: item.id, name: item.name, price: item.price, categoryId: item.categoryId, image: item.image })
      // Flash animacija ob dodajanju
      setLastAddedId(item.id)
      setTimeout(() => setLastAddedId(null), 500)
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
    // Validacija obveznih skupin modifikatorjev
    const unmetRequired = modifierDialogItem.modifierGroups
      .filter(mg => mg.modifierGroup.required)
      .filter(mg => {
        const selected = Array.from(selectedModifiers.values()).filter(m => m.modifierGroupId === mg.modifierGroup.id)
        return selected.length < (mg.modifierGroup.minSelect || 1)
      })
    if (unmetRequired.length > 0) {
      toast.error(`Obvezna izbira: ${unmetRequired.map(mg => mg.modifierGroup.name).join(', ')}`)
      return
    }
    const modifiers = Array.from(selectedModifiers.values())
    addToCart({ id: modifierDialogItem.id, name: modifierDialogItem.name, price: modifierDialogItem.price, categoryId: modifierDialogItem.categoryId, image: modifierDialogItem.image, modifiers })
    // Flash animacija ob dodajanju
    setLastAddedId(modifierDialogItem.id)
    setTimeout(() => setLastAddedId(null), 500)
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
          <Button variant="ghost" size="icon" className="h-7 w-7 ml-auto" onClick={() => setShortcutsOpen(true)} title="Tipkovne bližnjice">
            <Keyboard className="h-3.5 w-3.5 text-muted-foreground" />
          </Button>
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
                    <SelectItem value="takeout">📦 Za s seboj</SelectItem>
                    <SelectItem value="delivery">🚚 Dostava</SelectItem>
                  </SelectContent>
                </Select>
                {/* Dining option iz konfiguracije */}
                {diningOptions?.length > 0 && (
                  <Select value={diningOptionId || undefined} onValueChange={(val) => setDiningOptionId(val || null)}>
                    <SelectTrigger className="w-40 h-8 text-xs">
                      <SelectValue placeholder="Način postrežbe" />
                    </SelectTrigger>
                    <SelectContent>
                      {diningOptions.map((opt: { id: string; name: string; type: string }) => (
                        <SelectItem key={opt.id} value={opt.id}>
                          {opt.type === 'dine-in' ? '🍽️' : opt.type === 'takeout' ? '📦' : '🚚'} {opt.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
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
              {/* Quick Search */}
              {itemSearch && (
                <div className="px-3 pt-2 flex items-center gap-2 flex-shrink-0">
                  <div className="relative flex-1">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      placeholder="Išči artikel..."
                      value={itemSearch}
                      onChange={e => setItemSearch(e.target.value)}
                      className="h-8 text-xs pl-8 pr-8"
                      autoFocus
                    />
                    <Button variant="ghost" size="icon" className="absolute right-0.5 top-1/2 -translate-y-1/2 h-7 w-7" onClick={() => setItemSearch('')}>
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                  <Badge variant="secondary" className="text-[10px] h-6 flex-shrink-0">{filteredMenuItems.length}</Badge>
                </div>
              )}
              {!itemSearch && (
                <div className="px-3 pt-2 flex-shrink-0">
                  <button
                    onClick={() => setItemSearch(' ')}
                    className="flex items-center gap-2 w-full text-sm text-muted-foreground hover:text-foreground transition-colors py-2 px-3 rounded-lg border border-dashed border-border hover:border-primary/50 hover:bg-primary/5"
                  >
                    <Search className="h-4 w-4" />
                    <span>Išči artikel...</span>
                    <kbd className="ml-auto text-[10px] bg-muted px-1.5 py-0.5 rounded border font-mono">⌘K</kbd>
                  </button>
                </div>
              )}
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
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2.5">
                    {filteredMenuItems.map((item: MenuItemType) => {
                      const inCart = cart.filter(c => c.id === item.id)
                      const totalQty = inCart.reduce((sum, c) => sum + c.quantity, 0)
                      const hasMods = item.modifierGroups?.length > 0
                      const catStyle = getCategoryStyle(item.category?.name)
                      const sizeInfo = extractSizeLabel(item.name)
                      const typeInfo = extractTypeLabel(item.name)
                      // Pobriši velikost iz prikazanega imena za čistejši prikaz
                      const displayName = item.name
                        .replace(/\s*\([0-9]+\.?[0-9]*\s*L\)/gi, '')
                        .replace(/\s*\(kozarec\)/gi, '')
                        .replace(/\s*\(steklenica\)/gi, '')
                        .replace(/\s*[0-9]+\.?[0-9]*\s*L(?!i)/gi, '')
                        .trim()
                      return (
                        <button
                          key={item.id}
                          onClick={() => handleItemClick(item)}
                          className={`relative flex flex-col rounded-xl bg-card hover:bg-accent/50 active:scale-[0.97] transition-all text-left overflow-hidden group ${lastAddedId === item.id ? 'ring-2 ring-primary ring-offset-1' : ''}`}
                          style={{ borderLeft: `4px solid ${catStyle.accent}` }}
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
                          {/* Image / Fallback ikona */}
                          <div className="w-full aspect-square relative overflow-hidden">
                            {item.image ? (
                              <img
                                src={item.image}
                                alt={item.name}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                                onError={(e) => {
                                  const target = e.target as HTMLImageElement
                                  target.style.display = 'none'
                                  const fallback = target.nextElementSibling as HTMLElement
                                  if (fallback) fallback.classList.remove('hidden')
                                }}
                              />
                            ) : null}
                            <div className={`absolute inset-0 flex flex-col items-center justify-center gap-0.5 ${item.image ? 'hidden' : ''} ${catStyle.bg}`}>
                              <span className="text-2xl leading-none">{catStyle.emoji}</span>
                              <span className={`text-lg font-bold leading-none ${catStyle.text}`}>
                                {item.name.charAt(0).toUpperCase()}
                              </span>
                            </div>
                            {/* Oznaka velikosti na sliki - Toast/Square POS stil */}
                            {sizeInfo && (
                              <div 
                                className="absolute bottom-0 left-0 right-0 z-10 flex items-center justify-center py-1 px-2"
                                style={{ backgroundColor: catStyle.accent + 'E6' }}
                              >
                                <span className="text-white text-[11px] font-bold tracking-wide drop-shadow-sm">
                                  {sizeInfo.shortLabel}
                                </span>
                              </div>
                            )}
                            {/* Oznaka tipa pijače na sliki - izrazita za hitro prepoznavo */}
                            {typeInfo && !sizeInfo && (
                              <div 
                                className="absolute top-0 left-0 right-0 z-10 flex items-center justify-center py-1 px-2"
                                style={{ backgroundColor: typeInfo.color + 'E6' }}
                              >
                                <span className="text-white text-[11px] font-bold tracking-wide drop-shadow-sm flex items-center gap-1">
                                  <span>{typeInfo.emoji}</span>
                                  {typeInfo.label}
                                </span>
                              </div>
                            )}
                            {typeInfo && sizeInfo && (
                              <div 
                                className="absolute top-0 left-0 right-0 z-10 flex items-center justify-center py-1 px-2"
                                style={{ backgroundColor: typeInfo.color + 'CC' }}
                              >
                                <span className="text-white text-[9px] font-bold tracking-wide drop-shadow-sm flex items-center gap-0.5">
                                  <span>{typeInfo.emoji}</span>
                                  {typeInfo.label}
                                </span>
                              </div>
                            )}
                          </div>
                          {/* Info */}
                          <div className="p-2 flex-1 flex flex-col justify-between min-h-0">
                            <p className="font-semibold text-xs leading-tight line-clamp-2" title={item.name}>{displayName}</p>
                            <div className="flex items-center justify-between mt-1 gap-1">
                              <p className="text-primary font-bold text-sm">€{item.price.toFixed(2)}</p>
                              <div className="flex items-center gap-1 flex-shrink-0">
                                {typeInfo && (
                                  <span 
                                    className="text-[9px] font-bold px-1.5 py-0.5 rounded-full text-white"
                                    style={{ backgroundColor: typeInfo.color }}
                                  >
                                    {typeInfo.emoji} {typeInfo.label}
                                  </span>
                                )}
                                {sizeInfo && (
                                  <span 
                                    className="text-[9px] font-bold px-1.5 py-0.5 rounded-full text-white"
                                    style={{ backgroundColor: catStyle.accent }}
                                  >
                                    {sizeInfo.shortLabel}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* RIGHT: Cart Panel (35%) */}
            <div className="w-[280px] sm:w-[320px] md:w-[340px] xl:w-[380px] border-l border-border bg-card flex flex-col flex-shrink-0">
              {/* Cart Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-border flex-shrink-0">
                <div className="flex items-center gap-2">
                  {editingOrderId ? (
                    <>
                      <UtensilsCrossed className="h-4 w-4 text-primary" />
                      <span className="font-bold text-sm">Dodaj k #{editingOrderNumber}</span>
                    </>
                  ) : (
                    <>
                      <ShoppingBag className="h-4 w-4 text-primary" />
                      <span className="font-bold text-sm">Naročilo</span>
                    </>
                  )}
                  {cartItemCount > 0 && (
                    <Badge variant="secondary" className="text-[10px] h-5 px-1.5">{cartItemCount}</Badge>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  {editingOrderId && (
                    <Button variant="ghost" size="sm" onClick={() => { setEditingOrderId(null); setEditingOrderNumber(null); clearCart() }} className="h-7 text-xs">
                      <ArrowLeft className="h-3 w-3 mr-1" />
                      Novo
                    </Button>
                  )}
                  {cart.length > 0 && (
                    <Button variant="ghost" size="sm" onClick={() => setClearCartConfirm(true)} className="h-7 text-xs text-destructive hover:text-destructive">
                      <Trash2 className="h-3 w-3 mr-1" />
                      Zbriši
                    </Button>
                  )}
                </div>
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
                    <AnimatePresence mode="popLayout">
                    {cart.map((item) => (
                      <motion.div
                        key={item.cartKey}
                        initial={{ opacity: 0, x: 20, scale: 0.95 }}
                        animate={{ opacity: 1, x: 0, scale: 1 }}
                        exit={{ opacity: 0, x: -20, scale: 0.95 }}
                        transition={{ duration: 0.15 }}
                        className="flex items-start gap-2 p-2 rounded-lg bg-muted/40 hover:bg-muted/60 transition-colors"
                      >
                        {/* Thumbnail */}
                        {item.image ? (
                          <div className="w-10 h-10 rounded-md overflow-hidden flex-shrink-0">
                            <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                          </div>
                        ) : (
                          <div className="w-10 h-10 rounded-md bg-muted flex-shrink-0 flex items-center justify-center text-sm font-bold text-muted-foreground">
                            {item.name.charAt(0).toUpperCase()}
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
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive touch-manipulation" onClick={() => removeFromCart(item.cartKey)}>
                            <X className="h-3.5 w-3.5" />
                          </Button>
                          <div className="flex items-center gap-1">
                            <Button variant="outline" size="icon" className="h-10 w-10 touch-manipulation" onClick={() => updateCartQuantity(item.cartKey, item.quantity - 1)}>
                              <Minus className="h-3.5 w-3.5" />
                            </Button>
                            <span className="text-sm font-bold w-7 text-center">{item.quantity}</span>
                            <Button variant="outline" size="icon" className="h-10 w-10 touch-manipulation" onClick={() => updateCartQuantity(item.cartKey, item.quantity + 1)}>
                              <Plus className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                          <p className="text-xs font-bold">€{(item.price * item.quantity).toFixed(2)}</p>
                        </div>
                      </motion.div>
                    ))}
                    </AnimatePresence>
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
                    <Input placeholder="Popust €" type="number" min="0" step="0.01" value={discount || ''} onChange={e => { setDiscount(parseFloat(e.target.value) || 0); setAppliedDiscountId(null) }} className="h-7 text-xs w-20" />
                  </div>
                  {/* Hitri popusti iz konfiguracije */}
                  {discounts?.length > 0 && (
                    <div className="flex gap-1 flex-wrap">
                      <button
                        onClick={() => { setDiscount(0); setAppliedDiscountId(null) }}
                        className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-colors ${!appliedDiscountId && discount === 0 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-accent'}`}
                      >
                        Brez
                      </button>
                      {discounts.slice(0, 4).map((d: { id: string; name: string; type: string; amount: number }) => (
                        <button
                          key={d.id}
                          onClick={() => {
                            setAppliedDiscountId(d.id)
                            if (d.type === 'percentage') {
                              setDiscount(Math.round(subtotal * d.amount) / 100)
                            } else {
                              setDiscount(d.amount)
                            }
                          }}
                          className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-colors ${appliedDiscountId === d.id ? 'bg-emerald-600 text-white' : 'bg-muted text-muted-foreground hover:bg-accent'}`}
                        >
                          {d.type === 'percentage' ? `${d.amount}%` : `€${d.amount}`} {d.name.split(' ').slice(0, 2).join(' ')}
                        </button>
                      ))}
                    </div>
                  )}
                  <Input placeholder="Opombe" value={orderNotes} onChange={e => setOrderNotes(e.target.value)} className="h-7 text-xs" />
                </div>

                {/* Totals */}
                <div className="px-3 py-2 space-y-0.5 text-xs">
                  <div className="flex justify-between text-muted-foreground">
                    <span>Vmesna vsota (brez DDV)</span>
                    <span>€{subtotal.toFixed(2)}</span>
                  </div>
                  {/* Multi-DDV prikaz po stopnjah */}
                  {Object.entries(vatBreakdown).map(([rate, data]) => (
                    <div key={rate} className="flex justify-between text-muted-foreground">
                      <span>DDV {rate}%</span>
                      <span>€{data.vat.toFixed(2)} <span className="text-[9px] opacity-60">(osn. €{data.base.toFixed(2)})</span></span>
                    </div>
                  ))}
                  <div className="flex justify-between text-muted-foreground font-medium">
                    <span>Skupaj DDV</span>
                    <span>€{totalTax.toFixed(2)}</span>
                  </div>
                  {discount > 0 && (
                    <div className="flex justify-between text-emerald-600">
                      <span>Popust</span>
                      <span>-€{discount.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold text-base pt-1">
                    <span>Skupaj z DDV</span>
                    <span>€{Math.max(0, total).toFixed(2)}</span>
                  </div>
                </div>

                {/* Submit Buttons */}
                <div className="px-3 pb-3 space-y-2">
                  <Button
                    className="w-full h-12 text-base font-bold bg-emerald-600 hover:bg-emerald-700"
                    disabled={cart.length === 0 || placeOrderMutation.isPending}
                    onClick={() => placeOrderMutation.mutate()}
                  >
                    {placeOrderMutation.isPending
                      ? (editingOrderId ? 'Dodajam...' : 'Naročam...')
                      : (editingOrderId ? `Dodaj k naročilu #${editingOrderNumber}` : (
                        <>
                          <CreditCard className="h-4 w-4 mr-2" />
                          Oddaj in plačaj
                        </>
                      ))
                    }
                  </Button>
                  {!editingOrderId && (
                    <Button
                      variant="outline"
                      className="w-full h-9 text-sm"
                      disabled={cart.length === 0 || placeOrderMutation.isPending}
                      onClick={() => {
                        // Oddaj brez plačila - samo shrani naročilo
                        placeOrderMutation.mutate()
                      }}
                    >
                      <ShoppingBag className="h-3.5 w-3.5 mr-1.5" />
                      Oddaj naročilo (plačaj kasneje)
                    </Button>
                  )}
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
                  <TabsTrigger value="cancelled" className="text-red-600">Preklicano</TabsTrigger>
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
                          <div className="flex gap-1 flex-wrap">
                            <Badge variant="outline" className={statusColors[order.status] || ''}>{statusLabels[order.status] || order.status}</Badge>
                            {(order.paymentStatus === 'paid' || order.paymentStatus === 'storno') && (
                              <Badge variant="outline" className={paymentStatusColors[order.paymentStatus] || ''}>
                                {paymentStatusLabels[order.paymentStatus] || order.paymentStatus}
                              </Badge>
                            )}
                          </div>
                        </div>
                        <div className="text-sm">
                          <p>{order.customerName || 'Hodič'} · {order.type === 'dine-in' ? 'Na mestu' : order.type === 'takeout' ? 'Za s seboj' : 'Dostava'}</p>
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
                              <Button size="sm" variant="default" className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700" onClick={() => setReceiptOrder(order)}>
                                <Printer className="h-3 w-3 mr-1" />Tiskaj račun
                              </Button>
                            )}
                            {/* Storno/Preklic gumb */}
                            {order.status !== 'cancelled' && order.paymentStatus !== 'storno' && (
                              <Button size="sm" variant="ghost" className="h-7 text-xs text-red-600 hover:text-red-700 hover:bg-red-50" onClick={() => setStornoOrder(order)}>
                                <FileWarning className="h-3 w-3 mr-1" />{order.paymentStatus === 'paid' ? 'Storno' : 'Prekliči'}
                              </Button>
                            )}
                            {/* Pregled storniranega naročila */}
                            {(order.status === 'cancelled' || order.paymentStatus === 'storno') && (
                              <Badge variant="outline" className="bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400 text-[10px]">
                                {order.paymentStatus === 'storno' ? 'STORNO' : 'PREKLICANO'}
                              </Badge>
                            )}
                            {order.status !== 'completed' && order.status !== 'cancelled' && order.paymentStatus !== 'paid' && (
                              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => { setEditingOrderId(order.id); setEditingOrderNumber(order.orderNumber); setMainTab('new-order') }}>
                                <Plus className="h-3 w-3 mr-1" />Dodaj
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

      {/* Payment Dialog */}
      <PaymentDialog
        order={(autoPayOrder || selectedOrder) as Parameters<typeof PaymentDialog>[0]['order']}
        open={paymentDialogOpen}
        onClose={() => { setPaymentDialogOpen(false); setSelectedOrder(null); setAutoPayOrder(null) }}
        onPaymentSuccess={(orderId: string) => {
          // Samodejno odpri račun za tiskanje po plačilu
          if (orderId) {
            setAutoReceiptOrderId(orderId)
            setReceiptOrder({ id: orderId })
          }
        }}
      />

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
              {(detailOrder?.paymentStatus === 'paid' || detailOrder?.paymentStatus === 'storno') && (
                <Badge variant="outline" className={paymentStatusColors[(detailOrder?.paymentStatus as string)] || ''}>
                  {paymentStatusLabels[(detailOrder?.paymentStatus as string)] || String(detailOrder?.paymentStatus || '')}
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Storno/Preklic opozorilo */}
            {(detailOrder?.status === 'cancelled' || detailOrder?.paymentStatus === 'storno') && (
              <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg p-3 space-y-1">
                <p className="text-sm font-semibold text-red-700 dark:text-red-300">
                  {detailOrder?.paymentStatus === 'storno' ? 'Stornirano naročilo' : 'Preklicano naročilo'}
                </p>
                {Boolean(detailOrder?.cancelReason) && (
                  <p className="text-xs text-red-600 dark:text-red-400">
                    Razlog: {String(detailOrder?.cancelReason)}
                  </p>
                )}
                {Boolean(detailOrder?.cancelledAt) && (
                  <p className="text-xs text-red-600/70 dark:text-red-400/70">
                    Preklicano: {format(new Date(detailOrder?.cancelledAt as string), 'dd.MM.yyyy HH:mm')}
                  </p>
                )}
                {Boolean(detailOrder?.cancelledBy) && (
                  <p className="text-xs text-red-600/70 dark:text-red-400/70">
                    Preklical/a: {String(detailOrder?.cancelledBy)}
                  </p>
                )}
              </div>
            )}
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><p className="text-muted-foreground">Stranka</p><p className="font-medium">{String(detailOrder?.customerName || 'Hodič')}</p></div>
              <div><p className="text-muted-foreground">Vrsta</p><p className="font-medium">{detailOrder?.type === 'dine-in' ? 'Na mestu' : detailOrder?.type === 'takeout' ? 'Za s seboj' : 'Dostava'}</p></div>
              <div><p className="text-muted-foreground">Miza</p><p className="font-medium">{detailOrder?.table ? `Miza ${(detailOrder.table as { number: number }).number}` : 'Brez'}</p></div>
              <div>
                <p className="text-muted-foreground">Plačilo</p>
                <div className="flex items-center gap-1">
                  <Badge variant="outline" className={paymentStatusColors[(detailOrder?.paymentStatus as string)] || 'bg-yellow-100 text-yellow-800'}>
                    {paymentStatusLabels[(detailOrder?.paymentStatus as string)] || 'Neplačano'}
                  </Badge>
                  {Boolean(detailOrder?.paymentMethod) && <span className="text-xs text-muted-foreground uppercase">{String(detailOrder?.paymentMethod)}</span>}
                </div>
              </div>
              <div><p className="text-muted-foreground">Čas</p><p className="font-medium">{detailOrder?.createdAt ? format(new Date(detailOrder.createdAt as string), 'MMM dd, yyyy HH:mm') : 'Brez'}</p></div>
            </div>
            <Separator />
            <div className="space-y-2">
              <p className="text-sm font-semibold">Artikli</p>
              {((detailOrder?.orderItems as { id: string; menuItem: { name: string; image: string }; quantity: number; price: number; notes: string; status: string; modifiersJson?: string; voided?: boolean }[]) || []).map(oi => (
                <div key={oi.id} className={`flex items-start justify-between text-sm py-1 gap-2 ${oi.voided ? 'opacity-40 line-through' : ''}`}>
                  <div className="flex items-start gap-2 flex-1">
                    {oi.menuItem.image ? (
                      <div className="w-9 h-9 rounded-md overflow-hidden flex-shrink-0">
                        <img src={oi.menuItem.image} alt={oi.menuItem.name} className="w-full h-full object-cover" />
                      </div>
                    ) : (
                      <div className={`w-9 h-9 rounded-md flex-shrink-0 flex items-center justify-center text-xs ${defaultCategoryStyle.bg}`}>
                        {defaultCategoryStyle.emoji}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{oi.quantity}x {oi.menuItem.name}</span>
                        <Badge variant="outline" className={`text-[10px] h-4 capitalize ${oi.voided ? 'bg-red-100 text-red-800' : ''}`}>{oi.voided ? 'VOID' : oi.status}</Badge>
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
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <span className="font-medium">€{(oi.price * oi.quantity).toFixed(2)}</span>
                    {!oi.voided && detailOrder?.paymentStatus !== 'paid' && detailOrder?.status !== 'cancelled' && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-red-500 hover:text-red-700 hover:bg-red-50"
                        onClick={() => {
                          setVoidItem({
                            id: oi.id,
                            name: oi.menuItem.name,
                            quantity: oi.quantity,
                            price: oi.price,
                            vatRate: (detailOrder?.orderItems as { id: string; vatRate: number }[])?.find(i => i.id === oi.id)?.vatRate || 22.0,
                            voided: false,
                            orderId: detailOrder?.id as string,
                          })
                        }}
                        title="Void artikla"
                      >
                        <XCircle className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
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

      {/* Receipt Dialog */}
      <ReceiptDialog
        orderId={receiptOrder?.id as string || null}
        open={!!receiptOrder}
        onClose={() => { setReceiptOrder(null); setAutoReceiptOrderId(null) }}
      />

      {/* Void Item Dialog */}
      <VoidItemDialog
        orderItem={voidItem}
        orderId={voidItem?.orderId || ''}
        open={!!voidItem}
        onClose={() => setVoidItem(null)}
        onVoided={() => queryClient.invalidateQueries({ queryKey: ['orders'] })}
      />

      {/* Storno Dialog */}
      <StornoDialog
        order={stornoOrder as { id: string; orderNumber: number; total: number; subtotal: number; tax: number; discount: number; tip: number; paymentMethod: string; paymentStatus: string } | null}
        open={!!stornoOrder}
        onClose={() => setStornoOrder(null)}
        onStornoComplete={() => {
          queryClient.invalidateQueries({ queryKey: ['orders'] })
          queryClient.invalidateQueries({ queryKey: ['dashboard'] })
        }}
      />

      {/* Clear Cart Confirmation Dialog */}
      <Dialog open={clearCartConfirm} onOpenChange={setClearCartConfirm}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Počisti košarico?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Ali ste prepričani, da želite izbrisati vse artikle iz košarice? Tega dejanja ni mogoče razveljaviti.
          </p>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setClearCartConfirm(false)}>Prekliči</Button>
            <Button variant="destructive" onClick={() => { clearCart(); setClearCartConfirm(false) }}>
              <Trash2 className="h-4 w-4 mr-1" />
              Počisti
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Keyboard Shortcuts Dialog */}
      <Dialog open={shortcutsOpen} onOpenChange={setShortcutsOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Keyboard className="h-5 w-5" />
              Tipkovne bližnjice
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2 text-sm">
            {[
              { key: 'F2', desc: 'Novo naročilo' },
              { key: 'F4', desc: 'Plačaj / Oddaj' },
              { key: 'F5', desc: 'Seznam naročil' },
              { key: 'F8', desc: 'Počisti košarico' },
              { key: 'Ctrl+K', desc: 'Išči artikel' },
              { key: 'Esc', desc: 'Zapri / Prekliči' },
            ].map(s => (
              <div key={s.key} className="flex items-center justify-between py-1.5 border-b border-border last:border-0">
                <span className="text-muted-foreground">{s.desc}</span>
                <kbd className="px-2 py-0.5 rounded bg-muted border border-border text-xs font-mono font-semibold">{s.key}</kbd>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
