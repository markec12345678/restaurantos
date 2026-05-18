'use client'

import { useState, useEffect, useCallback, useRef } from 'react'

// =====================================================================
// RESTAURANTOS ONLINE ORDERING PLATFORM
// Spletna naročilna platforma — dostava ali prevzem z online plačilom
// Ekvivalent Toast Online Ordering / Square Online za Slovenijo
// =====================================================================

interface Modifier {
  id: string
  name: string
  price: number
}

interface ModifierGroup {
  id: string
  name: string
  required: boolean
  minSelect: number
  maxSelect: number | null
  modifiers: Modifier[]
}

interface MenuItem {
  id: string
  name: string
  description: string
  price: number
  vatRate: number
  allergens: string
  image: string
  sortOrder: number
  modifierGroups: { sortOrder: number; modifierGroup: ModifierGroup }[]
}

interface Category {
  id: string
  name: string
  icon: string
  color: string
  sortOrder: number
  menuItems: MenuItem[]
}

interface Menu {
  id: string
  name: string
  icon: string
  color: string
  sortOrder: number
  categories: Category[]
}

interface CartItem {
  menuItem: MenuItem
  quantity: number
  selectedModifiers: Modifier[]
  notes: string
}

type OrderType = 'delivery' | 'takeout'
type CheckoutStep = 'menu' | 'cart' | 'details' | 'payment' | 'confirmation'

interface DeliveryDetails {
  fullName: string
  phone: string
  email: string
  address: string
  city: string
  postCode: string
  notes: string
}

interface TakeoutDetails {
  fullName: string
  phone: string
  email: string
  notes: string
  preferredTime: string
}

const ALLERGEN_DATA: Record<string, { label: string; icon: string }> = {
  '1': { label: 'Gluten', icon: '🌾' },
  '2': { label: 'Raki', icon: '🦐' },
  '3': { label: 'Jajca', icon: '🥚' },
  '4': { label: 'Ribe', icon: '🐟' },
  '5': { label: 'Arašidi', icon: '🥜' },
  '6': { label: 'Soja', icon: '🫘' },
  '7': { label: 'Mleko', icon: '🥛' },
  '8': { label: 'Oreški', icon: '🌰' },
  '9': { label: 'Zeler', icon: '🥬' },
  '10': { label: 'Gorčica', icon: '🟡' },
  '11': { label: 'Sezam', icon: '⚪' },
  '12': { label: 'Sulfiti', icon: '💨' },
  '13': { label: 'Volčji bob', icon: '🫘' },
  '14': { label: 'Mehkužci', icon: '🐚' },
}

const DELIVERY_FEE = 2.50
const MIN_ORDER_AMOUNT = 10.00
const ESTIMATED_DELIVERY_MIN = 30
const ESTIMATED_TAKEOUT_MIN = 15

