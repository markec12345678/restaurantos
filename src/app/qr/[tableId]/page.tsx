'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ShoppingCart, Plus, Minus, Trash2, ChevronRight, Check,
  Clock, UtensilsCrossed, Wine, Phone, User, MessageSquare,
  AlertCircle, Loader2, ArrowLeft, X, Globe, Bell, Search
} from 'lucide-react'

// ============================================
// VEČJEZIČNI PREVODI (5 jezikov)
// ============================================
const translations = {
  sl: {
    table: 'Miza',
    menu: 'Meni',
    food: 'Hrana',
    drinks: 'Pijača',
    cart: 'Košarica',
    addToCart: 'V košarico',
    order: 'Naroči',
    total: 'Skupaj',
    subtotal: 'Vmesna vsota',
    vat: 'DDV',
    empty: 'Vaša košarica je prazna',
    emptyMenu: 'Na voljo ni artiklov',
    name: 'Vaše ime',
    phone: 'Telefon',
    notes: 'Opombe',
    orderNotes: 'Opombe k naročilu',
    itemNotes: 'Opombe k artiklu',
    confirmOrder: 'Potrdi naročilo',
    ordering: 'Naročanje...',
    orderSuccess: 'Naročilo uspešno poslano!',
    orderNumber: 'Št. naročila',
    orderStatus: 'Status naročila',
    pending: 'Čakajoče',
    inProgress: 'V obdelavi',
    ready: 'Pripravljeno',
    completed: 'Zaključeno',
    scanTable: 'Skenirajte QR kodo na mizi',
    allergens: 'Alergeni',
    price: 'Cena',
    quantity: 'Količina',
    remove: 'Odstrani',
    addMore: 'Dodaj še',
    backToMenu: 'Nazaj na meni',
    yourOrder: 'Vaše naročilo',
    tableNotFound: 'Miza ni najdena',
    error: 'Prišlo je do napake',
    tryAgain: 'Poskusite znova',
    close: 'Zapri',
    loading: 'Nalaganje...',
    items: 'artikli',
    item: 'artikel',
    forTable: 'za mizo',
    welcomeTo: 'Dobrodošli v',
    selectCategory: 'Izberite kategorijo',
    popular: 'Priljubljeno',
    currency: '€',
    vatIncluded: 'DDV vključen v ceno',
    orderFromTable: 'Naročilo iz mize',
    newOrder: 'Novo naročilo',
    trackingOrder: 'Sledenje naročilu',
    search: 'Poiščite artikel...',
    searchResults: '{count} rezultatov',
    callWaiter: 'Pokliči natakarja',
    waiterCalled: 'Natakar poklican!',
    itemDetail: 'Podrobnosti',
    addItemNote: 'Dodaj opombo',
    statusAutoUpdates: 'Status se samodejno posodablja',
    optional: 'Neobvezno',
    notePlaceholder: 'Npr. brez česna...',
    wines: 'Vina',
    beers: 'Piva',
    spirits: 'Žgane pijače',
    beverages: 'Napitki',
    nonAlcoholic: 'Brezalkoholne',
  },
  en: {
    table: 'Table',
    menu: 'Menu',
    food: 'Food',
    drinks: 'Drinks',
    cart: 'Cart',
    addToCart: 'Add to cart',
    order: 'Order',
    total: 'Total',
    subtotal: 'Subtotal',
    vat: 'VAT',
    empty: 'Your cart is empty',
    emptyMenu: 'No items available',
    name: 'Your name',
    phone: 'Phone',
    notes: 'Notes',
    orderNotes: 'Order notes',
    itemNotes: 'Item notes',
    confirmOrder: 'Confirm order',
    ordering: 'Ordering...',
    orderSuccess: 'Order sent successfully!',
    orderNumber: 'Order #',
    orderStatus: 'Order status',
    pending: 'Pending',
    inProgress: 'In progress',
    ready: 'Ready',
    completed: 'Completed',
    scanTable: 'Scan QR code on your table',
    allergens: 'Allergens',
    price: 'Price',
    quantity: 'Quantity',
    remove: 'Remove',
    addMore: 'Add more',
    backToMenu: 'Back to menu',
    yourOrder: 'Your order',
    tableNotFound: 'Table not found',
    error: 'An error occurred',
    tryAgain: 'Try again',
    close: 'Close',
    loading: 'Loading...',
    items: 'items',
    item: 'item',
    forTable: 'for table',
    welcomeTo: 'Welcome to',
    selectCategory: 'Select category',
    popular: 'Popular',
    currency: '€',
    vatIncluded: 'VAT included in price',
    orderFromTable: 'Order from table',
    newOrder: 'New order',
    trackingOrder: 'Tracking order',
    search: 'Search for an item...',
    searchResults: '{count} results',
    callWaiter: 'Call waiter',
    waiterCalled: 'Waiter called!',
    itemDetail: 'Details',
    addItemNote: 'Add note',
    statusAutoUpdates: 'Status updates automatically',
    optional: 'Optional',
    notePlaceholder: 'E.g. no garlic...',
    wines: 'Wines',
    beers: 'Beers',
    spirits: 'Spirits',
    beverages: 'Beverages',
    nonAlcoholic: 'Non-alcoholic',
  },
  it: {
    table: 'Tavolo',
    menu: 'Menu',
    food: 'Cibo',
    drinks: 'Bevande',
    cart: 'Carrello',
    addToCart: 'Aggiungi',
    order: 'Ordina',
    total: 'Totale',
    subtotal: 'Subtotale',
    vat: 'IVA',
    empty: 'Il carrello è vuoto',
    emptyMenu: 'Nessun articolo disponibile',
    name: 'Il tuo nome',
    phone: 'Telefono',
    notes: 'Note',
    orderNotes: 'Note ordine',
    itemNotes: 'Note articolo',
    confirmOrder: 'Conferma ordine',
    ordering: 'Ordinazione...',
    orderSuccess: 'Ordine inviato!',
    orderNumber: 'Ordine #',
    orderStatus: "Stato dell'ordine",
    pending: 'In attesa',
    inProgress: 'In preparazione',
    ready: 'Pronto',
    completed: 'Completato',
    scanTable: 'Scansiona il QR sul tavolo',
    allergens: 'Allergeni',
    price: 'Prezzo',
    quantity: 'Quantità',
    remove: 'Rimuovi',
    addMore: 'Aggiungi altro',
    backToMenu: 'Torna al menu',
    yourOrder: 'Il tuo ordine',
    tableNotFound: 'Tavolo non trovato',
    error: "Si è verificato un errore",
    tryAgain: 'Riprova',
    close: 'Chiudi',
    loading: 'Caricamento...',
    items: 'articoli',
    item: 'articolo',
    forTable: 'tavolo',
    welcomeTo: 'Benvenuto a',
    selectCategory: 'Seleziona categoria',
    popular: 'Popolare',
    currency: '€',
    vatIncluded: 'IVA inclusa nel prezzo',
    orderFromTable: 'Ordina dal tavolo',
    newOrder: 'Nuovo ordine',
    trackingOrder: "Tracciamento dell'ordine",
    search: 'Cerca un articolo...',
    searchResults: '{count} risultati',
    callWaiter: 'Chiama il cameriere',
    waiterCalled: 'Cameriere chiamato!',
    itemDetail: 'Dettagli',
    addItemNote: 'Aggiungi nota',
    statusAutoUpdates: "Lo stato si aggiorna automaticamente",
    optional: 'Opzionale',
    notePlaceholder: 'Es. senza aglio...',
    wines: 'Vini',
    beers: 'Birre',
    spirits: 'Distillati',
    beverages: 'Bevande calde',
    nonAlcoholic: 'Analcolici',
  },
  de: {
    table: 'Tisch',
    menu: 'Speisekarte',
    food: 'Essen',
    drinks: 'Getränke',
    cart: 'Warenkorb',
    addToCart: 'In den Warenkorb',
    order: 'Bestellen',
    total: 'Gesamt',
    subtotal: 'Zwischensumme',
    vat: 'MwSt.',
    empty: 'Ihr Warenkorb ist leer',
    emptyMenu: 'Keine Artikel verfügbar',
    name: 'Ihr Name',
    phone: 'Telefon',
    notes: 'Notizen',
    orderNotes: 'Bestellnotizen',
    itemNotes: 'Artikelnotizen',
    confirmOrder: 'Bestellung bestätigen',
    ordering: 'Bestellung läuft...',
    orderSuccess: 'Bestellung gesendet!',
    orderNumber: 'Bestellung #',
    orderStatus: 'Bestellstatus',
    pending: 'Ausstehend',
    inProgress: 'In Bearbeitung',
    ready: 'Fertig',
    completed: 'Abgeschlossen',
    scanTable: 'QR-Code am Tisch scannen',
    allergens: 'Allergene',
    price: 'Preis',
    quantity: 'Menge',
    remove: 'Entfernen',
    addMore: 'Mehr hinzufügen',
    backToMenu: 'Zurück zur Speisekarte',
    yourOrder: 'Ihre Bestellung',
    tableNotFound: 'Tisch nicht gefunden',
    error: 'Ein Fehler ist aufgetreten',
    tryAgain: 'Erneut versuchen',
    close: 'Schließen',
    loading: 'Laden...',
    items: 'Artikel',
    item: 'Artikel',
    forTable: 'Tisch',
    welcomeTo: 'Willkommen bei',
    selectCategory: 'Kategorie wählen',
    popular: 'Beliebt',
    currency: '€',
    vatIncluded: 'MwSt. im Preis enthalten',
    orderFromTable: 'Bestellung am Tisch',
    newOrder: 'Neue Bestellung',
    trackingOrder: 'Bestellverfolgung',
    search: 'Artikel suchen...',
    searchResults: '{count} Ergebnisse',
    callWaiter: 'Kellner rufen',
    waiterCalled: 'Kellner gerufen!',
    itemDetail: 'Details',
    addItemNote: 'Notiz hinzufügen',
    statusAutoUpdates: 'Status wird automatisch aktualisiert',
    optional: 'Optional',
    notePlaceholder: 'Z.B. ohne Knoblauch...',
    wines: 'Weine',
    beers: 'Biere',
    spirits: 'Spirituosen',
    beverages: 'Heiße Getränke',
    nonAlcoholic: 'Alkoholfrei',
  },
  hr: {
    table: 'Stol',
    menu: 'Jelovnik',
    food: 'Hrana',
    drinks: 'Piće',
    cart: 'Košarica',
    addToCart: 'U košaricu',
    order: 'Naruči',
    total: 'Ukupno',
    subtotal: 'Podzbroj',
    vat: 'PDV',
    empty: 'Vaša košarica je prazna',
    emptyMenu: 'Nema dostupnih artikala',
    name: 'Vaše ime',
    phone: 'Telefon',
    notes: 'Napomene',
    orderNotes: 'Napomene narudžbe',
    itemNotes: 'Napomene artikla',
    confirmOrder: 'Potvrdi narudžbu',
    ordering: 'Naručivanje...',
    orderSuccess: 'Narudžba uspješno poslana!',
    orderNumber: 'Narudžba #',
    orderStatus: 'Status narudžbe',
    pending: 'Na čekanju',
    inProgress: 'U pripremi',
    ready: 'Spremno',
    completed: 'Završeno',
    scanTable: 'Skenirajte QR kod na stolu',
    allergens: 'Alergeni',
    price: 'Cijena',
    quantity: 'Količina',
    remove: 'Ukloni',
    addMore: 'Dodaj još',
    backToMenu: 'Natrag na jelovnik',
    yourOrder: 'Vaša narudžba',
    tableNotFound: 'Stol nije pronađen',
    error: 'Došlo je do pogreške',
    tryAgain: 'Pokušajte ponovno',
    close: 'Zatvori',
    loading: 'Učitavanje...',
    items: 'artikala',
    item: 'artikl',
    forTable: 'za stol',
    welcomeTo: 'Dobrodošli u',
    selectCategory: 'Odaberite kategoriju',
    popular: 'Popularno',
    currency: '€',
    vatIncluded: 'PDV uključen u cijenu',
    orderFromTable: 'Narudžba sa stola',
    newOrder: 'Nova narudžba',
    trackingOrder: 'Praćenje narudžbe',
    search: 'Pretraži artikle...',
    searchResults: '{count} rezultata',
    callWaiter: 'Pozovi konobara',
    waiterCalled: 'Konobar pozvan!',
    itemDetail: 'Detalji',
    addItemNote: 'Dodaj napomenu',
    statusAutoUpdates: 'Status se automatski ažurira',
    optional: 'Neobavezno',
    notePlaceholder: 'Npr. bez češnjaka...',
    wines: 'Vina',
    beers: 'Piva',
    spirits: 'Žestoka pića',
    beverages: 'Napitci',
    nonAlcoholic: 'Bezalkoholna',
  },
} as const

