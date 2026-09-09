// ============================================
// TIPI za plačilni dialog
// ============================================

export interface OrderItemType {
  id: string
  menuItem: { name: string }
  quantity: number
  price: number
  vatRate: number
  // P2-UX: status artikla (pending = še ni poslan v kuhinjo) — API ga vrača,
  // potrebujemo ga za opozorilo pred plačilom naročila z neodposlanimi artikli
  status?: string
}

// Tipi za darilne kartice
export interface GiftCardItem {
  id: string
  cardNumber: string
  ownerName: string
  balance: number
  status: string
}

// Tipi za zvestobne račune
export interface LoyaltyAccountItem {
  id: string
  customerName: string
  phone: string
  pointsBalance: number
  tier: string
}

// Tipi za alternativna plačila
export interface AltPaymentItem {
  id: string
  name: string
  code: string
  type: string
}

export interface PaymentDialogProps {
  order: {
    id: string
    orderNumber: number
    total: number
    subtotal: number
    tax: number
    discount: number
    tip: number
    status?: string
    // P2-UX (stale order): optimistic locking — klient pošlje updatedAt, ki ga je
    // prebral; backend ga primerja in vrne 409, če je medtem drug uporabnik spremenil naročilo
    updatedAt?: string
    orderItems: OrderItemType[]
  } | null
  open: boolean
  onClose: () => void
  onPaymentSuccess?: (_orderId: string) => void
}
