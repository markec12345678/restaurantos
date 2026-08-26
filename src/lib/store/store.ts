// ============================================
// POS STORE — ZUSTAND STORE IMPLEMENTACIJA
// ============================================

import { create } from 'zustand'
import { setLocale, getLocale } from '../i18n'
import { getCountryConfig, getCountryByLocale } from '../country-config'
import type { POSStore } from './types'
import { generateCartKey, getItemEffectivePrice, calculateTaxBreakdown } from './types'

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
  country: (typeof window !== 'undefined' ? (localStorage.getItem('pos_country') as import('../country-config').CountryCode || getCountryByLocale(getLocale())) : 'SI'),
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