type Locale = keyof typeof translations

// ============================================
// TIPI
// ============================================
interface MenuItemType {
  id: string
  name: string
  description: string
  price: number
  image: string
  vatRate: number
  allergens: string
  categoryId: string
}

interface CategoryType {
  id: string
  name: string
  icon: string
  color: string
  sortOrder: number
  menuItems: MenuItemType[]
}

interface MenuType {
  id: string
  name: string
  icon: string
  color: string
  categories: CategoryType[]
}

interface CartItem {
  menuItemId: string
  name: string
  price: number
  vatRate: number
  image: string
  quantity: number
  notes: string
}

interface RestaurantInfo {
  name: string
  address: string
  city: string
  phone: string
  email: string
  web: string
  currency: string
}

// ============================================
// ALLERGEN MAPA
// ============================================
const allergenLabels: Record<string, string> = {
  '1': '🌾', '2': '🥛', '3': '🥚', '4': '🐟', '5': '🥜',
  '6': '🫘', '7': '🥜', '8': '🌾', '9': '🌱', '10': '🥬',
  '11': '🌶️', '12': '🧄', '13': '🌰', '14': '🍷',
}

const statusIcons: Record<string, string> = {
  pending: '⏳',
  'in-progress': '👨‍🍳',
  ready: '✅',
  completed: '🎉',
}

