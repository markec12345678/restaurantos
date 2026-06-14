import { useState, useEffect, useCallback, useRef } from 'react'
import { translations } from '../translations'
import type { Locale } from '../translations'
import type { CartItem, MenuType, MenuItemType, OrderResult, RestaurantInfo } from '../types'
import { drinkSuperGroups } from '../types'

export interface QROrderingState {
  // State
  tableId: string
  locale: Locale
  setLocale: (_locale: Locale) => void
  menus: MenuType[]
  restaurant: RestaurantInfo | null
  activeMenuId: string
  setActiveMenuId: (_id: string) => void
  activeCategoryId: string
  setActiveCategoryId: (_id: string) => void
  cart: CartItem[]
  cartOpen: boolean
  setCartOpen: (_open: boolean) => void
  customerName: string
  setCustomerName: (_name: string) => void
  customerPhone: string
  setCustomerPhone: (_phone: string) => void
  orderNotes: string
  setOrderNotes: (_notes: string) => void
  loading: boolean
  submitting: boolean
  error: string | null
  setError: (_error: string | null) => void
  orderResult: OrderResult | null
  orderStatus: string
  localeOpen: boolean
  setLocaleOpen: (_open: boolean) => void
  tableNotFound: boolean
  searchQuery: string
  setSearchQuery: (_query: string) => void
  detailItem: MenuItemType | null
  setDetailItem: (_item: MenuItemType | null) => void
  detailNote: string
  setDetailNote: (_note: string) => void
  waiterCalled: boolean
  waiterCooldown: boolean
  activeSuperGroup: string
  setActiveSuperGroup: (_group: string) => void

  // Derived
  t: typeof translations['sl'] | typeof translations['en'] | typeof translations['it'] | typeof translations['de'] | typeof translations['hr']
  cartCount: number
  cartTotal: number
  cartTax: number
  activeMenu: MenuType | undefined
  isDrinksMenu: boolean
  allCategories: MenuType['categories']
  categories: MenuType['categories']
  activeCategory: MenuType['categories'][number] | undefined
  allMenuItems: (MenuItemType & { categoryName: string })[]
  searchResults: (MenuItemType & { categoryName: string })[]
  isSearching: boolean

  // Handlers
  addToCart: (_item: MenuItemType) => void
  addToCartWithNote: (_item: MenuItemType, _note: string) => void
  updateQuantity: (_menuItemId: string, _notes: string, _delta: number) => void
  removeItem: (_menuItemId: string, _notes: string) => void
  callWaiter: () => void
  submitOrder: () => Promise<void>
  getSuperGroupForCategory: (_catName: string) => string | null
  dismissOrderResult: () => void
}

