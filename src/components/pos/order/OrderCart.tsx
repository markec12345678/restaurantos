'use client'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { AnimatePresence } from 'framer-motion'
import { Trash2, ShoppingBag, CreditCard, ArrowLeft, UtensilsCrossed } from 'lucide-react'
import type { CartItemType } from '@/lib/store'
import { CartItemRow } from './CartItemRow'
import { CartTotals } from './CartTotals'

// ============================================
// TIPI
// ============================================
export interface OrderCartProps {
  // Cart podatki
  cart: CartItemType[]
  removeFromCart: (_cartKey: string) => void
  updateCartQuantity: (_cartKey: string, _quantity: number) => void
  // Cenovni izračuni
  subtotal: number
  vatBreakdown: Record<string, { base: number; vat: number }>
  totalTax: number
  discount: number
  total: number
  // Customer info
  customerName: string
  setCustomerName: (_name: string) => void
  customerPhone: string
  setCustomerPhone: (_phone: string) => void
  orderNotes: string
  setOrderNotes: (_notes: string) => void
  // Discount
  setDiscount: (_discount: number) => void
  appliedDiscountId: string | null
  setAppliedDiscountId: (_id: string | null) => void
  discounts: { id: string; name: string; type: string; amount: number }[] | undefined
  // Editing
  editingOrderId: string | null
  editingOrderNumber: number | null
  onExitEditing: () => void
  // Submit
  onSubmit: () => void
  isPending: boolean
  // Clear cart confirm
  setClearCartConfirm: (_confirm: boolean) => void
}

// ============================================
// ORDER CART - Košarica in povzetek naročila
// ============================================
export function OrderCart({
  cart,
  removeFromCart,
  updateCartQuantity,
  subtotal,
  vatBreakdown,
  totalTax,
  discount,
  total,
  customerName,
  setCustomerName,
  customerPhone,
  setCustomerPhone,
  orderNotes,
  setOrderNotes,
  setDiscount,
  appliedDiscountId,
  setAppliedDiscountId,
  discounts,
  editingOrderId,
  editingOrderNumber,
  onExitEditing,
  onSubmit,
  isPending,
  setClearCartConfirm,
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
              <ArrowLeft className="h-3 w-3 mr-1" />
              Novo
            </Button>
          )}
          {cart.length > 0 && (
            <Button variant="ghost" size="sm" onClick={() => setClearCartConfirm(true)} className="h-7 text-xs text-destructive hover:text-destructive">
              <Trash2 className="h-3 w-3 mr-1" />
              Zbriši
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
                <CartItemRow
                  key={item.cartKey}
                  item={item}
                  removeFromCart={removeFromCart}
                  updateCartQuantity={updateCartQuantity}
                />
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
      {/* Bottom Section */}
      <div className="border-t border-border flex-shrink-0">
        {/* Customer Info - Collapsed */}
        <div className="px-3 py-2 space-y-1.5 border-b border-border">
          <Input placeholder="Ime stranke" value={customerName} onChange={e => setCustomerName(e.target.value)} className="h-7 text-xs" aria-label="Ime stranke" />
          <div className="flex gap-1.5">
            <Input placeholder="Telefon" value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} className="h-7 text-xs flex-1" aria-label="Telefon stranke" />
            <Input placeholder="Popust €" type="number" min="0" step="0.01" value={discount || ''} onChange={e => { setDiscount(parseFloat(e.target.value) || 0); setAppliedDiscountId(null) }} className="h-7 text-xs w-20" aria-label="Popust v evrih" />
          </div>
          {/* Hitri popusti iz konfiguracije */}
          {discounts && discounts.length > 0 && (
            <div className="flex gap-1 flex-wrap">
              <button
                onClick={() => { setDiscount(0); setAppliedDiscountId(null) }}
                className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-colors ${!appliedDiscountId && discount === 0 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-accent'}`}
              >
                Brez
              </button>
              {discounts.slice(0, 4).map((d) => (
                <button
                  key={d.id}
                  onClick={() => {
                    setAppliedDiscountId(d.id)
                    if (d.type === 'percentage') {
                      // FIX MEDIUM: Pravilno zaokroževanje odstotka — round(rezultat*100)/100
                      setDiscount(Math.round(subtotal * d.amount / 100 * 100) / 100)
                    } else {
                      setDiscount(d.amount)
                    }
                  }}
                  className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-colors ${appliedDiscountId === d.id ? 'bg-emerald-600 text-white' : 'bg-muted text-muted-foreground hover:bg-accent'}`}
                >
                  {d.type === 'percentage' ? `${d.amount}%` : `€${d.amount}`} {d.name.split(' ').slice(0, 2).join(' ')}
                </button>
              ))}
            </div>
          )}
          <Input placeholder="Opombe" value={orderNotes} onChange={e => setOrderNotes(e.target.value)} className="h-7 text-xs" aria-label="Opombe k naročilu" />
        </div>
        {/* Totals */}
        <CartTotals
          subtotal={subtotal}
          vatBreakdown={vatBreakdown}
          totalTax={totalTax}
          discount={discount}
          total={total}
        />
        {/* Submit Buttons */}
        <div className="px-3 pb-3 space-y-2">
          <Button
            className="w-full h-12 text-base font-bold bg-emerald-600 hover:bg-emerald-700"
            disabled={cart.length === 0 || isPending}
            onClick={() => onSubmit()}
          >
            {isPending
              ? (editingOrderId ? 'Dodajam...' : 'Naročam...')
              : (editingOrderId ? `Dodaj k naročilu #${editingOrderNumber}` : (
                <>
                  <CreditCard className="h-4 w-4 mr-2" />
                  Oddaj in plačaj
                </>
              ))
            }
          </Button>
          {!editingOrderId && (
            <Button
              variant="outline"
              className="w-full h-9 text-sm"
              disabled={cart.length === 0 || isPending}
              onClick={() => {
                // Oddaj brez plačila - samo shrani naročilo
                onSubmit()
              }}
            >
              <ShoppingBag className="h-3.5 w-3.5 mr-1.5" />
              Oddaj naročilo (plačaj kasneje)
            </Button>
          )}
        </div>
      </div>
      {/* Clear Cart Confirmation Dialog */}
      {/* Note: Ta dialog je renderiran tukaj znotraj OrderCart, ker je neposredno povezan z cart akcijo */}
    </div>
  )
}
