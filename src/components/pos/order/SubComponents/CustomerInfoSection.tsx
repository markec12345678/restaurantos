'use client'

import { memo } from 'react'
import { Input } from '@/components/ui/input'

// ============================================
// CUSTOMER INFO — Ime, telefon, popust, opombe
// ============================================

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

export const CustomerInfoSection = memo(function CustomerInfoSection({
  customerName, setCustomerName, customerPhone, setCustomerPhone,
  orderNotes, setOrderNotes, discount, setDiscount,
  appliedDiscountId, setAppliedDiscountId, discounts, subtotal,
}: CustomerInfoSectionProps) {
  return (
    <div className="px-3 py-2 space-y-1.5 border-b border-border">
      <Input placeholder="Ime stranke" value={customerName} onChange={e => setCustomerName(e.target.value)} className="h-7 text-xs" aria-label="Ime stranke" />
      <div className="flex gap-1.5">
        <Input placeholder="Telefon" value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} className="h-7 text-xs flex-1" aria-label="Telefon stranke" />
        <Input placeholder="Popust €" type="number" min="0" step="0.01" value={discount || ''} onChange={e => { setDiscount(parseFloat(e.target.value) || 0); setAppliedDiscountId(null) }} className="h-7 text-xs w-20" aria-label="Popust v evrih" />
      </div>
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
  )
})
