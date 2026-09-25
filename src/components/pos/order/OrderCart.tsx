'use client'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { AnimatePresence } from 'framer-motion'
import { Trash2, ShoppingBag, ArrowLeft, UtensilsCrossed, Plus, Table2, X, Layers } from 'lucide-react'
import type { CartItemType } from '@/lib/store'
import { usePOSStore } from '@/lib/store'
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
  /** UI-REFACTOR (Sales P0): številka mize v glavi košarice — uporabnik VEDNO
      ve, za katero mizo gre, ne glede na to, kam je zdrsnil po meniju */
  tableNumber?: number | null
  /** ISSUE #113 §3: zapri mobilni drawer (<md); na desktopu ni prikazan */
  onCloseMobile?: () => void
  /** R134 (P1-10): opt-in tokovi — toggle + per-item izbira toka (client-only) */
  coursesEnabled?: boolean
  onToggleCourses?: () => void
  courseMap?: Record<string, number>
  onSetCourse?: (cartKey: string, courseNumber: number) => void
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
  tableNumber, onCloseMobile,
  coursesEnabled = false, onToggleCourses, courseMap, onSetCourse,
}: OrderCartProps) {
  const cartItemCount = cart.reduce((s, i) => s + i.quantity, 0)
  const bumpCartQuickAddSignal = usePOSStore((s) => s.bumpCartQuickAddSignal)

  return (
    <div className="w-[280px] sm:w-[320px] md:w-[340px] xl:w-[380px] border-l border-border bg-card flex flex-col flex-shrink-0">
      {/* Cart Header — naslov + kontekst mize */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border flex-shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          {/* ISSUE #113 §3: mobilni drawer — zapri (×) je viden samo <md */}
          {onCloseMobile && (
            <button
              onClick={onCloseMobile}
              className="md:hidden -ml-1 flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-muted active:scale-95 transition-all"
              aria-label="Zapri naročilo"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
          {editingOrderId ? (
            <>
              <UtensilsCrossed className="h-4 w-4 text-primary flex-shrink-0" />
              <span className="font-bold text-sm truncate">Dodaj k #{editingOrderNumber}</span>
            </>
          ) : (
            <>
              <ShoppingBag className="h-4 w-4 text-primary flex-shrink-0" />
              <span className="font-bold text-sm">Naročilo</span>
            </>
          )}
          {cartItemCount > 0 && (
            <Badge variant="secondary" className="text-[10px] h-5 px-1.5 flex-shrink-0">{cartItemCount}</Badge>
          )}
          {/* Kontekst mize — trajno viden (ne tekmuje z artikli, a ga ni treba iskati) */}
          {tableNumber ? (
            <span className="flex items-center gap-1 text-[11px] font-semibold text-muted-foreground border border-border rounded-full px-2 py-0.5 flex-shrink-0" aria-label={`Naročilo za mizo ${tableNumber}`}>
              <Table2 className="h-3 w-3" aria-hidden="true" />
              Miza {tableNumber}
            </span>
          ) : null}
        </div>
        <div className="flex items-center gap-1">
          {editingOrderId && (
            <Button variant="ghost" size="sm" onClick={onExitEditing} className="h-7 text-xs pointer-coarse:h-9">
              <ArrowLeft className="h-3 w-3 mr-1" />Novo
            </Button>
          )}
          {cart.length > 0 && (
            <Button variant="ghost" size="sm" onClick={() => setClearCartConfirm(true)} className="h-7 text-xs pointer-coarse:h-9 text-destructive hover:text-destructive">
              <Trash2 className="h-3 w-3 mr-1" />Zbriši
            </Button>
          )}
        </div>
      </div>
      {/* Cart Items */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {cart.length === 0 ? (
          /* UI-REFACTOR: jasen, kompakten empty state (prej: ogromen prazen prostor) */
          <div className="flex flex-col items-center justify-center h-full px-6 text-center gap-1.5">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-dashed border-border bg-muted/40 mb-1" aria-hidden="true">
              <ShoppingBag className="h-6 w-6 text-muted-foreground/50" />
            </div>
            <p className="text-sm font-semibold">Košarica je prazna</p>
            <p className="text-xs text-muted-foreground leading-relaxed">Izberi kategorijo ali poišči artikel<br />in tapni kartico za dodajanje.</p>
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
                  /* R134: izbira toka je vidna SAMO ko je toggle prižgan (default 3) */
                  courseNumber={coursesEnabled ? (courseMap?.[item.cartKey] ?? 3) : undefined}
                  onCourseChange={coursesEnabled && onSetCourse
                    ? (courseNumber: number) => onSetCourse(item.cartKey, courseNumber)
                    : undefined}
                />
              ))}
            </AnimatePresence>
            {/* UI-REFACTOR: "Dodaj še kaj?" — fokus iskalnega polja v menijski
                mreži (store signal; košarica in meni nista povezana prek props) */}
            <button
              onClick={bumpCartQuickAddSignal}
              className="w-full flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-border py-2 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/50 hover:bg-primary/5 hover:text-foreground pointer-coarse:py-3 touch-manipulation"
              aria-label="Dodaj še artikel — odpri iskanje"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              Dodaj še kaj?
            </button>
          </div>
        )}
      </div>
      {/* Bottom Section */}
      <div className="border-t border-border flex-shrink-0">
        {/* R134 (P1-10): opt-in toggle 'Tokovi' — viden samo z artikli v košarici
            in pri NOVI oddaji (urejanje obstoječega = legacy brez tokov).
            Celotna vrstica je velika tarča (pointer-coarse >= 44px). */}
        {cart.length > 0 && !editingOrderId && onToggleCourses && (
          <div
            role="switch"
            aria-checked={coursesEnabled}
            tabIndex={0}
            aria-label="Tokovi — razporedi artikle v tokove (predjed, juha, glavna jed, sladica)"
            onClick={onToggleCourses}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggleCourses() } }}
            className="w-full flex items-center justify-between gap-2 px-4 py-2.5 border-b border-border cursor-pointer select-none hover:bg-muted/40 transition-colors pointer-coarse:py-3 pointer-coarse:min-h-[44px]"
          >
            <span className="flex items-center gap-1.5 min-w-0">
              <Layers className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" aria-hidden="true" />
              <span className="min-w-0">
                <span className="block text-xs font-semibold leading-tight">Tokovi</span>
                <span className="block text-[10px] text-muted-foreground leading-tight truncate">
                  Tek jedi: predjed → juha → glavna → sladica
                </span>
              </span>
            </span>
            {/* Vizualni indikator — klik lovi vrstica (pointer-events-none,
                da ni dvojnega preklopa; tipkovnica uporablja vrstico) */}
            <Switch checked={coursesEnabled} tabIndex={-1} aria-hidden="true" className="pointer-events-none flex-shrink-0" />
          </div>
        )}
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
