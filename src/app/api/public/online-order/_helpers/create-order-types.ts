// Pomožne funkcije za online naročila — Tipi za ustvarjanje naročila

// ─── Tipi za transakcijo ───

export interface CreateOnlineOrderInput {
  orderType: string
  items: Array<{ menuItemId: string; quantity: number; notes: string; modifiersJson: string }>
  paymentMethod: string
  customer: Record<string, unknown>
  promoCode?: string
  locationId?: string
  menuItemMap: Map<string, {
    id: string; price: import('@/lib/decimal').DecimalLike; vatRate: import('@/lib/decimal').DecimalLike
    recipeItems: Array<{
      quantityPerServing: import('@/lib/decimal').DecimalLike
      inventoryItem: { id: string; quantity: import('@/lib/decimal').DecimalLike; costPerUnit: import('@/lib/decimal').DecimalLike } | null
    }>
  }>
  orderItemsData: import('./order-calc').OrderItemCalc[]
  subtotal: number
  totalVat: number
  actualDeliveryFee: number
  nextOrderNumber: number
  nextCheckNumber: number
}
