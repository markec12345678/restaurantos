// ============================================
// TIPI IN KONSTANTE ZA STORNO DIALOG
// ============================================

/** Podatki naročila za storno dialog */
export interface StornoOrderData {
  id: string
  orderNumber: number
  total: number
  subtotal: number
  tax: number
  discount: number
  tip: number
  paymentMethod: string
  paymentStatus: string
  status?: string
}

/** Props za StornoDialog */
export interface StornoDialogProps {
  order: StornoOrderData | null
  open: boolean
  onClose: () => void
  onStornoComplete?: () => void
}

// FURS zahtevani razlogi za storno po ZDDV-1
export const STORNO_REASONS = [
  { id: 'error', name: 'Napaka na računu', description: 'Podatki na računu so napačni (znesek, DDV, artikli...)' },
  { id: 'duplicate', name: 'Dvojno zaračunan', description: 'Račun je bil izdan dvakrat za isto transakcijo' },
  { id: 'returned', name: 'Vračilo blaga/storitve', description: 'Stranka je vrnila blago ali storitev' },
  { id: 'cancelled', name: 'Preklicana naročnina', description: 'Naročena storitev je bila preklicana' },
  { id: 'discount', name: 'Popust po izdaji', description: 'Popust je bil odobren po izdaji računa' },
  { id: 'other', name: 'Drug razlog', description: 'Drugi razlogi za storno (navesti morate)' },
]

// Razlogi za preklic neplačanega naročila
export const CANCEL_REASONS = [
  { id: 'customer-cancel', name: 'Stranka preklicala', description: 'Stranka je odpovedala naročilo' },
  { id: 'waiter-error', name: 'Napaka natakarja', description: 'Naročilo je bilo napačno vneseno' },
  { id: 'kitchen-issue', name: 'Težava v kuhinji', description: 'Artikla ni mogoče pripraviti' },
  { id: 'duplicate-order', name: 'Dvojno naročilo', description: 'Naročilo je bilo vneseno dvakrat' },
  { id: 'other', name: 'Drug razlog', description: 'Drugi razlog za preklic' },
]

/** Props za AlreadyCancelledView */
export interface AlreadyCancelledViewProps {
  order: StornoOrderData
  open: boolean
  onClose: () => void
  isStorno: boolean
  totalWithTip: number
}

/** Props za StornoWarningBanner */
export interface StornoWarningBannerProps {
  isPaid: boolean
}

/** Props za OrderInfoPanel */
export interface OrderInfoPanelProps {
  order: StornoOrderData
  totalWithTip: number
}

/** Props za ReasonSelector */
export interface ReasonSelectorProps {
  isPaid: boolean
  selectedReason: string | null
  customReason: string
  onReasonSelect: (_reasonId: string) => void
  onCustomReasonChange: (_value: string) => void
}

/** Props za ConfirmInput */
export interface ConfirmInputProps {
  isPaid: boolean
  canSubmit: boolean
  confirmText: string
  onConfirmTextChange: (_value: string) => void
}
