import { create } from 'zustand'

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
  price: number
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
  setActiveModule: (module: string) => void
  cart: CartItemType[]
  addToCart: (item: { id: string; name: string; price: number; categoryId: string; image: string; modifiers?: SelectedModifier[] }) => void
  removeFromCart: (cartKey: string) => void
  updateCartQuantity: (cartKey: string, quantity: number) => void
  updateCartNotes: (cartKey: string, notes: string) => void
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
  activeMenuId: string | null
  setActiveMenuId: (menuId: string | null) => void
}

function generateCartKey(itemId: string, modifiers: SelectedModifier[]): string {
  if (!modifiers.length) return itemId
  const sortedModIds = modifiers.map(m => m.id).sort().join('+')
  return `${itemId}_${sortedModIds}`
}

function getItemEffectivePrice(basePrice: number, modifiers: SelectedModifier[]): number {
  const modifiersTotal = modifiers.reduce((sum, m) => sum + m.price, 0)
  return basePrice + modifiersTotal
}

export const usePOSStore = create<POSStore>((set, get) => ({
  activeModule: 'dashboard',
  setActiveModule: (module) => set({ activeModule: module }),
  cart: [],
  addToCart: (item) =>
    set((state) => {
      const modifiers = item.modifiers || []
      const cartKey = generateCartKey(item.id, modifiers)
      const effectivePrice = getItemEffectivePrice(item.price, modifiers)
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
  activeMenuId: null,
  setActiveMenuId: (menuId) => set({ activeMenuId: menuId }),
}))
