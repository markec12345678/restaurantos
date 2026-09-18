'use client'

import { memo } from 'react'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Star, TrendingUp, Ticket } from 'lucide-react'
import type { LoyaltyAccountItem } from './types'

interface LoyaltySectionProps {
  loyaltyResults: LoyaltyAccountItem[]
  loyaltySearch: string
  setLoyaltySearch: (_val: string) => void
  selectedLoyaltyId: string | null
  setSelectedLoyaltyId: (_val: string | null) => void
  /** RUNDA 42: 'earn' = pripni račun za točke (katerikoli način plačila),
   *  'redeem' = plačilo s točkami (loyalty način) */
  variant?: 'earn' | 'redeem'
  /** earn: koliko točk bo pridobljenih | redeem: koliko točk je potrebnih */
  previewPoints?: number
  loyaltyEnabled?: boolean
}

export const LoyaltySection = memo(function LoyaltySection({
  loyaltyResults,
  loyaltySearch,
  setLoyaltySearch,
  selectedLoyaltyId,
  setSelectedLoyaltyId,
  variant = 'earn',
  previewPoints = 0,
  loyaltyEnabled = false,
}: LoyaltySectionProps) {
  const isRedeem = variant === 'redeem'
  const selected = (loyaltyResults || []).find(la => la.id === selectedLoyaltyId) || null

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold flex items-center gap-1.5">
          {isRedeem ? (
            <Ticket className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
          ) : (
            <Star className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
          )}
          {isRedeem ? 'Plačilo s točkami' : 'Zvestobni račun (točke)'}
        </p>
        {/* RUNDA 42: živi preview — earn: +N točk za to plačilo; redeem: N točk potrebnih */}
        {previewPoints > 0 && (
          <Badge
            variant="outline"
            className={
              isRedeem
                ? 'text-[10px] h-5 gap-1 border-primary/40 bg-primary/5 text-primary'
                : 'text-[10px] h-5 gap-1 border-emerald-500/40 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400'
            }
          >
            <TrendingUp className="h-3 w-3" aria-hidden="true" />
            {isRedeem
              ? `potrebno ${previewPoints} točk`
              : `+${previewPoints} točk za to plačilo`}
          </Badge>
        )}
      </div>
      <Input
        placeholder="Ime, telefon ali email..."
        value={loyaltySearch}
        onChange={e => setLoyaltySearch(e.target.value)}
        className="h-8 text-xs"
        aria-label="Išči zvestobni račun"
      />
      <div className="space-y-1 max-h-32 overflow-y-auto custom-scrollbar">
        {(loyaltyResults || []).map(la => {
          const isSelected = selectedLoyaltyId === la.id
          return (
            <button
              key={la.id}
              onClick={() => setSelectedLoyaltyId(isSelected ? null : la.id)}
              aria-pressed={isSelected}
              className={`w-full flex items-center justify-between p-2 rounded-md text-xs transition-colors ${
                isSelected
                  ? 'bg-primary/10 border border-primary'
                  : 'bg-muted/50 hover:bg-muted border border-transparent'
              }`}
            >
              <div className="flex items-center gap-2">
                <Star className={`h-3.5 w-3.5 ${isSelected ? 'fill-primary text-primary' : ''}`} aria-hidden="true" />
                <span className="font-medium">{la.customerName}</span>
                <span className="text-muted-foreground">{la.phone}</span>
              </div>
              <div className="flex items-center gap-1">
                <Badge variant="outline" className="text-[9px] h-4">{la.tier}</Badge>
                <span className="font-bold tabular-nums">{la.pointsBalance} točk</span>
              </div>
            </button>
          )
        })}
      </div>
      {/* Izbrani račun + kontekstualna pomoč */}
      {selected && (
        <p className="text-[11px] text-muted-foreground flex items-center gap-1.5" role="status">
          <Star className="h-3 w-3 fill-primary text-primary flex-shrink-0" aria-hidden="true" />
          Pripeto: <span className="font-semibold text-foreground">{selected.customerName}</span>
          {isRedeem
            ? ` — unovčenje ${previewPoints} točk`
            : loyaltyEnabled
              ? ` — bo prejel +${previewPoints} točk`
              : ' — program točk ni aktiven (točke se ne birovale)'}
          {' · '}
          <button
            onClick={() => setSelectedLoyaltyId(null)}
            className="underline underline-offset-2 hover:text-foreground"
          >
            odpeni
          </button>
        </p>
      )}
      {!selected && (loyaltyResults || []).length === 0 && (
        <p className="text-[11px] text-muted-foreground">
          {isRedeem
            ? 'Išči in izberi račun za plačilo s točkami.'
            : 'Pripni račun stranke — točke se bodo dodale ob plačilu.'}
        </p>
      )}
    </div>
  )
})
