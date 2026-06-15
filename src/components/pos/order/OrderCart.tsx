'use client'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { AnimatePresence } from 'framer-motion'
import { Trash2, ShoppingBag, ArrowLeft, UtensilsCrossed } from 'lucide-react'
import type { CartItemType } from '@/lib/store'
import { CartItemRow } from './CartItemRow'
import { CartTotals } from './CartTotals'
import { CustomerInfoSection } from './SubComponents/CustomerInfoSection'
import { SubmitButtons } from './SubComponents/SubmitButtons'

// ============================================
// TIPI
// ============================================
export interface OrderCartProps {
  cart: CartItemType[]
  removeFromCart: (_cartKey: string) => void
  updateCartQuantity: (_cartKey: string, _quantity: number) => void
  subtotal: number
  vatBreakdown: Record<string, { base: number; vat: number }>
  totalTax: number
  discount: number
  total: number
  customerName: string
  setCustomerName: (_name: string) => void
  customerPhone: string
  setCustomerPhone: (_phone: string) => void
  orderNotes: string
  setOrderNotes: (_notes: string) => void
  setDiscount: (_discount: number) => void
  appliedDiscountId: string | null
  setAppliedDiscountId: (_id: string | null) => void
  discounts: { id: string; name: string; type: string; amount: number }[] | undefined
  editingOrderId: string | null
  editingOrderNumber: number | null
  onExitEditing: () => void
  onSubmit: () => void
  isPending: boolean
  setClearCartConfirm: (_confirm: boolean) => void
}

// ============================================
// ORDER CART - Košarica in povzetek naročila
// ============================================
export function OrderCart({
  cart, removeFromCart, updateCartQuantity,
  subtotal, vatBreakdown, totalTax, discount, total,
  customerName, setCustomerName, customerPhone, setCustomerPhone,
  orderNotes, setOrderNotes,
  setDiscount, appliedDiscountId, setAppliedDiscountId, discounts,
  editingOrderId, editingOrderNumber, onExitEditing,
  onSubmit, isPending, setClearCartConfirm,
}: OrderCartProps) {
  const cartItemCount = cart.reduce((s, i) => s + i.quantity, 0)

  return (
    <div className="w-[280px] sm:w-[320px] md:w-[340px] xl:w-[380px] border-l border-border bg-card flex flex-col flex-shrink-0">
      {/* Cart Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border flex-shrink-0">
        <div className="flex items-center gap-2">
          {editingOrderId ? (
            <>
              <UtensilsCrossed className="h-4 w-4 text-primary" />
              <span className="font-bold text-sm">Dodaj k #{editingOrderNumber}</span>
            </>
          ) : (
            <>
              <ShoppingBag className="h-4 w-4 text-primary" />
              <span className="font-bold text-sm">Naročilo</span>
            </>
          )}
          {cartItemCount > 0 && (
            <Badge variant="secondary" className="text-[10px] h-5 px-1.5">{cartItemCount}</Badge>
          )}
        </div>
        <div className="flex items-center gap-1">
          {editingOrderId && (
            <Button variant="ghost" size="sm" onClick={onExitEditing} className="h-7 text-xs">
              <ArrowLeft className="h-3 w-3 mr-1" />Novo
            </Button>
          )}
          {cart.length > 0 && (
            <Button variant="ghost" size="sm" onClick={() => setClearCartConfirm(true)} className="h-7 text-xs text-destructive hover:text-destructive">
              <Trash2 className="h-3 w-3 mr-1" />Zbriši
            </Button>
          )}
        </div>
      </div>
      {/* Cart Items */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {cart.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2">
            <ShoppingBag className="h-10 w-10 opacity-20" />
            <p className="text-sm">Košarica je prazna</p>
            <p className="text-xs">Izberi artikle iz menija</p>
          </div>
        ) : (
          <div className="p-2 space-y-1">
            <AnimatePresence mode="popLayout">
              {cart.map((item) => (
                <CartItemRow key={item.cartKey} item={item} removeFromCart={removeFromCart} updateCartQuantity={updateCartQuantity} />
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
      {/* Bottom Section */}
      <div className="border-t border-border flex-shrink-0">
        <CustomerInfoSection
          customerName={customerName} setCustomerName={setCustomerName}
          customerPhone={customerPhone} setCustomerPhone={setCustomerPhone}
          orderNotes={orderNotes} setOrderNotes={setOrderNotes}
          discount={discount} setDiscount={setDiscount}
          appliedDiscountId={appliedDiscountId} setAppliedDiscountId={setAppliedDiscountId}
          discounts={discounts} subtotal={subtotal}
        />
        <CartTotals subtotal={subtotal} vatBreakdown={vatBreakdown} totalTax={totalTax} discount={discount} total={total} />
        <SubmitButtons
          cartLength={cart.length} isPending={isPending}
          editingOrderId={editingOrderId} editingOrderNumber={editingOrderNumber}
          onSubmit={onSubmit}
        />
      </div>
    </div>
  )
}
