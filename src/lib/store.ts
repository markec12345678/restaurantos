import { create } from 'zustand'
import type { Locale } from './i18n'
import { setLocale, getLocale } from './i18n'
import type { CountryCode } from './country-config'
import { getCountryConfig, getCountryByLocale } from './country-config'

export interface SelectedModifier {
  id: string
  name: string
  price: number
  modifierGroupId: string
  modifierGroupName: string
}

export interface CartItemType {
  id: string
  name: string
  price: number       // Cena brez DDV (osnova)
  vatRate: number      // DDV stopnja artikla (22, 9.5, 0)
  quantity: number
  categoryId: string
  notes: string
  image: string
  modifiers: SelectedModifier[]
  // Unique cart key = itemId + sorted modifier ids (allows same item with different modifiers)
  cartKey: string
}

interface POSStore {
  activeModule: string
  setActiveModule: (_module: string) => void
  cart: CartItemType[]
  addToCart: (_item: { id: string; name: string; price: number; vatRate?: number; categoryId: string; image: string; modifiers?: SelectedModifier[] }) => void
  removeFromCart: (_cartKey: string) => void
  updateCartQuantity: (_cartKey: string, _quantity: number) => void
  updateCartNotes: (_cartKey: string, _notes: string) => void
  clearCart: () => void
  cartTotal: () => number       // Skupaj z DDV
  cartSubtotal: () => number    // Osnova brez DDV
  cartTaxTotal: () => number    // Skupni DDV
  cartVatBreakdown: () => Record<string, { base: number; vat: number }>  // DDV po stopnjah
  orderType: string
  setOrderType: (_type: string) => void
  selectedTable: string | null
  setSelectedTable: (_tableId: string | null) => void
  discount: number
  setDiscount: (_discount: number) => void
  sidebarOpen: boolean
  setSidebarOpen: (_open: boolean) => void
  activeMenuId: string | null
  setActiveMenuId: (_menuId: string | null) => void
  // Editing existing order
  editingOrderId: string | null
  setEditingOrderId: (_orderId: string | null) => void
  editingOrderNumber: number | null
  setEditingOrderNumber: (_num: number | null) => void
  // Default tax rate (fallback, ko artikel nima določene stopnje)
  taxRate: number
  setTaxRate: (_rate: number) => void
  // Selected discount ID from configuration
  appliedDiscountId: string | null
  setAppliedDiscountId: (_id: string | null) => void
  // Selected dining option
  diningOptionId: string | null
  setDiningOptionId: (_id: string | null) => void
  // Kiosk način
  kioskMode: boolean
  setKioskMode: (_mode: boolean) => void
  kioskAllowedModules: string[]
  setKioskAllowedModules: (_modules: string[]) => void
  // Večjezičnost
  locale: Locale
  setLocale: (_locale: Locale) => void
  // Država / Regija
  country: CountryCode
  setCountry: (_country: CountryCode) => void
  // Happy Hour
  activePriceGroupId: string | null
  setActivePriceGroupId: (_id: string | null) => void
  happyHourActive: boolean
  setHappyHourActive: (_active: boolean) => void
}

function generateCartKey(itemId: string, modifiers: SelectedModifier[]): string {
  if (!modifiers.length) return itemId
  const sortedModIds = modifiers.map(m => m.id).sort().join('+')
  return `${itemId}_${sortedModIds}`
}

function getItemEffectivePrice(basePrice: number, modifiers: SelectedModifier[]): number {
  const modifiersTotal = modifiers.reduce((sum, m) => sum + Number(m.price), 0)
  return Number(basePrice) + modifiersTotal
}

/**
 * Skupna funkcija za izračun DDV po stopnjah z razporeditvijo popusta.
 * En algoritem, ki ga uporabljajo cartTaxTotal, cartTotal in cartVatBreakdown.
 * Popust se porazdeli proporcionalno po DDV stopnjah (zahteva FURS/slovenski davčni zakon).
 */
function calculateTaxBreakdown(cart: CartItemType[], discount: number) {
  const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0)
  const effectiveDiscount = Math.min(discount, subtotal)

  // 1. Zberi osnove po DDV stopnjah
  const rateBases: Record<string, number> = {}
  for (const item of cart) {
    const rate = String(item.vatRate)
    const itemBase = item.price * item.quantity
    rateBases[rate] = (rateBases[rate] || 0) + itemBase
  }

  // 2. Porazdeli popust proporcionalno po stopnjah in izračunaj DDV
  const breakdown: Record<string, { base: number; vat: number }> = {}
  let totalTax = 0

  for (const rate of Object.keys(rateBases)) {
    const proportion = subtotal > 0 ? rateBases[rate] / subtotal : 0
    const discountedBase = Math.max(0, rateBases[rate] - effectiveDiscount * proportion)
    const base = Math.round(discountedBase * 100) / 100
    const vat = Math.round(base * (parseFloat(rate) / 100) * 100) / 100
    breakdown[rate] = { base, vat }
    totalTax += vat
  }

  const totalWithTax = Math.round(Math.max(0, (subtotal - effectiveDiscount) + totalTax) * 100) / 100
  totalTax = Math.round(totalTax * 100) / 100

  return { subtotal, effectiveDiscount, totalTax, totalWithTax, breakdown }
}

