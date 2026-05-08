import { create } from 'zustand'

export interface CartItemType {
  id: string
  name: string
  price: number
  quantity: number
  categoryId: string
  notes: string
}

interface POSStore {
  activeModule: string
  setActiveModule: (module: string) => void
  cart: CartItemType[]
  addToCart: (item: { id: string; name: string; price: number; categoryId: string }) => void
  removeFromCart: (itemId: string) => void
  updateCartQuantity: (itemId: string, quantity: number) => void
  updateCartNotes: (itemId: string, notes: string) => void
  clearCart: () => void
  cartTotal: () => number
  orderType: string
  setOrderType: (type: string) => void
  selectedTable: string | null
  setSelectedTable: (tableId: string | null) => void
  discount: number
  setDiscount: (discount: number) => void
  taxRate: number
  sidebarOpen: boolean
  setSidebarOpen: (open: boolean) => void
}

export const usePOSStore = create<POSStore>((set, get) => ({
  activeModule: 'dashboard',
  setActiveModule: (module) => set({ activeModule: module }),
  cart: [],
  addToCart: (item) =>
    set((state) => {
      const existing = state.cart.find((c) => c.id === item.id)
      if (existing) {
        return {
          cart: state.cart.map((c) =>
            c.id === item.id ? { ...c, quantity: c.quantity + 1 } : c
          ),
        }
      }
      return {
        cart: [...state.cart, { ...item, quantity: 1, notes: '' }],
      }
    }),
  removeFromCart: (itemId) =>
    set((state) => ({ cart: state.cart.filter((c) => c.id !== itemId) })),
  updateCartQuantity: (itemId, quantity) =>
    set((state) => ({
      cart:
        quantity <= 0
          ? state.cart.filter((c) => c.id !== itemId)
          : state.cart.map((c) => (c.id === itemId ? { ...c, quantity } : c)),
    })),
  updateCartNotes: (itemId, notes) =>
    set((state) => ({
      cart: state.cart.map((c) => (c.id === itemId ? { ...c, notes } : c)),
    })),
  clearCart: () =>
    set({ cart: [], discount: 0, selectedTable: null }),
  cartTotal: () => {
    const { cart, taxRate, discount } = get()
    const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0)
    const tax = subtotal * taxRate
    return subtotal + tax - discount
  },
  orderType: 'dine-in',
  setOrderType: (type) => set({ orderType: type }),
  selectedTable: null,
  setSelectedTable: (tableId) => set({ selectedTable: tableId }),
  discount: 0,
  setDiscount: (discount) => set({ discount }),
  taxRate: 0.1,
  sidebarOpen: false,
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
}))