const statusColors: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-800',
  'in-progress': 'bg-blue-100 text-blue-800',
  ready: 'bg-emerald-100 text-emerald-800',
  completed: 'bg-gray-100 text-gray-800',
}

const locales: { code: Locale; flag: string; label: string }[] = [
  { code: 'sl', flag: '🇸🇮', label: 'Slovenščina' },
  { code: 'en', flag: '🇬🇧', label: 'English' },
  { code: 'it', flag: '🇮🇹', label: 'Italiano' },
  { code: 'de', flag: '🇩🇪', label: 'Deutsch' },
  { code: 'hr', flag: '🇭🇷', label: 'Hrvatski' },
]

// ============================================
// SUPER-GROUP DEFINITIONS FOR DRINKS
// ============================================
const drinkSuperGroups: { id: string; keywords: string[] }[] = [
  { id: 'wines', keywords: ['Vino', 'Rdeča vina', 'Bela vina', 'Rose vina'] },
  { id: 'beers', keywords: ['Pivo', 'Točeno pivo'] },
  { id: 'spirits', keywords: ['Žganje', 'Lik', 'Raki', 'Whisky', 'Vodka', 'Rum', 'Gin', 'Tekila', 'Konjak'] },
  { id: 'beverages', keywords: ['Kava', 'Čaj', 'Topli napitki', 'Smoothie', 'Milkshake'] },
  { id: 'nonAlcoholic', keywords: ['Sok', 'Voda', 'Mineralna', 'Limonada', 'Brezalkoholn', 'Gazirana', 'Negazirana'] },
]

