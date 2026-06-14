'use client'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { AnimatePresence, motion } from 'framer-motion'
import { Plus, Minus, Trash2, ShoppingBag, CreditCard, X, ArrowLeft, UtensilsCrossed, ImageIcon } from 'lucide-react'
import type { CartItemType } from '@/lib/store'

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
              <motion.div
                key={item.cartKey}
                initial={{ opacity: 0, x: 20, scale: 0.95 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: -20, scale: 0.95 }}
                transition={{ duration: 0.15 }}
                className="flex items-start gap-2 p-2 rounded-lg bg-muted/40 hover:bg-muted/60 transition-colors"
              >
                {/* Thumbnail */}
                {item.image ? (
                  <div className="w-10 h-10 rounded-md overflow-hidden flex-shrink-0">
                    <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                  </div>
                ) : (
                  <div className="w-10 h-10 rounded-md bg-muted flex-shrink-0 flex items-center justify-center">
                    <ImageIcon className="h-4 w-4 text-muted-foreground/40" />
                  </div>
                )}
                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold truncate">{item.name}</p>
                  <p className="text-[10px] text-muted-foreground">€{item.price.toFixed(2)} na kos</p>
                  {item.modifiers.length > 0 && (
                    <div className="flex flex-wrap gap-0.5 mt-0.5">
                      {item.modifiers.map(m => (
                        <Badge key={m.id} variant="outline" className="text-[8px] h-3.5 px-1 py-0">
                          {m.name}{m.price > 0 ? ` +€${m.price.toFixed(2)}` : ''}
                        </Badge>
                      ))}
                    </div>
                  )}
                  {item.notes && <p className="text-[9px] text-primary italic mt-0.5">📝 {item.notes}</p>}
                </div>
                {/* Controls */}
                <div className="flex flex-col items-end gap-1 flex-shrink-0">
                  <Button variant="ghost" size="icon" aria-label="Zapri" className="h-8 w-8 text-destructive touch-manipulation" onClick={() => removeFromCart(item.cartKey)}>
                    <X className="h-3.5 w-3.5" />
                  </Button>
                  <div className="flex items-center gap-1">
                    <Button variant="outline" size="icon" aria-label="Zmanjšaj" className="h-10 w-10 touch-manipulation" onClick={() => updateCartQuantity(item.cartKey, item.quantity - 1)}>
                      <Minus className="h-3.5 w-3.5" />
                    </Button>
                    <span className="text-sm font-bold w-7 text-center">{item.quantity}</span>
                    <Button variant="outline" size="icon" aria-label="Dodaj" className="h-10 w-10 touch-manipulation" onClick={() => updateCartQuantity(item.cartKey, item.quantity + 1)}>
                      <Plus className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <p className="text-xs font-bold">€{(item.price * item.quantity).toFixed(2)}</p>
                </div>
              </motion.div>
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
        <div className="px-3 py-2 space-y-0.5 text-xs">
          <div className="flex justify-between text-muted-foreground">
            <span>Vmesna vsota (brez DDV)</span>
            <span>€{subtotal.toFixed(2)}</span>
          </div>
          {/* Multi-DDV prikaz po stopnjah */}
          {Object.entries(vatBreakdown).map(([rate, data]) => (
            <div key={rate} className="flex justify-between text-muted-foreground">
              <span>DDV {rate}%</span>
              <span>€{data.vat.toFixed(2)} <span className="text-[9px] opacity-60">(osn. €{data.base.toFixed(2)})</span></span>
            </div>
          ))}
          <div className="flex justify-between text-muted-foreground font-medium">
            <span>Skupaj DDV</span>
            <span>€{totalTax.toFixed(2)}</span>
          </div>
          {discount > 0 && (
            <div className="flex justify-between text-emerald-600">
              <span>Popust</span>
              <span>-€{discount.toFixed(2)}</span>
            </div>
          )}
          <div className="flex justify-between font-bold text-base pt-1">
            <span>Skupaj z DDV</span>
            <span>€{Math.max(0, total).toFixed(2)}</span>
          </div>
        </div>
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