export default function OnlineOrderPage() {
  const [menus, setMenus] = useState<Menu[]>([])
  const [settings, setSettings] = useState<any>(null)
  const [activeMenu, setActiveMenu] = useState<string>('')
  const [activeCategory, setActiveCategory] = useState<string>('')
  const [cart, setCart] = useState<CartItem[]>([])
  const [loading, setLoading] = useState(true)
  const [orderType, setOrderType] = useState<OrderType>('delivery')
  const [step, setStep] = useState<CheckoutStep>('menu')
  const [searchQuery, setSearchQuery] = useState('')
  const [isDark, setIsDark] = useState(false)

  // Checkout podatki
  const [deliveryDetails, setDeliveryDetails] = useState<DeliveryDetails>({
    fullName: '', phone: '', email: '', address: '', city: '', postCode: '', notes: '',
  })
  const [takeoutDetails, setTakeoutDetails] = useState<TakeoutDetails>({
    fullName: '', phone: '', email: '', notes: '', preferredTime: '',
  })
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'cash' | 'mobile'>('card')
  const [orderSending, setOrderSending] = useState(false)
  const [orderResult, setOrderResult] = useState<any>(null)

  // Item detail modal
  const [showItemDetail, setShowItemDetail] = useState<MenuItem | null>(null)
  const [itemNotes, setItemNotes] = useState('')
  const [selectedMods, setSelectedMods] = useState<Modifier[]>([])

  useEffect(() => {
    fetchMenu()
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    setIsDark(prefersDark)
  }, [])

  async function fetchMenu() {
    try {
      const res = await fetch('/api/public/menu')
      const data = await res.json()
      setMenus(data.menus || [])
      setSettings(data.settings || {})
      if (data.menus?.length > 0) {
        setActiveMenu(data.menus[0].id)
        setActiveCategory(data.menus[0].categories?.[0]?.id || '')
      }
    } catch (e) {
      console.error('Error loading menu:', e)
    } finally {
      setLoading(false)
    }
  }

  const addToCart = useCallback((item: MenuItem, modifiers: Modifier[] = [], notes: string = '') => {
    setCart(prev => {
      const key = `${item.id}-${modifiers.map(m => m.id).sort().join(',')}`
      const existing = prev.findIndex(c =>
        `${c.menuItem.id}-${c.selectedModifiers.map(m => m.id).sort().join(',')}` === key
      )
      if (existing >= 0) {
        const updated = [...prev]
        updated[existing] = { ...updated[existing], quantity: updated[existing].quantity + 1 }
        return updated
      }
      return [...prev, { menuItem: item, quantity: 1, selectedModifiers: modifiers, notes }]
    })
    setShowItemDetail(null)
    setItemNotes('')
    setSelectedMods([])
  }, [])

  const removeFromCart = useCallback((index: number) => {
    setCart(prev => prev.filter((_, i) => i !== index))
  }, [])

  const updateQuantity = useCallback((index: number, delta: number) => {
    setCart(prev => {
      const updated = [...prev]
      updated[index] = { ...updated[index], quantity: updated[index].quantity + delta }
      if (updated[index].quantity <= 0) updated.splice(index, 1)
      return updated
    })
  }, [])

  function getSubtotal() {
    return cart.reduce((sum, item) => {
      const modPrice = item.selectedModifiers.reduce((s, m) => s + (m.price || 0), 0)
      return sum + (item.menuItem.price + modPrice) * item.quantity
    }, 0)
  }

  function getTotal() {
    const sub = getSubtotal()
    const vat = cart.reduce((sum, item) => {
      const modPrice = item.selectedModifiers.reduce((s, m) => s + (m.price || 0), 0)
      const basePrice = item.menuItem.price + modPrice
      return sum + basePrice * (item.menuItem.vatRate / 100) * item.quantity
    }, 0)
    const deliveryFee = orderType === 'delivery' && sub > 0 ? DELIVERY_FEE : 0
    return sub + vat + deliveryFee
  }

  function toggleModifier(mod: Modifier, group: ModifierGroup) {
    setSelectedMods(prev => {
      const groupMods = prev.filter(m => group.modifiers.some(gm => gm.id === m.id))
      const otherMods = prev.filter(m => !group.modifiers.some(gm => gm.id === m.id))
      const exists = groupMods.find(m => m.id === mod.id)
      if (exists) return [...otherMods, ...groupMods.filter(m => m.id !== mod.id)]
      if (group.maxSelect && groupMods.length >= group.maxSelect) {
        const updated = [...groupMods.slice(1), mod]
        return [...otherMods, ...updated]
      }
      return [...otherMods, mod]
    })
  }

  async function placeOrder() {
    if (cart.length === 0) return
    setOrderSending(true)
    try {
      const orderItems = cart.map(item => ({
        menuItemId: item.menuItem.id,
        quantity: item.quantity,
        price: item.menuItem.price,
        vatRate: item.menuItem.vatRate,
        notes: item.notes,
        modifiersJson: JSON.stringify(item.selectedModifiers),
      }))

      const details = orderType === 'delivery'
        ? { ...deliveryDetails, type: 'delivery' }
        : { ...takeoutDetails, type: 'takeout' }

      const res = await fetch('/api/public/online-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderType,
          items: orderItems,
          paymentMethod,
          customer: details,
          deliveryFee: orderType === 'delivery' ? DELIVERY_FEE : 0,
        }),
      })

      const data = await res.json()
      if (res.ok && data.success) {
        setCart([])
        setOrderResult(data)
        setStep('confirmation')
      } else {
        alert(data.error || 'Napaka pri naročanju')
      }
    } catch (e) {
      console.error('Order error:', e)
      alert('Povezava ni na voljo. Poskusite znova.')
    } finally {
      setOrderSending(false)
    }
  }

  const currentMenu = menus.find(m => m.id === activeMenu)
  const currentCategory = currentMenu?.categories.find(c => c.id === activeCategory)
  const filteredItems = searchQuery && currentCategory
    ? currentCategory.menuItems.filter(item =>
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.description.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : currentCategory?.menuItems || []
  const cartItemCount = cart.reduce((s, i) => s + i.quantity, 0)
  const subtotal = getSubtotal()
  const total = getTotal()

  // ==================== LOADING ====================
  if (loading) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${isDark ? 'bg-gray-950' : 'bg-gradient-to-b from-blue-50 to-indigo-50'}`}>
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className={`text-lg font-semibold ${isDark ? 'text-blue-400' : 'text-blue-800'}`}>Nalagam meni...</p>
        </div>
      </div>
    )
  }

  // ==================== CONFIRMATION ====================
  if (step === 'confirmation' && orderResult) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${isDark ? 'bg-gray-950' : 'bg-gradient-to-b from-green-50 to-emerald-50'}`}>
        <div className={`max-w-md mx-auto p-8 rounded-3xl shadow-2xl text-center ${isDark ? 'bg-gray-900' : 'bg-white'}`}>
          <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
            <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-green-700 mb-2">Naročilo sprejeto!</h2>
          <p className="text-gray-600 mb-1">Številka naročila:</p>
          <p className="text-3xl font-mono font-bold text-blue-600 mb-3">#{orderResult.order?.orderNumber}</p>
          <p className="text-gray-500 text-sm mb-2">
            {orderType === 'delivery'
              ? `Predviden čas dostave: ${ESTIMATED_DELIVERY_MIN}-${ESTIMATED_DELIVERY_MIN + 15} min`
              : `Prevzem čez: ${ESTIMATED_TAKEOUT_MIN}-${ESTIMATED_TAKEOUT_MIN + 10} min`}
          </p>
          {orderType === 'delivery' && (
            <p className="text-gray-500 text-sm">Dostava na: {deliveryDetails.address}, {deliveryDetails.city}</p>
          )}
          <p className="text-lg font-bold text-green-700 mt-4">Skupaj: €{total.toFixed(2)}</p>
          <div className="mt-2 text-sm text-gray-500">
            {paymentMethod === 'card' && 'Plačilo s kartico ✓'}
            {paymentMethod === 'cash' && 'Plačilo ob prevzemu (gotovina)'}
            {paymentMethod === 'mobile' && 'Plačilo z mobilno napravo ✓'}
          </div>
          <button
            onClick={() => { setStep('menu'); setOrderResult(null); }}
            className="mt-6 bg-blue-600 text-white px-8 py-3 rounded-2xl font-semibold hover:bg-blue-700 transition"
          >
            Naroči še
          </button>
        </div>
      </div>
    )
  }

  // ==================== MAIN APP ====================
  return (
    <div className={`min-h-screen ${isDark ? 'bg-gray-950 text-gray-100' : 'bg-gradient-to-b from-blue-50 via-white to-indigo-50 text-gray-900'}`}>

      {/* ===== HEADER ===== */}
      <header className={`sticky top-0 z-40 ${isDark ? 'bg-gray-900/90' : 'bg-white/80'} backdrop-blur-xl border-b ${isDark ? 'border-gray-800' : 'border-blue-100'} shadow-sm`}>
        <div className="max-w-4xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div>
              <h1 className={`text-xl font-bold ${isDark ? 'text-blue-400' : 'text-blue-900'}`}>
                {settings?.name || 'RestaurantOS'}
              </h1>
              <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>Online naročanje</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsDark(!isDark)}
                className={`p-2 rounded-xl ${isDark ? 'bg-gray-800 text-gray-400' : 'bg-blue-50 text-blue-700'} transition`}
              >
                {isDark ? '☀️' : '🌙'}
              </button>
              {/* Cart button */}
              <button
                onClick={() => setStep(step === 'cart' ? 'menu' : 'cart')}
                className="relative bg-blue-600 text-white p-3 rounded-xl shadow-lg hover:bg-blue-700 transition"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z" />
                </svg>
                {cartItemCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center animate-bounce">
                    {cartItemCount}
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* Order type toggle */}
          {step === 'menu' && (
            <div className="mt-3 flex gap-2">
              <button
                onClick={() => setOrderType('delivery')}
                className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition ${
                  orderType === 'delivery'
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                    : `${isDark ? 'bg-gray-800 text-gray-400' : 'bg-blue-50 text-blue-600'}`
                }`}
              >
                🚗 Dostava
              </button>
              <button
                onClick={() => setOrderType('takeout')}
                className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition ${
                  orderType === 'takeout'
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                    : `${isDark ? 'bg-gray-800 text-gray-400' : 'bg-blue-50 text-blue-600'}`
                }`}
              >
                🛍 Prevzem
              </button>
            </div>
          )}

          {/* Search */}
          {step === 'menu' && (
            <div className="mt-3 relative">
              <svg className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${isDark ? 'text-gray-500' : 'text-blue-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="search"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Išči po meniju..."
                className={`w-full pl-9 pr-4 py-2.5 rounded-xl text-sm ${isDark ? 'bg-gray-800 border-gray-700 text-white' : 'bg-white/80 border-blue-200 text-gray-900'} border focus:outline-none focus:ring-2 focus:ring-blue-500/50`}
              />
            </div>
          )}

          {/* Progress steps */}
          {step !== 'menu' && step !== 'confirmation' && (
            <div className="mt-3 flex items-center gap-1 text-xs">
              {['menu', 'cart', 'details', 'payment'].map((s, i) => (
                <div key={s} className="flex items-center gap-1">
                  {i > 0 && <div className={`w-6 h-0.5 ${step === s || ['cart','details','payment'].indexOf(step) >= i ? 'bg-blue-600' : 'bg-gray-300'}`} />}
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${
                    step === s ? 'bg-blue-600 text-white' : ['cart','details','payment'].indexOf(step) > i ? 'bg-green-500 text-white' : `${isDark ? 'bg-gray-700 text-gray-400' : 'bg-gray-200 text-gray-500'}`
                  }`}>
                    {['cart','details','payment'].indexOf(step) > i ? '✓' : i + 1}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </header>

      {/* ===== MENU STEP ===== */}
      {step === 'menu' && (
        <main className="max-w-4xl mx-auto px-4 pb-28">
          {/* Info banner */}
          <div className={`mt-4 p-3 rounded-xl ${isDark ? 'bg-blue-900/30 border border-blue-800' : 'bg-blue-50 border border-blue-200'} text-sm`}>
            <div className="flex items-center gap-2">
              <span>{orderType === 'delivery' ? '🚗' : '🛍'}</span>
              <span className={isDark ? 'text-blue-300' : 'text-blue-700'}>
                {orderType === 'delivery'
                  ? `Dostava ${DELIVERY_FEE.toFixed(2)} € • Min. naročilo ${MIN_ORDER_AMOUNT.toFixed(2)} € • ${ESTIMATED_DELIVERY_MIN}-${ESTIMATED_DELIVERY_MIN + 15} min`
                  : `Prevzem na lokaciji • ${ESTIMATED_TAKEOUT_MIN}-${ESTIMATED_TAKEOUT_MIN + 10} min`}
              </span>
            </div>
          </div>

          {/* Category tabs */}
          {currentMenu && (
            <nav className="mt-4 flex gap-2 overflow-x-auto pb-2">
              {currentMenu.categories.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id)}
                  className={`flex-shrink-0 px-4 py-2 rounded-xl text-sm font-semibold transition ${
                    activeCategory === cat.id
                      ? 'bg-blue-600 text-white shadow-md'
                      : `${isDark ? 'bg-gray-800 text-gray-400' : 'bg-white text-gray-600 shadow-sm'}`
                  }`}
                >
                  {cat.icon} {cat.name}
                </button>
              ))}
            </nav>
          )}

          {/* Menu items */}
          <div className="mt-4 space-y-3">
            {filteredItems.map(item => {
              const allergenNums = item.allergens ? item.allergens.split(',').filter(Boolean) : []
              const inCart = cart.filter(c => c.menuItem.id === item.id).reduce((s, c) => s + c.quantity, 0)
              const priceWithVat = item.price * (1 + item.vatRate / 100)

              return (
                <div
                  key={item.id}
                  className={`${isDark ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-100'} rounded-2xl border shadow-sm flex overflow-hidden cursor-pointer hover:shadow-md transition`}
                  onClick={() => { setShowItemDetail(item); setItemNotes(''); setSelectedMods([]) }}
                >
                  {item.image ? (
                    <div className="flex-shrink-0 w-24 h-28">
                      <img src={item.image} alt={item.name} className="w-full h-full object-cover" loading="lazy" />
                    </div>
                  ) : (
                    <div className={`flex-shrink-0 w-24 h-28 flex items-center justify-center ${isDark ? 'bg-gray-800' : 'bg-blue-50'}`}>
                      <span className="text-3xl">🍽</span>
                    </div>
                  )}
                  <div className="flex-1 p-3 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-bold text-sm leading-tight">{item.name}</h3>
                      {inCart > 0 && (
                        <span className="flex-shrink-0 bg-blue-600 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
                          {inCart}
                        </span>
                      )}
                    </div>
                    {item.description && (
                      <p className={`text-xs mt-0.5 line-clamp-2 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{item.description}</p>
                    )}
                    {allergenNums.length > 0 && (
                      <div className="flex flex-wrap gap-0.5 mt-1">
                        {allergenNums.slice(0, 5).map(a => {
                          const ad = ALLERGEN_DATA[a.trim()]
                          return ad ? <span key={a} className="text-[9px]" title={ad.label}>{ad.icon}</span> : null
                        })}
                      </div>
                    )}
                    <div className="flex items-end justify-between gap-2 mt-2">
                      <span className={`font-bold ${isDark ? 'text-blue-400' : 'text-blue-700'}`}>€{priceWithVat.toFixed(2)}</span>
                      <button
                        onClick={(e) => { e.stopPropagation(); addToCart(item) }}
                        className="bg-blue-600 text-white rounded-xl p-2 shadow-md hover:bg-blue-700 active:scale-90 transition"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Floating cart bar */}
          {cartItemCount > 0 && (
            <div className="fixed bottom-4 left-4 right-4 z-30 max-w-4xl mx-auto">
              <button
                onClick={() => setStep('cart')}
                className={`w-full ${isDark ? 'bg-blue-600' : 'bg-blue-600'} text-white py-4 px-6 rounded-2xl shadow-2xl shadow-blue-600/30 flex items-center justify-between font-bold hover:bg-blue-700 transition`}
              >
                <span className="flex items-center gap-2">
                  <span className="bg-white/20 rounded-lg px-2 py-0.5 text-sm">{cartItemCount}</span>
                  Košarica
                </span>
                <span>€{total.toFixed(2)}</span>
              </button>
            </div>
          )}
        </main>
      )}

      {/* ===== CART STEP ===== */}
      {step === 'cart' && (
        <main className="max-w-4xl mx-auto px-4 py-4 space-y-4">
          <h2 className="text-lg font-bold">Košarica</h2>
          {cart.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-4xl mb-2">🛒</p>
              <p className="text-gray-500">Košarica je prazna</p>
              <button onClick={() => setStep('menu')} className="mt-4 text-blue-600 font-semibold">Nazaj na meni</button>
            </div>
          ) : (
            <>
              {cart.map((item, idx) => {
                const modPrice = item.selectedModifiers.reduce((s, m) => s + (m.price || 0), 0)
                const priceWithVat = (item.menuItem.price + modPrice) * (1 + item.menuItem.vatRate / 100)
                return (
                  <div key={idx} className={`${isDark ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-100'} rounded-xl border p-3`}>
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm">{item.menuItem.name}</p>
                        {item.selectedModifiers.length > 0 && (
                          <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                            + {item.selectedModifiers.map(m => m.name).join(', ')}
                          </p>
                        )}
                        {item.notes && <p className={`text-xs italic ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{item.notes}</p>}
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1">
                          <button onClick={() => updateQuantity(idx, -1)} className={`w-7 h-7 rounded-lg ${isDark ? 'bg-gray-800 text-gray-300' : 'bg-gray-100 text-gray-600'} flex items-center justify-center text-sm font-bold`}>-</button>
                          <span className="w-6 text-center font-bold text-sm">{item.quantity}</span>
                          <button onClick={() => updateQuantity(idx, 1)} className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center text-sm font-bold">+</button>
                        </div>
                        <span className="font-bold text-sm w-16 text-right">€{(priceWithVat * item.quantity).toFixed(2)}</span>
                        <button onClick={() => removeFromCart(idx)} className="text-red-400 hover:text-red-600 text-sm">✕</button>
                      </div>
                    </div>
                  </div>
                )
              })}

              {/* Summary */}
              <div className={`${isDark ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-100'} rounded-xl border p-4 space-y-2`}>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Vmesna vsota (z DDV)</span>
                  <span>€{(subtotal + cart.reduce((sum, item) => {
                    const modPrice = item.selectedModifiers.reduce((s, m) => s + (m.price || 0), 0)
                    return sum + (item.menuItem.price + modPrice) * (item.menuItem.vatRate / 100) * item.quantity
                  }, 0) - subtotal).toFixed(2)}</span>
                </div>
                {orderType === 'delivery' && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Dostava</span>
                    <span>€{DELIVERY_FEE.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-lg pt-2 border-t">
                  <span>Skupaj</span>
                  <span className="text-blue-600">€{total.toFixed(2)}</span>
                </div>
                {orderType === 'delivery' && subtotal < MIN_ORDER_AMOUNT && (
                  <p className="text-xs text-amber-600">Min. naročilo za dostavo: €{MIN_ORDER_AMOUNT.toFixed(2)}</p>
                )}
              </div>

              <div className="flex gap-3">
                <button onClick={() => setStep('menu')} className={`flex-1 py-3 rounded-xl font-semibold ${isDark ? 'bg-gray-800 text-gray-300' : 'bg-gray-100 text-gray-600'}`}>
                  ← Meni
                </button>
                <button
                  onClick={() => setStep('details')}
                  disabled={orderType === 'delivery' && subtotal < MIN_ORDER_AMOUNT}
                  className="flex-1 py-3 rounded-xl font-semibold bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Nadaljuj →
                </button>
              </div>
            </>
          )}
        </main>
      )}

      {/* ===== DETAILS STEP ===== */}
      {step === 'details' && (
        <main className="max-w-4xl mx-auto px-4 py-4 space-y-4">
          <h2 className="text-lg font-bold">{orderType === 'delivery' ? '📦 Podatki za dostavo' : '🛍 Podatki za prevzem'}</h2>

          {orderType === 'delivery' ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <input type="text" placeholder="Ime in priimek *" value={deliveryDetails.fullName} onChange={e => setDeliveryDetails(p => ({ ...p, fullName: e.target.value }))} className={`col-span-2 px-4 py-3 rounded-xl text-sm ${isDark ? 'bg-gray-800 border-gray-700 text-white' : 'bg-white border-gray-200'} border focus:ring-2 focus:ring-blue-500/50 focus:outline-none`} />
                <input type="tel" placeholder="Telefon *" value={deliveryDetails.phone} onChange={e => setDeliveryDetails(p => ({ ...p, phone: e.target.value }))} className={`px-4 py-3 rounded-xl text-sm ${isDark ? 'bg-gray-800 border-gray-700 text-white' : 'bg-white border-gray-200'} border focus:ring-2 focus:ring-blue-500/50 focus:outline-none`} />
                <input type="email" placeholder="E-pošta" value={deliveryDetails.email} onChange={e => setDeliveryDetails(p => ({ ...p, email: e.target.value }))} className={`px-4 py-3 rounded-xl text-sm ${isDark ? 'bg-gray-800 border-gray-700 text-white' : 'bg-white border-gray-200'} border focus:ring-2 focus:ring-blue-500/50 focus:outline-none`} />
                <input type="text" placeholder="Naslov *" value={deliveryDetails.address} onChange={e => setDeliveryDetails(p => ({ ...p, address: e.target.value }))} className={`col-span-2 px-4 py-3 rounded-xl text-sm ${isDark ? 'bg-gray-800 border-gray-700 text-white' : 'bg-white border-gray-200'} border focus:ring-2 focus:ring-blue-500/50 focus:outline-none`} />
                <input type="text" placeholder="Mesto *" value={deliveryDetails.city} onChange={e => setDeliveryDetails(p => ({ ...p, city: e.target.value }))} className={`px-4 py-3 rounded-xl text-sm ${isDark ? 'bg-gray-800 border-gray-700 text-white' : 'bg-white border-gray-200'} border focus:ring-2 focus:ring-blue-500/50 focus:outline-none`} />
                <input type="text" placeholder="Poštna št. *" value={deliveryDetails.postCode} onChange={e => setDeliveryDetails(p => ({ ...p, postCode: e.target.value }))} className={`px-4 py-3 rounded-xl text-sm ${isDark ? 'bg-gray-800 border-gray-700 text-white' : 'bg-white border-gray-200'} border focus:ring-2 focus:ring-blue-500/50 focus:outline-none`} />
              </div>
              <textarea placeholder="Opombe za dostavo (zvonec, nadstropje...)" value={deliveryDetails.notes} onChange={e => setDeliveryDetails(p => ({ ...p, notes: e.target.value }))} rows={2} className={`w-full px-4 py-3 rounded-xl text-sm ${isDark ? 'bg-gray-800 border-gray-700 text-white' : 'bg-white border-gray-200'} border focus:ring-2 focus:ring-blue-500/50 focus:outline-none`} />
            </div>
          ) : (
            <div className="space-y-3">
              <input type="text" placeholder="Ime in priimek *" value={takeoutDetails.fullName} onChange={e => setTakeoutDetails(p => ({ ...p, fullName: e.target.value }))} className={`w-full px-4 py-3 rounded-xl text-sm ${isDark ? 'bg-gray-800 border-gray-700 text-white' : 'bg-white border-gray-200'} border focus:ring-2 focus:ring-blue-500/50 focus:outline-none`} />
              <div className="grid grid-cols-2 gap-3">
                <input type="tel" placeholder="Telefon *" value={takeoutDetails.phone} onChange={e => setTakeoutDetails(p => ({ ...p, phone: e.target.value }))} className={`px-4 py-3 rounded-xl text-sm ${isDark ? 'bg-gray-800 border-gray-700 text-white' : 'bg-white border-gray-200'} border focus:ring-2 focus:ring-blue-500/50 focus:outline-none`} />
                <input type="email" placeholder="E-pošta" value={takeoutDetails.email} onChange={e => setTakeoutDetails(p => ({ ...p, email: e.target.value }))} className={`px-4 py-3 rounded-xl text-sm ${isDark ? 'bg-gray-800 border-gray-700 text-white' : 'bg-white border-gray-200'} border focus:ring-2 focus:ring-blue-500/50 focus:outline-none`} />
              </div>
              <input type="time" placeholder="Želen čas prevzema" value={takeoutDetails.preferredTime} onChange={e => setTakeoutDetails(p => ({ ...p, preferredTime: e.target.value }))} className={`w-full px-4 py-3 rounded-xl text-sm ${isDark ? 'bg-gray-800 border-gray-700 text-white' : 'bg-white border-gray-200'} border focus:ring-2 focus:ring-blue-500/50 focus:outline-none`} />
              <textarea placeholder="Opombe" value={takeoutDetails.notes} onChange={e => setTakeoutDetails(p => ({ ...p, notes: e.target.value }))} rows={2} className={`w-full px-4 py-3 rounded-xl text-sm ${isDark ? 'bg-gray-800 border-gray-700 text-white' : 'bg-white border-gray-200'} border focus:ring-2 focus:ring-blue-500/50 focus:outline-none`} />
            </div>
          )}

          <div className="flex gap-3">
            <button onClick={() => setStep('cart')} className={`flex-1 py-3 rounded-xl font-semibold ${isDark ? 'bg-gray-800 text-gray-300' : 'bg-gray-100 text-gray-600'}`}>
              ← Košarica
            </button>
            <button
              onClick={() => setStep('payment')}
              disabled={orderType === 'delivery' ? !deliveryDetails.fullName || !deliveryDetails.phone || !deliveryDetails.address || !deliveryDetails.city : !takeoutDetails.fullName || !takeoutDetails.phone}
              className="flex-1 py-3 rounded-xl font-semibold bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
            >
              Plačilo →
            </button>
          </div>
        </main>
      )}

      {/* ===== PAYMENT STEP ===== */}
      {step === 'payment' && (
        <main className="max-w-4xl mx-auto px-4 py-4 space-y-4">
          <h2 className="text-lg font-bold">💳 Plačilo</h2>

          {/* Order summary */}
          <div className={`${isDark ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-100'} rounded-xl border p-4`}>
            <h3 className="font-semibold text-sm mb-2">Povzetek naročila</h3>
            {cart.map((item, idx) => {
              const modPrice = item.selectedModifiers.reduce((s, m) => s + (m.price || 0), 0)
              const priceWithVat = (item.menuItem.price + modPrice) * (1 + item.menuItem.vatRate / 100)
              return (
                <div key={idx} className="flex justify-between text-sm py-1">
                  <span>{item.quantity}× {item.menuItem.name}</span>
                  <span>€{(priceWithVat * item.quantity).toFixed(2)}</span>
                </div>
              )
            })}
            {orderType === 'delivery' && (
              <div className="flex justify-between text-sm py-1 text-gray-500">
                <span>Dostava</span>
                <span>€{DELIVERY_FEE.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-lg pt-2 mt-2 border-t">
              <span>Skupaj</span>
              <span className="text-blue-600">€{total.toFixed(2)}</span>
            </div>
          </div>

          {/* Payment method */}
          <div className="space-y-2">
            <h3 className="font-semibold text-sm">Način plačila</h3>
            {[
              { value: 'card' as const, label: 'Kartica', icon: '💳', desc: 'Visa, Mastercard, Maestro' },
              { value: 'mobile' as const, label: 'Mobilno plačilo', icon: '📱', desc: 'Apple Pay, Google Pay' },
              { value: 'cash' as const, label: 'Gotovina', icon: '💵', desc: orderType === 'delivery' ? 'Plačilo ob dostavi' : 'Plačilo ob prevzemu' },
            ].map(pm => (
              <button
                key={pm.value}
                onClick={() => setPaymentMethod(pm.value)}
                className={`w-full p-3 rounded-xl border text-left flex items-center gap-3 transition ${
                  paymentMethod === pm.value
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                    : `${isDark ? 'border-gray-700' : 'border-gray-200'} hover:border-blue-300`
                }`}
              >
                <span className="text-2xl">{pm.icon}</span>
                <div>
                  <p className="font-semibold text-sm">{pm.label}</p>
                  <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{pm.desc}</p>
                </div>
                {paymentMethod === pm.value && <span className="ml-auto text-blue-600 font-bold">✓</span>}
              </button>
            ))}
          </div>

          <div className="flex gap-3">
            <button onClick={() => setStep('details')} className={`flex-1 py-3 rounded-xl font-semibold ${isDark ? 'bg-gray-800 text-gray-300' : 'bg-gray-100 text-gray-600'}`}>
              ← Podatki
            </button>
            <button
              onClick={placeOrder}
              disabled={orderSending}
              className="flex-1 py-3 rounded-xl font-semibold bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 transition"
            >
              {orderSending ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Pošiljam...
                </span>
              ) : (
                `Potrdi naročilo • €${total.toFixed(2)}`
              )}
            </button>
          </div>
        </main>
      )}

      {/* ===== ITEM DETAIL MODAL ===== */}
      {showItemDetail && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowItemDetail(null)} />
          <div className={`absolute bottom-0 left-0 right-0 ${isDark ? 'bg-gray-900' : 'bg-white'} rounded-t-3xl shadow-2xl max-h-[85vh] overflow-auto`}>
            <div className="sticky top-0 z-10 flex items-center justify-between p-4 border-b">
              <h3 className="font-bold text-lg">{showItemDetail.name}</h3>
              <button onClick={() => setShowItemDetail(null)} className="text-2xl leading-none text-gray-400 hover:text-gray-600">&times;</button>
            </div>
            <div className="p-4 space-y-4">
              {showItemDetail.image && (
                <img src={showItemDetail.image} alt={showItemDetail.name} className="w-full h-48 object-cover rounded-xl" />
              )}
              {showItemDetail.description && <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{showItemDetail.description}</p>}
              <p className={`font-bold text-lg ${isDark ? 'text-blue-400' : 'text-blue-700'}`}>
                €{(showItemDetail.price * (1 + showItemDetail.vatRate / 100)).toFixed(2)} <span className="text-xs text-gray-400">z DDV</span>
              </p>

              {/* Modifier groups */}
              {showItemDetail.modifierGroups?.map(mg => (
                <div key={mg.modifierGroup.id}>
                  <p className="font-semibold text-sm mb-2">
                    {mg.modifierGroup.name}
                    {mg.modifierGroup.required && <span className="text-red-500 ml-1">*Obvezno</span>}
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {mg.modifierGroup.modifiers.map(mod => {
                      const selected = selectedMods.some(m => m.id === mod.id)
                      return (
                        <button
                          key={mod.id}
                          onClick={() => toggleModifier(mod, mg.modifierGroup)}
                          className={`p-2 rounded-xl border text-left text-sm transition ${
                            selected ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : `${isDark ? 'border-gray-700' : 'border-gray-200'}`
                          }`}
                        >
                          <span className="font-medium">{mod.name}</span>
                          {mod.price > 0 && <span className="text-xs text-gray-500 ml-1">+€{mod.price.toFixed(2)}</span>}
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}

              <textarea
                placeholder="Opombe za to jed..."
                value={itemNotes}
                onChange={e => setItemNotes(e.target.value)}
                rows={2}
                className={`w-full px-4 py-3 rounded-xl text-sm ${isDark ? 'bg-gray-800 border-gray-700 text-white' : 'bg-white border-gray-200'} border focus:ring-2 focus:ring-blue-500/50 focus:outline-none`}
              />

              <button
                onClick={() => addToCart(showItemDetail, selectedMods, itemNotes)}
                className="w-full bg-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-blue-700 transition"
              >
                Dodaj v košarico
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