export function useQROrdering(params: Promise<{ tableId: string }>): QROrderingState {
  // State
  const [tableId, setTableId] = useState<string>('')
  const [locale, setLocale] = useState<Locale>('sl')
  const [menus, setMenus] = useState<MenuType[]>([])
  const [restaurant, setRestaurant] = useState<RestaurantInfo | null>(null)
  const [activeMenuId, setActiveMenuId] = useState<string>('')
  const [activeCategoryId, setActiveCategoryId] = useState<string>('')
  const [cart, setCart] = useState<CartItem[]>([])
  const [cartOpen, setCartOpen] = useState(false)
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [orderNotes, setOrderNotes] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [orderResult, setOrderResult] = useState<OrderResult | null>(null)
  const [orderStatus, setOrderStatus] = useState<string>('')
  const [localeOpen, setLocaleOpen] = useState(false)
  const [tableNotFound, setTableNotFound] = useState(false)

  // New state for enhanced features
  const [searchQuery, setSearchQuery] = useState('')
  const [detailItem, setDetailItem] = useState<MenuItemType | null>(null)
  const [detailNote, setDetailNote] = useState('')
  const [waiterCalled, setWaiterCalled] = useState(false)
  const [waiterCooldown, setWaiterCooldown] = useState(false)
  const [activeSuperGroup, setActiveSuperGroup] = useState<string>('all')

  const t = translations[locale]
  const statusRef = useRef<NodeJS.Timeout | null>(null)

  // Resolve params
  useEffect(() => {
    params.then(p => setTableId(p.tableId))
  }, [params])

  // Fetch menu data
  useEffect(() => {
    if (!tableId) return

    const fetchData = async () => {
      try {
        setLoading(true)
        const res = await fetch('/api/public/menu')
        if (!res.ok) throw new Error('Failed to fetch menu')
        const data = await res.json()

        if (data.menus && data.menus.length > 0) {
          setMenus(data.menus)
          setActiveMenuId(data.menus[0].id)
          if (data.menus[0].categories?.length > 0) {
            setActiveCategoryId(data.menus[0].categories[0].id)
          }
        }
        setRestaurant(data.restaurant)
        setError(null)
      } catch {
        setError('Napaka pri nalaganju.')
      } finally {
        setLoading(false)
      }
    }

    // Verify table exists (uporabi public verify-table endpoint)
    const verifyTable = async () => {
      try {
        const res = await fetch(`/api/public/verify-table?tableId=${encodeURIComponent(tableId)}`)
        if (res.ok) {
          const data = await res.json()
          if (!data.exists) setTableNotFound(true)
        }
      } catch {
        // Can't verify - let user proceed
      }
    }

    fetchData()
    verifyTable()
  }, [tableId])

  // Poll order status after order placed
  useEffect(() => {
    if (!orderResult) return

    const pollStatus = async () => {
      try {
        const res = await fetch(`/api/public/order-track?orderId=${orderResult.orderId}`)
        if (res.ok) {
          const order = await res.json()
          setOrderStatus(order.status)
        }
      } catch {
        // Silent
      }
    }

    pollStatus()
    statusRef.current = setInterval(pollStatus, 10000)

    return () => {
      if (statusRef.current) clearInterval(statusRef.current)
    }
  }, [orderResult])

  // Cart helpers
  const addToCart = useCallback((item: MenuItemType) => {
    setCart(prev => {
      const existing = prev.find(c => c.menuItemId === item.id && c.notes === '')
      if (existing) {
        return prev.map(c =>
          c.menuItemId === item.id && c.notes === ''
            ? { ...c, quantity: c.quantity + 1 }
            : c
        )
      }
      return [...prev, {
        menuItemId: item.id,
        name: item.name,
        price: item.price,
        vatRate: item.vatRate,
        image: item.image,
        quantity: 1,
        notes: '',
      }]
    })
  }, [])

  const addToCartWithNote = useCallback((item: MenuItemType, note: string) => {
    setCart(prev => {
      const trimmedNote = note.trim()
      const existing = prev.find(c => c.menuItemId === item.id && c.notes === trimmedNote)
      if (existing) {
        return prev.map(c =>
          c.menuItemId === item.id && c.notes === trimmedNote
            ? { ...c, quantity: c.quantity + 1 }
            : c
        )
      }
      return [...prev, {
        menuItemId: item.id,
        name: item.name,
        price: item.price,
        vatRate: item.vatRate,
        image: item.image,
        quantity: 1,
        notes: trimmedNote,
      }]
    })
  }, [])

  const updateQuantity = useCallback((menuItemId: string, notes: string, delta: number) => {
    setCart(prev => {
      return prev
        .map(c => {
          if (c.menuItemId === menuItemId && c.notes === notes) {
            return { ...c, quantity: c.quantity + delta }
          }
          return c
        })
        .filter(c => c.quantity > 0)
    })
  }, [])

  const removeItem = useCallback((menuItemId: string, notes: string) => {
    setCart(prev => prev.filter(c => !(c.menuItemId === menuItemId && c.notes === notes)))
  }, [])

  const cartCount = cart.reduce((sum, c) => sum + c.quantity, 0)
  const cartTotal = cart.reduce((sum, c) => sum + c.price * c.quantity, 0)
  const cartTax = cart.reduce((sum, c) => sum + c.price * c.quantity * (c.vatRate / 100), 0)

  // Call waiter handler
  const callWaiter = useCallback(async () => {
    if (waiterCooldown) return
    try {
      const res = await fetch('/api/public/call-waiter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tableId, message: '' }),
      })
      if (res.ok) {
        setWaiterCalled(true)
        setWaiterCooldown(true)
        setTimeout(() => setWaiterCalled(false), 3000)
        setTimeout(() => setWaiterCooldown(false), 30000)
      }
    } catch {
      // Silent
    }
  }, [tableId, waiterCooldown])

  // Submit order
  const submitOrder = async () => {
    if (cart.length === 0 || submitting) return

    setSubmitting(true)
    try {
      const res = await fetch('/api/public/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tableId,
          customerName,
          customerPhone,
          orderItems: cart.map(c => ({
            menuItemId: c.menuItemId,
            quantity: c.quantity,
            notes: c.notes,
            modifiersJson: '[]',
          })),
          notes: orderNotes,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Napaka')
      }

      setOrderResult({
        orderNumber: data.order.orderNumber,
        orderId: data.order.id,
        tableNumber: data.order.tableNumber,
      })
      setOrderStatus(data.order.status)
      setCart([])
      setCartOpen(false)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Napaka pri naročanju')
    } finally {
      setSubmitting(false)
    }
  }

  // Get current categories and items
  const activeMenu = menus.find(m => m.id === activeMenuId)
  const isDrinksMenu = activeMenu?.name === 'Pijača'

  // Super-group filtering for drinks menu
  const getSuperGroupForCategory = useCallback((catName: string): string | null => {
    for (const sg of drinkSuperGroups) {
      if (sg.keywords.some(kw => catName.toLowerCase().includes(kw.toLowerCase()))) {
        return sg.id
      }
    }
    return null
  }, [])

  const allCategories = activeMenu?.categories || []
  const categories = isDrinksMenu && activeSuperGroup !== 'all'
    ? allCategories.filter(cat => getSuperGroupForCategory(cat.name) === activeSuperGroup)
    : allCategories

  const activeCategory = activeMenu?.categories.find(c => c.id === activeCategoryId)

  // Search filtering
  const allMenuItems = activeMenu?.categories.flatMap(cat =>
    cat.menuItems.map(item => ({ ...item, categoryName: cat.name }))
  ) || []

  const searchResults = searchQuery.trim()
    ? allMenuItems.filter(item =>
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.description?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : []

  const isSearching = searchQuery.trim().length > 0

  const dismissOrderResult = () => {
    setOrderResult(null)
    setOrderStatus('')
  }

  return {
    // State
    tableId,
    locale,
    setLocale,
    menus,
    restaurant,
    activeMenuId,
    setActiveMenuId,
    activeCategoryId,
    setActiveCategoryId,
    cart,
    cartOpen,
    setCartOpen,
    customerName,
    setCustomerName,
    customerPhone,
    setCustomerPhone,
    orderNotes,
    setOrderNotes,
    loading,
    submitting,
    error,
    setError,
    orderResult,
    orderStatus,
    localeOpen,
    setLocaleOpen,
    tableNotFound,
    searchQuery,
    setSearchQuery,
    detailItem,
    setDetailItem,
    detailNote,
    setDetailNote,
    waiterCalled,
    waiterCooldown,
    activeSuperGroup,
    setActiveSuperGroup,

    // Derived
    t,
    cartCount,
    cartTotal,
    cartTax,
    activeMenu,
    isDrinksMenu,
    allCategories,
    categories,
    activeCategory,
    allMenuItems,
    searchResults,
    isSearching,

    // Handlers
    addToCart,
    addToCartWithNote,
    updateQuantity,
    removeItem,
    callWaiter,
    submitOrder,
    getSuperGroupForCategory,
    dismissOrderResult,
  }
}
