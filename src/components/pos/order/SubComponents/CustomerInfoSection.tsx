'use client'

import { memo, useState } from 'react'
import { Input } from '@/components/ui/input'
import { DecimalInput } from '@/components/ui/decimal-input'
import { Badge } from '@/components/ui/badge'
import { ChevronDown, UserRound, Phone, StickyNote, Percent } from 'lucide-react'

import { formatEUR } from '@/lib/safe-format'
// ============================================
// CUSTOMER INFO — Ime, telefon, popust, opombe
// ============================================
// UI-REFACTOR (Sales P0): 4 vedno-vidna vnosa so zavzela ~150px košarice, čeprav
// jih večina naročil NE uporablja. Zdaj zložljiva sekcija: skrčena pokaže samo
// čipe že vnesenih podatkov, razširjena vsebuje iste vnose + čipe popustov.
// Samodejno razširjena, če so podatki že vneseni (urejanje/dostava).
// Vsa polja, aria oznake in logika popustov so NESPREMENJENI.

interface CustomerInfoSectionProps {
  customerName: string
  setCustomerName: (_name: string) => void
  customerPhone: string
  setCustomerPhone: (_phone: string) => void
  orderNotes: string
  setOrderNotes: (_notes: string) => void
  discount: number
  setDiscount: (_discount: number) => void
  appliedDiscountId: string | null
  setAppliedDiscountId: (_id: string | null) => void
  discounts: { id: string; name: string; type: string; amount: number }[] | undefined
  subtotal: number
}

// Chip label: prepend the amount prefix ("10%", "€5") only when the name
// doesn't already contain it — seed names like "10% na celotno naročilo" or
// "5€ popust na pijačo" would otherwise render duplicated ("10% 10% na").
const discountChipLabel = (d: { name: string; type: string; amount: number }) => {
  const prefix = d.type === 'percentage' ? `${d.amount}%` : `${formatEUR(d.amount)}`
  return d.name.toLowerCase().includes(prefix.toLowerCase()) ? d.name : `${prefix} ${d.name}`
}

export const CustomerInfoSection = memo(function CustomerInfoSection({
  customerName, setCustomerName, customerPhone, setCustomerPhone,
  orderNotes, setOrderNotes, discount, setDiscount,
  appliedDiscountId, setAppliedDiscountId, discounts, subtotal,
}: CustomerInfoSectionProps) {
  const hasDetails = Boolean(customerName || customerPhone || orderNotes || discount > 0)
  const [expanded, setExpanded] = useState(hasDetails)

  if (!expanded) {
    // SKRČENO: ena vrstica s čipi obstoječih podatkov (ali neopazen poziv)
    return (
      <div className="border-b border-border">
        <button
          onClick={() => setExpanded(true)}
          aria-expanded={false}
          aria-label="Dodaj podatke o stranki, opombo ali popust"
          className="w-full flex items-center gap-1.5 px-3 py-2 text-[11px] text-muted-foreground hover:text-foreground transition-colors pointer-coarse:py-2.5"
        >
          <UserRound className="h-3 w-3 flex-shrink-0" aria-hidden="true" />
          <span className="font-medium">Podatki, opomba &amp; popust</span>
          <span className="flex items-center gap-1 ml-auto min-w-0">
            {customerName && (
              <Badge variant="secondary" className="text-[9px] h-4 max-w-[90px] gap-0.5" title={customerName}>
                <UserRound className="h-2.5 w-2.5 flex-shrink-0" aria-hidden="true" />
                <span className="truncate">{customerName}</span>
              </Badge>
            )}
            {customerPhone && (
              <Badge variant="secondary" className="text-[9px] h-4 max-w-[90px] gap-0.5" title={customerPhone}>
                <Phone className="h-2.5 w-2.5 flex-shrink-0" aria-hidden="true" />
                <span className="truncate">{customerPhone}</span>
              </Badge>
            )}
            {orderNotes && (
              <Badge variant="secondary" className="text-[9px] h-4 max-w-[90px] gap-0.5" title={orderNotes}>
                <StickyNote className="h-2.5 w-2.5 flex-shrink-0" aria-hidden="true" />
                <span className="truncate">{orderNotes}</span>
              </Badge>
            )}
            {discount > 0 && (
              <Badge variant="secondary" className="text-[9px] h-4 gap-0.5 text-emerald-700 dark:text-emerald-400">
                <Percent className="h-2.5 w-2.5 flex-shrink-0" aria-hidden="true" />
                −{formatEUR(discount)}
              </Badge>
            )}
            <ChevronDown className="h-3 w-3 flex-shrink-0 opacity-60" aria-hidden="true" />
          </span>
        </button>
      </div>
    )
  }

  // RAZŠIRJENO: isti vnosi kot prej (TABLET runda 11 — 44px tarče na dotikalnih)
  return (
    <div className="px-3 py-2 space-y-1.5 border-b border-border">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Podatki naročila</span>
        <button
          onClick={() => setExpanded(false)}
          aria-expanded={true}
          aria-label="Skrči podatke naročila"
          className="flex items-center gap-0.5 text-[10px] text-muted-foreground hover:text-foreground transition-colors pointer-coarse:py-1.5"
        >
          Skrči
          <ChevronDown className="h-3 w-3 rotate-180" aria-hidden="true" />
        </button>
      </div>
      {/* TABLET (runda 11): pointer-coarse = tablice/telefoni dobijo 44px tarče,
          namizje ostane kompaktno (h-7) — WCAG 2.5.5 brez žrtvovanja gostote */}
      <Input placeholder="Ime stranke" value={customerName} onChange={e => setCustomerName(e.target.value)} className="h-7 text-xs pointer-coarse:h-11" aria-label="Ime stranke" />
      <div className="flex gap-1.5">
        <Input placeholder="Telefon" value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} className="h-7 text-xs flex-1 pointer-coarse:h-11" aria-label="Telefon stranke" />
        <DecimalInput placeholder="Popust €" value={discount || ''} onValueChange={n => { setDiscount(n); setAppliedDiscountId(null) }} className="h-7 text-xs w-20 pointer-coarse:h-11" aria-label="Popust v evrih" />
      </div>
      {discounts && discounts.length > 0 && (
        <div className="flex gap-1 flex-wrap">
          <button
            onClick={() => { setDiscount(0); setAppliedDiscountId(null) }}
            className={`px-2 py-0.5 pointer-coarse:px-3 pointer-coarse:py-1.5 rounded text-[10px] font-semibold transition-colors ${!appliedDiscountId && discount === 0 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-accent'}`}
          >
            Brez
          </button>
          {discounts.slice(0, 4).map((d) => (
            <button
              key={d.id}
              onClick={() => {
                setAppliedDiscountId(d.id)
                if (d.type === 'percentage') {
                  setDiscount(Math.round(subtotal * d.amount / 100 * 100) / 100)
                } else {
                  setDiscount(d.amount)
                }
              }}
              className={`px-2 py-0.5 pointer-coarse:px-3 pointer-coarse:py-1.5 rounded text-[10px] font-semibold transition-colors ${appliedDiscountId === d.id ? 'bg-emerald-600 text-white' : 'bg-muted text-muted-foreground hover:bg-accent'}`}
            >
              {discountChipLabel(d)}
            </button>
          ))}
        </div>
      )}
      <Input placeholder="Opombe" value={orderNotes} onChange={e => setOrderNotes(e.target.value)} className="h-7 text-xs pointer-coarse:h-11" aria-label="Opombe k naročilu" />
    </div>
  )
})
