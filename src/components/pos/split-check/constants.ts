// ============================================
// DELJENI TIPI IN KONSTANTE ZA DELITEV RAČUNA
// ============================================

// Tip artikla v košarici
export interface CartItem {
  id: string
  name: string
  price: number
  quantity: number
  categoryId?: string
}

// Tip stranke za delitev
export interface SplitParty {
  id: string
  name: string
  items: string[] // cartItem ids assigned to this party
  tipPercent: number
  tipAmount: number
  paymentMethod: 'cash' | 'card' | 'mobile'
  paid: boolean
}

// EU alergeni — slovenski prevodi
export const EU_ALLERGEN_MAP: Record<number, string> = {
  1: 'Žita', 2: 'Raki', 3: 'Jajca', 4: 'Ribe', 5: 'Arašidi',
  6: 'Soja', 7: 'Mleko', 8: 'Oreški', 9: 'Zeler', 10: 'Gorčica',
  11: 'Sesam', 12: 'Žveplov dioksid', 13: 'Volčji bob', 14: 'Mehkužci',
}

// Način delitve računa
export type SplitMode = 'equal' | 'items' | 'custom'

// Tip za povzetek stranke z izračuni
export interface PartyTotal extends SplitParty {
  itemsTotal: number
  taxShare: number
  total: number
}

// ============================================
// VMESNIKI ZA PROPS PODKOMPONENT
// ============================================

export interface EqualSplitTabProps {
  equalCount: number
  onEqualCountChange: (_count: number) => void
  orderTotal: number
  autoGratuityAmount: number
  equalSplitAmount: number
  equalRemainder: number
  onClose: () => void
  onConfirmEqual: () => void
}

export interface ItemsSplitTabProps {
  partyTotals: PartyTotal[]
  parties: SplitParty[]
  onSetParties: (_updater: (_prev: SplitParty[]) => SplitParty[]) => void
  cartItems: CartItem[]
  unassignedItems: CartItem[]
  onAddParty: () => void
  onRemoveParty: (_partyId: string) => void
  onAssignItemToParty: (_itemId: string, _partyId: string) => void
  onUnassignItem: (_itemId: string) => void
  onSetPartyTip: (_partyId: string, _percent: number) => void
  onTogglePartyPayment: (_partyId: string, _method: 'cash' | 'card' | 'mobile') => void
  onClose: () => void
  onConfirmItems: () => void
}

export interface CustomSplitTabProps {
  parties: SplitParty[]
  customAmounts: Record<string, number>
  onCustomAmountChange: (_partyId: string, _amount: number) => void
  onCustomAmountDelete: (_partyId: string) => void
  orderTotal: number
  autoGratuityAmount: number
  customTotal: number
  customDifference: number
  isCustomValid: boolean
  onAddParty: () => void
  onRemoveParty: (_partyId: string) => void
  onClose: () => void
  onConfirmCustom: () => void
}

export interface SplitCheckDialogProps {
  open: boolean
  onClose: () => void
  orderTotal: number
  subtotal: number
  taxTotal: number
  cartItems: CartItem[]
  onConfirmSplit: (_parties: SplitParty[]) => void
  partySize?: number
  autoGratuityPercent?: number
  autoGratuityThreshold?: number
}
