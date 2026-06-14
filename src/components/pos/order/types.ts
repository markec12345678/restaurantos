// ============================================
// TIPI ZA ORDER PANEL IN POVEZANE KOMPONENTE
// ============================================

import type { OrderType } from './OrderList'

// --- Menu Browser tipi ---

export interface ModifierGroupType {
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

export interface MenuItemType {
  id: string
  name: string
  description: string
  price: number
  image: string
  isAvailable: boolean
  sortOrder: number
  categoryId: string
  allergens?: string
  category: { id: string; name: string; menu: { id: string; name: string } }
  modifierGroups: ModifierGroupType[]
}

export interface MenuType {
  id: string
  name: string
  icon: string
  color: string
  isActive: boolean
  categories: { id: string; name: string; icon: string; color: string; menuItems: MenuItemType[] }[]
}

export interface SuperGroupType {
  id: string
  name: string
  icon: string
  color: string
  categoryIds: string[]
}

export interface StockInfoType {
  status: 'ok' | 'low' | 'out'
  available: number
  unit: string
}

// --- Order Panel tipi ---

export interface OrderPanelState {
  customerName: string
  setCustomerName: (_name: string) => void
  customerPhone: string
  setCustomerPhone: (_phone: string) => void
  orderNotes: string
  setOrderNotes: (_notes: string) => void
  mainTab: string
  setMainTab: (_tab: string) => void
  orderListTab: string
  setOrderListTab: (_tab: string) => void
  selectedOrder: OrderType | Record<string, unknown> | null
  setSelectedOrder: (_order: OrderType | Record<string, unknown> | null) => void
  paymentDialogOpen: boolean
  setPaymentDialogOpen: (_open: boolean) => void
  detailOrder: OrderType | null
  setDetailOrder: (_order: OrderType | null) => void
  receiptOrder: OrderType | Record<string, unknown> | null
  setReceiptOrder: (_order: OrderType | Record<string, unknown> | null) => void
  autoPayOrder: Record<string, unknown> | null
  setAutoPayOrder: (_order: Record<string, unknown> | null) => void
  autoReceiptOrderId: string | null
  setAutoReceiptOrderId: (_id: string | null) => void
  voidItem: { id: string; name: string; quantity: number; price: number; vatRate: number; voided: boolean; orderId: string } | null
  setVoidItem: (_item: { id: string; name: string; quantity: number; price: number; vatRate: number; voided: boolean; orderId: string } | null) => void
  stornoOrder: OrderType | Record<string, unknown> | null
  setStornoOrder: (_order: OrderType | Record<string, unknown> | null) => void
  clearCartConfirm: boolean
  setClearCartConfirm: (_open: boolean) => void
  lastAddedId: string | null
  setLastAddedId: (_id: string | null) => void
  shortcutsOpen: boolean
  setShortcutsOpen: (_open: boolean) => void
}

export interface OrderPanelData {
  menus: MenuType[] | undefined
  menusLoading: boolean
  menuItems: MenuItemType[] | undefined
  menuLoading: boolean
  tables: TableType[] | undefined
  orders: OrderType[] | undefined
  ordersLoading: boolean
  discounts: DiscountType[] | undefined
  diningOptions: DiningOptionType[] | undefined
  menuStockMap: Record<string, StockInfoType> | undefined
}

export interface OrderPanelCalculations {
  subtotal: number
  vatBreakdown: Array<{ vatRate: number; taxableAmount: number; taxAmount: number }>
  totalTax: number
  total: number
  _cappedDiscount: number
}

// --- Pomožni tipi za podatke ---

export interface TableType {
  id: string
  number: number
  capacity: number
  status: string
}

export interface DiscountType {
  id: string
  name: string
  type: string
  amount: number
  isActive: boolean
}

export interface DiningOptionType {
  id: string
  name: string
  type: string
}