export const usePOSStore = create<POSStore>((set, get) => ({
  activeModule: 'orders',
  setActiveModule: (module) => set({ activeModule: module }),
  cart: [],
  addToCart: (item) =>
    set((state) => {
      const modifiers = item.modifiers || []
      const cartKey = generateCartKey(item.id, modifiers)
      const effectivePrice = getItemEffectivePrice(item.price, modifiers)
      const vatRate = item.vatRate ?? 22.0
      const existing = state.cart.find((c) => c.cartKey === cartKey)
      if (existing) {
        return {
          cart: state.cart.map((c) =>
            c.cartKey === cartKey ? { ...c, quantity: c.quantity + 1 } : c
          ),
        }
      }
      return {
        cart: [...state.cart, {
          id: item.id,
          name: item.name,
          price: effectivePrice,
          vatRate,
          quantity: 1,
          categoryId: item.categoryId,
          notes: '',
          image: item.image || '',
          modifiers,
          cartKey,
        }],
      }
    }),
  removeFromCart: (cartKey) =>
    set((state) => ({ cart: state.cart.filter((c) => c.cartKey !== cartKey) })),
  updateCartQuantity: (cartKey, quantity) =>
    set((state) => ({
      cart:
        quantity <= 0
          ? state.cart.filter((c) => c.cartKey !== cartKey)
          : state.cart.map((c) => (c.cartKey === cartKey ? { ...c, quantity } : c)),
    })),
  updateCartNotes: (cartKey, notes) =>
    set((state) => ({
      cart: state.cart.map((c) => (c.cartKey === cartKey ? { ...c, notes } : c)),
    })),
  clearCart: () =>
    set({ cart: [], discount: 0, selectedTable: null, editingOrderId: null, editingOrderNumber: null }),
  cartSubtotal: () => {
    const { cart } = get()
    return Math.round(cart.reduce((sum, item) => sum + item.price * item.quantity, 0) * 100) / 100
  },
  cartTaxTotal: () => {
    const calc = calculateTaxBreakdown(get().cart, get().discount)
    return calc.totalTax
  },
  cartTotal: () => {
    const calc = calculateTaxBreakdown(get().cart, get().discount)
    return calc.totalWithTax
  },
  cartVatBreakdown: () => {
    const calc = calculateTaxBreakdown(get().cart, get().discount)
    return calc.breakdown
  },
  orderType: 'dine-in',
  setOrderType: (type) => set({ orderType: type }),
  selectedTable: null,
  setSelectedTable: (tableId) => set({ selectedTable: tableId }),
  discount: 0,
  setDiscount: (discount) => set({ discount }),
  sidebarOpen: false,
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  activeMenuId: null,
  setActiveMenuId: (menuId) => set({ activeMenuId: menuId }),
  editingOrderId: null,
  setEditingOrderId: (orderId) => set({ editingOrderId: orderId }),
  editingOrderNumber: null,
  setEditingOrderNumber: (num) => set({ editingOrderNumber: num }),
  taxRate: 22.0,  // Privzeta DDV stopnja v % (konsistentno z MenuItem.vatRate)
  setTaxRate: (rate) => set({ taxRate: rate }),
  appliedDiscountId: null,
  setAppliedDiscountId: (id) => set({ appliedDiscountId: id }),
  diningOptionId: null,
  setDiningOptionId: (id) => set({ diningOptionId: id }),
  kioskMode: false,
  setKioskMode: (mode) => set({ kioskMode: mode }),
  kioskAllowedModules: ['orders', 'kitchen', 'tables'],
  setKioskAllowedModules: (modules) => set({ kioskAllowedModules: modules }),
  // Večjezičnost
  locale: (typeof window !== 'undefined' ? getLocale() : 'sl'),
  setLocale: (locale) => {
    setLocale(locale)
    set({ locale })
  },
  // Država / Regija
  country: (typeof window !== 'undefined' ? (localStorage.getItem('pos_country') as CountryCode || getCountryByLocale(getLocale())) : 'SI'),
  setCountry: (country) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('pos_country', country)
    }
    // Samodejno posodobi davčno stopnjo glede na državo
    const config = getCountryConfig(country)
    set({ country, taxRate: config.taxRates.standard })
  },
  // Happy Hour
  activePriceGroupId: null,
  setActivePriceGroupId: (id) => set({ activePriceGroupId: id }),
  happyHourActive: false,
  setHappyHourActive: (active) => set({ happyHourActive: active }),
}))