// ============================================
// GLAVNA KOMPONENTA
// ============================================
export default function QROrderingPage({ params }: { params: Promise<{ tableId: string }> }) {
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
  const [orderResult, setOrderResult] = useState<{ orderNumber: number; orderId: string; tableNumber: number } | null>(null)
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
      } catch (err) {
        setError('Napaka pri nalaganju menija')
        console.error(err)
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
        const res = await fetch(`/api/orders/${orderResult.orderId}`)
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
    } catch (err) {
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

  // Helper to render a menu item card (reused in both normal and search views)
  const renderMenuItem = (item: MenuItemType, categoryName?: string) => {
    const cartQty = cart
      .filter(c => c.menuItemId === item.id)
      .reduce((sum, c) => sum + c.quantity, 0)

    return (
      <motion.div
        key={item.id}
        layout
        className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 overflow-hidden hover:shadow-md transition-shadow"
      >
        <div
          className="flex cursor-pointer"
          onClick={() => { setDetailItem(item); setDetailNote('') }}
        >
          {/* Image */}
          {item.image && (
            <div className="w-24 h-24 flex-shrink-0">
              <img
                src={item.image}
                alt={item.name}
                className="w-full h-full object-cover"
                loading="lazy"
              />
            </div>
          )}

          {/* Content */}
          <div className="flex-1 p-3 min-w-0">
            {categoryName && (
              <p className="text-[10px] text-amber-500 font-medium mb-0.5 uppercase tracking-wide">{categoryName}</p>
            )}
            <h3 className="font-semibold text-sm leading-tight mb-0.5 truncate">{item.name}</h3>
            {item.description && (
              <p className="text-xs text-muted-foreground line-clamp-2 mb-1.5">{item.description}</p>
            )}

            {/* Allergens */}
            {item.allergens && (
              <div className="flex gap-0.5 mb-1.5">
                {item.allergens.split(',').map(a => (
                  <span key={a} className="text-[10px]" title={`Alergen ${a}`}>
                    {allergenLabels[a.trim()] || `A${a.trim()}`}
                  </span>
                ))}
              </div>
            )}

            <div className="flex items-center justify-between">
              <span className="font-bold text-amber-600 text-sm">
                {item.price.toFixed(2)} {t.currency}
              </span>

              {/* Add/Quantity controls */}
              {cartQty === 0 ? (
                <button
                  onClick={(e) => { e.stopPropagation(); addToCart(item) }}
                  className="flex items-center gap-1 px-3 py-1 bg-amber-500 text-white rounded-full text-xs font-medium hover:bg-amber-600 transition-colors"
                >
                  <Plus className="h-3 w-3" />
                  {t.addToCart}
                </button>
              ) : (
                <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => updateQuantity(item.id, '', -1)}
                    className="w-7 h-7 flex items-center justify-center bg-gray-100 dark:bg-gray-800 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                  >
                    <Minus className="h-3 w-3" />
                  </button>
                  <span className="font-bold text-sm w-5 text-center">{cartQty}</span>
                  <button
                    onClick={() => addToCart(item)}
                    className="w-7 h-7 flex items-center justify-center bg-amber-500 text-white rounded-full hover:bg-amber-600 transition-colors"
                  >
                    <Plus className="h-3 w-3" />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </motion.div>
    )
  }

  // ============================================
  // LOADING STATE
  // ============================================
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-amber-50 to-orange-50 dark:from-gray-950 dark:to-gray-900 flex items-center justify-center">
        <div className="text-center">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
            className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full mx-auto mb-4"
          />
          <p className="text-lg text-muted-foreground">{t.loading}</p>
        </div>
      </div>
    )
  }

  // ============================================
  // TABLE NOT FOUND
  // ============================================
  if (tableNotFound) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-amber-50 to-orange-50 dark:from-gray-950 dark:to-gray-900 flex items-center justify-center p-6">
        <div className="text-center">
          <AlertCircle className="h-16 w-16 text-red-400 mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-2">{t.tableNotFound}</h1>
          <p className="text-muted-foreground">{t.tryAgain}</p>
        </div>
      </div>
    )
  }

  // ============================================
  // ORDER SUCCESS + TRACKING
  // ============================================
  if (orderResult) {
    const statusLabel = {
      pending: t.pending,
      'in-progress': t.inProgress,
      ready: t.ready,
      completed: t.completed,
    }[orderStatus] || orderStatus

    return (
      <div className="min-h-screen bg-gradient-to-b from-emerald-50 to-green-50 dark:from-gray-950 dark:to-gray-900 flex items-center justify-center p-6">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="max-w-md w-full bg-white dark:bg-gray-900 rounded-3xl shadow-2xl p-8 text-center"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', delay: 0.2 }}
            className="w-20 h-20 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center mx-auto mb-6"
          >
            <Check className="h-10 w-10 text-emerald-600" />
          </motion.div>

          <h1 className="text-2xl font-bold mb-2">{t.orderSuccess}</h1>
          <p className="text-muted-foreground mb-6">{t.orderFromTable} {orderResult.tableNumber}</p>

          <div className="bg-amber-50 dark:bg-amber-900/20 rounded-2xl p-4 mb-6">
            <p className="text-sm text-muted-foreground mb-1">{t.orderNumber}</p>
            <p className="text-3xl font-bold text-amber-600">#{orderResult.orderNumber}</p>
          </div>

          <div className="space-y-3 mb-8">
            <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full ${statusColors[orderStatus] || 'bg-gray-100'}`}>
              <span className="text-lg">{statusIcons[orderStatus] || '⏳'}</span>
              <span className="font-medium">{statusLabel}</span>
            </div>

            {/* Progress bar */}
            <div className="w-full bg-gray-200 dark:bg-gray-800 rounded-full h-2 mt-2">
              <motion.div
                className="bg-emerald-500 h-2 rounded-full"
                initial={{ width: '0%' }}
                animate={{
                  width: orderStatus === 'pending' ? '25%'
                    : orderStatus === 'in-progress' ? '60%'
                    : orderStatus === 'ready' ? '90%'
                    : '100%'
                }}
                transition={{ duration: 1 }}
              />
            </div>

            <p className="text-xs text-muted-foreground mt-2">
              {t.statusAutoUpdates}
            </p>
          </div>

          <button
            onClick={() => {
              setOrderResult(null)
              setOrderStatus('')
            }}
            className="w-full py-3 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-semibold transition-colors"
          >
            {t.newOrder}
          </button>
        </motion.div>
      </div>
    )
  }

  // ============================================
  // MAIN MENU UI
  // ============================================
  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 to-orange-50 dark:from-gray-950 dark:to-gray-900 pb-24">
      {/* ====== HEADER ====== */}
      <header className="sticky top-0 z-40 bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl border-b border-amber-200/50 dark:border-gray-800">
        <div className="max-w-3xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-amber-500 rounded-xl flex items-center justify-center">
                <UtensilsCrossed className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="font-bold text-lg leading-tight">
                  {restaurant?.name || 'RestaurantOS'}
                </h1>
                <p className="text-xs text-muted-foreground">
                  {t.forTable} {t.table.toLowerCase()} · <span className="font-semibold text-amber-600">#{tableId.slice(-4)}</span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Call Waiter Button */}
              <button
                onClick={callWaiter}
                disabled={waiterCooldown}
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  waiterCooldown
                    ? 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500 cursor-not-allowed'
                    : 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 hover:bg-amber-200 dark:hover:bg-amber-900/50'
                }`}
                title={t.callWaiter}
              >
                <Bell className={`h-4 w-4 ${waiterCooldown ? 'animate-pulse' : ''}`} />
              </button>

              {/* Language Selector */}
              <div className="relative">
                <button
                  onClick={() => setLocaleOpen(!localeOpen)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-sm font-medium hover:bg-amber-200 dark:hover:bg-amber-900/50 transition-colors"
                >
                  <Globe className="h-4 w-4" />
                  <span>{locales.find(l => l.code === locale)?.flag}</span>
                </button>

                <AnimatePresence>
                  {localeOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: -10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -10, scale: 0.95 }}
                      className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-900 rounded-xl shadow-xl border border-gray-200 dark:border-gray-800 overflow-hidden z-50"
                    >
                      {locales.map(l => (
                        <button
                          key={l.code}
                          onClick={() => { setLocale(l.code); setLocaleOpen(false) }}
                          className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors ${locale === l.code ? 'bg-amber-50 dark:bg-amber-900/20 font-semibold' : ''}`}
                        >
                          <span className="text-lg">{l.flag}</span>
                          <span>{l.label}</span>
                          {locale === l.code && <Check className="h-4 w-4 ml-auto text-amber-500" />}
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>

          {/* Menu Tabs */}
          {menus.length > 1 && (
            <div className="flex gap-2 mt-3">
              {menus.map(menu => (
                <button
                  key={menu.id}
                  onClick={() => {
                    setActiveMenuId(menu.id)
                    setActiveSuperGroup('all')
                    setSearchQuery('')
                    const firstCat = menu.categories?.[0]
                    if (firstCat) setActiveCategoryId(firstCat.id)
                  }}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-all ${
                    activeMenuId === menu.id
                      ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/25'
                      : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-amber-50 dark:hover:bg-gray-700'
                  }`}
                >
                  <span>{menu.icon}</span>
                  {menu.name === 'Hrana' ? t.food : menu.name === 'Pijača' ? t.drinks : menu.name}
                </button>
              ))}
            </div>
          )}

          {/* Search Bar */}
          <div className="mt-3 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder={t.search}
              className="w-full pl-9 pr-9 py-2 text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-shadow"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {/* Super-Group Tabs (drinks menu only) */}
        {isDrinksMenu && !isSearching && (
          <div className="max-w-3xl mx-auto px-4 pb-1">
            <div className="flex gap-2 overflow-x-auto scrollbar-hide">
              <button
                onClick={() => {
                  setActiveSuperGroup('all')
                  const firstCat = allCategories?.[0]
                  if (firstCat) setActiveCategoryId(firstCat.id)
                }}
                className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all whitespace-nowrap ${
                  activeSuperGroup === 'all'
                    ? 'bg-amber-500 text-white'
                    : 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 hover:bg-amber-200 dark:hover:bg-amber-900/50'
                }`}
              >
                {t.menu}
              </button>
              {drinkSuperGroups.map(sg => (
                <button
                  key={sg.id}
                  onClick={() => {
                    setActiveSuperGroup(sg.id)
                    const filtered = allCategories.filter(cat => getSuperGroupForCategory(cat.name) === sg.id)
                    if (filtered.length > 0) setActiveCategoryId(filtered[0].id)
                  }}
                  className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all whitespace-nowrap ${
                    activeSuperGroup === sg.id
                      ? 'bg-amber-500 text-white'
                      : 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 hover:bg-amber-200 dark:hover:bg-amber-900/50'
                  }`}
                >
                  {t[sg.id as keyof typeof t] as string}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Category Pills */}
        {categories.length > 1 && !isSearching && (
          <div className="max-w-3xl mx-auto px-4 pb-2">
            <div className="flex gap-2 overflow-x-auto scrollbar-hide">
              {categories.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategoryId(cat.id)}
                  className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all whitespace-nowrap ${
                    activeCategoryId === cat.id
                      ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                  }`}
                >
                  {cat.icon} {cat.name}
                </button>
              ))}
            </div>
          </div>
        )}
      </header>

      {/* ====== MENU ITEMS ====== */}
      <main className="max-w-3xl mx-auto px-4 py-4">
        {isSearching ? (
          /* Search Results - flat list */
          <div>
            {searchResults.length > 0 ? (
              <>
                <p className="text-sm text-muted-foreground mb-3">
                  {t.searchResults.replace('{count}', String(searchResults.length))}
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {searchResults.map(item => renderMenuItem(item, item.categoryName))}
                </div>
              </>
            ) : (
              <div className="text-center py-12">
                <Search className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                <p className="text-muted-foreground">{t.emptyMenu}</p>
              </div>
            )}
          </div>
        ) : (
          /* Normal category view */
          <AnimatePresence mode="wait">
            <motion.div
              key={activeCategoryId}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.15 }}
            >
              {activeCategory?.menuItems?.length === 0 ? (
                <div className="text-center py-12">
                  <UtensilsCrossed className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-muted-foreground">{t.emptyMenu}</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {activeCategory?.menuItems?.map(item => renderMenuItem(item))}
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        )}

        {/* VAT note */}
        <p className="text-center text-xs text-muted-foreground mt-6">{t.vatIncluded}</p>
      </main>

      {/* ====== FLOATING CART BUTTON ====== */}
      {cartCount > 0 && !cartOpen && (
        <motion.div
          initial={{ y: 100 }}
          animate={{ y: 0 }}
          className="fixed bottom-0 left-0 right-0 z-50 p-4"
        >
          <div className="max-w-3xl mx-auto">
            <button
              onClick={() => setCartOpen(true)}
              className="w-full flex items-center justify-between bg-amber-500 hover:bg-amber-600 text-white py-4 px-6 rounded-2xl shadow-2xl shadow-amber-500/30 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="relative">
                  <ShoppingCart className="h-6 w-6" />
                  <span className="absolute -top-2 -right-2 w-5 h-5 bg-white text-amber-600 rounded-full text-xs font-bold flex items-center justify-center">
                    {cartCount}
                  </span>
                </div>
                <span className="font-semibold">
                  {cartCount} {cartCount === 1 ? t.item : t.items}
                </span>
              </div>
              <span className="text-lg font-bold">{cartTotal.toFixed(2)} {t.currency}</span>
            </button>
          </div>
        </motion.div>
      )}

      {/* ====== CART DRAWER ====== */}
      <AnimatePresence>
        {cartOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setCartOpen(false)}
              className="fixed inset-0 bg-black/50 z-50"
            />

            {/* Drawer */}
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="fixed inset-x-0 bottom-0 z-50 max-h-[90vh] bg-white dark:bg-gray-900 rounded-t-3xl shadow-2xl overflow-hidden flex flex-col"
            >
              {/* Handle */}
              <div className="flex justify-center pt-3 pb-1">
                <div className="w-10 h-1 bg-gray-300 rounded-full" />
              </div>

              {/* Header */}
              <div className="flex items-center justify-between px-6 py-3">
                <h2 className="text-xl font-bold">{t.cart}</h2>
                <button onClick={() => setCartOpen(false)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full">
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Cart Items */}
              <div className="flex-1 overflow-y-auto px-6 pb-4 custom-scrollbar">
                {cart.length === 0 ? (
                  <div className="text-center py-8">
                    <ShoppingCart className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-muted-foreground">{t.empty}</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {cart.map((c, i) => (
                      <motion.div
                        key={`${c.menuItemId}-${c.notes}-${i}`}
                        layout
                        className="flex items-center gap-3 bg-gray-50 dark:bg-gray-800 rounded-xl p-3"
                      >
                        {c.image && (
                          <img src={c.image} alt={c.name} className="w-12 h-12 rounded-lg object-cover flex-shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium text-sm truncate">{c.name}</h4>
                          <p className="text-xs text-muted-foreground">{c.price.toFixed(2)} {t.currency}</p>
                          {c.notes && (
                            <p className="text-xs text-amber-600 mt-0.5">📝 {c.notes}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => updateQuantity(c.menuItemId, c.notes, -1)}
                            className="w-7 h-7 flex items-center justify-center bg-white dark:bg-gray-700 rounded-full border border-gray-200 dark:border-gray-600"
                          >
                            <Minus className="h-3 w-3" />
                          </button>
                          <span className="font-bold text-sm w-5 text-center">{c.quantity}</span>
                          <button
                            onClick={() => updateQuantity(c.menuItemId, c.notes, 1)}
                            className="w-7 h-7 flex items-center justify-center bg-amber-500 text-white rounded-full"
                          >
                            <Plus className="h-3 w-3" />
                          </button>
                          <button
                            onClick={() => removeItem(c.menuItemId, c.notes)}
                            className="p-1 text-red-400 hover:text-red-600 ml-1"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}

                {/* Customer Info */}
                {cart.length > 0 && (
                  <div className="space-y-3 mt-4 pt-4 border-t border-gray-200 dark:border-gray-800">
                    <div className="flex gap-3">
                      <div className="flex-1">
                        <label className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                          <User className="h-3 w-3" /> {t.name}
                        </label>
                        <input
                          type="text"
                          value={customerName}
                          onChange={e => setCustomerName(e.target.value)}
                          placeholder={t.optional}
                          className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500"
                        />
                      </div>
                      <div className="flex-1">
                        <label className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                          <Phone className="h-3 w-3" /> {t.phone}
                        </label>
                        <input
                          type="tel"
                          value={customerPhone}
                          onChange={e => setCustomerPhone(e.target.value)}
                          placeholder="+386"
                          className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                        <MessageSquare className="h-3 w-3" /> {t.orderNotes}
                      </label>
                      <input
                        type="text"
                        value={orderNotes}
                        onChange={e => setOrderNotes(e.target.value)}
                        placeholder={t.notePlaceholder}
                        className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Cart Footer */}
              {cart.length > 0 && (
                <div className="border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-6 py-4">
                  {/* Totals */}
                  <div className="space-y-1 mb-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{t.subtotal}</span>
                      <span>{(cartTotal - cartTax).toFixed(2)} {t.currency}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{t.vat}</span>
                      <span>{cartTax.toFixed(2)} {t.currency}</span>
                    </div>
                    <div className="flex justify-between text-lg font-bold pt-1 border-t border-gray-200 dark:border-gray-800">
                      <span>{t.total}</span>
                      <span className="text-amber-600">{cartTotal.toFixed(2)} {t.currency}</span>
                    </div>
                  </div>

                  {/* Order Button */}
                  <button
                    onClick={submitOrder}
                    disabled={submitting}
                    className="w-full py-3.5 bg-amber-500 hover:bg-amber-600 disabled:bg-amber-300 text-white rounded-xl font-semibold text-lg transition-colors flex items-center justify-center gap-2"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="h-5 w-5 animate-spin" />
                        {t.ordering}
                      </>
                    ) : (
                      <>
                        {t.confirmOrder}
                        <ChevronRight className="h-5 w-5" />
                      </>
                    )}
                  </button>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ====== ITEM DETAIL MODAL ====== */}
      <AnimatePresence>
        {detailItem && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDetailItem(null)}
              className="fixed inset-0 bg-black/50 z-50"
            />

            {/* Modal */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="fixed inset-x-0 bottom-0 z-50 max-h-[85vh] bg-white dark:bg-gray-900 rounded-t-3xl shadow-2xl overflow-hidden flex flex-col"
            >
              {/* Handle */}
              <div className="flex justify-center pt-3 pb-1">
                <div className="w-10 h-1 bg-gray-300 rounded-full" />
              </div>

              {/* Close button */}
              <div className="flex justify-end px-4 pb-1">
                <button
                  onClick={() => setDetailItem(null)}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto px-6 pb-6">
                {/* Image */}
                {detailItem.image && (
                  <div className="w-full h-48 rounded-2xl overflow-hidden mb-4">
                    <img
                      src={detailItem.image}
                      alt={detailItem.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}

                {/* Name & Price */}
                <div className="flex items-start justify-between mb-3">
                  <h2 className="text-xl font-bold flex-1 pr-3">{detailItem.name}</h2>
                  <span className="text-xl font-bold text-amber-600 flex-shrink-0">
                    {detailItem.price.toFixed(2)} {t.currency}
                  </span>
                </div>

                {/* Description */}
                {detailItem.description && (
                  <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
                    {detailItem.description}
                  </p>
                )}

                {/* Allergens */}
                {detailItem.allergens && (
                  <div className="mb-4">
                    <p className="text-xs text-muted-foreground mb-2 font-medium">{t.allergens}</p>
                    <div className="flex flex-wrap gap-2">
                      {detailItem.allergens.split(',').map(a => {
                        const trimmed = a.trim()
                        return (
                          <span
                            key={trimmed}
                            className="inline-flex items-center gap-1 px-2 py-1 bg-amber-50 dark:bg-amber-900/20 rounded-lg text-xs"
                          >
                            <span>{allergenLabels[trimmed] || '🏷️'}</span>
                            <span className="text-muted-foreground">#{trimmed}</span>
                          </span>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Note Input */}
                <div className="mb-4">
                  <label className="text-xs text-muted-foreground mb-1.5 flex items-center gap-1 font-medium">
                    <MessageSquare className="h-3 w-3" /> {t.addItemNote}
                  </label>
                  <input
                    type="text"
                    value={detailNote}
                    onChange={e => setDetailNote(e.target.value)}
                    placeholder={t.notePlaceholder}
                    className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                {/* Cart quantity for this item */}
                {(() => {
                  const cartQty = cart
                    .filter(c => c.menuItemId === detailItem.id)
                    .reduce((sum, c) => sum + c.quantity, 0)
                  return cartQty > 0 ? (
                    <p className="text-xs text-muted-foreground mb-3">
                      {t.quantity}: {cartQty}
                    </p>
                  ) : null
                })()}
              </div>

              {/* Add to Cart Button */}
              <div className="border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-6 py-4">
                <button
                  onClick={() => {
                    if (detailNote.trim()) {
                      addToCartWithNote(detailItem, detailNote)
                    } else {
                      addToCart(detailItem)
                    }
                    setDetailItem(null)
                    setDetailNote('')
                  }}
                  className="w-full py-3.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-semibold text-lg transition-colors flex items-center justify-center gap-2"
                >
                  <Plus className="h-5 w-5" />
                  {t.addToCart}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ====== ERROR TOAST ====== */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-24 left-4 right-4 z-50 max-w-3xl mx-auto"
          >
            <div className="bg-red-500 text-white px-4 py-3 rounded-xl flex items-center gap-3 shadow-lg">
              <AlertCircle className="h-5 w-5 flex-shrink-0" />
              <span className="text-sm flex-1">{error}</span>
              <button onClick={() => setError(null)} className="text-white/80 hover:text-white">
                <X className="h-4 w-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ====== WAITER CALLED TOAST ====== */}
      <AnimatePresence>
        {waiterCalled && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-24 left-4 right-4 z-50 max-w-3xl mx-auto"
          >
            <div className="bg-emerald-500 text-white px-4 py-3 rounded-xl flex items-center gap-3 shadow-lg">
              <Bell className="h-5 w-5 flex-shrink-0" />
              <span className="text-sm font-medium">{t.waiterCalled}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
