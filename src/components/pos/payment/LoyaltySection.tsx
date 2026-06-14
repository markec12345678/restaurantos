'use client'

import { memo } from 'react'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Star } from 'lucide-react'
import type { LoyaltyAccountItem } from './types'

interface LoyaltySectionProps {
  loyaltyResults: LoyaltyAccountItem[]
  loyaltySearch: string
  setLoyaltySearch: (_val: string) => void
  selectedLoyaltyId: string | null
  setSelectedLoyaltyId: (_val: string | null) => void
}

export const LoyaltySection = memo(function LoyaltySection({
  loyaltyResults,
  loyaltySearch,
  setLoyaltySearch,
  selectedLoyaltyId,
  setSelectedLoyaltyId,
}: LoyaltySectionProps) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold">Išči zvestobni račun</p>
      <Input
        placeholder="Ime, telefon ali email..."
        value={loyaltySearch}
        onChange={e => setLoyaltySearch(e.target.value)}
        className="h-8 text-xs"
        aria-label="Išči zvestobni račun"
      />
      <div className="space-y-1 max-h-32 overflow-y-auto">
        {(loyaltyResults || []).map(la => (
          <button
            key={la.id}
            onClick={() => setSelectedLoyaltyId(la.id)}
            className={`w-full flex items-center justify-between p-2 rounded-md text-xs transition-colors ${
              selectedLoyaltyId === la.id
                ? 'bg-primary/10 border-primary border'
                : 'bg-muted/50 hover:bg-muted'
            }`}
          >
            <div className="flex items-center gap-2">
              <Star className="h-3.5 w-3.5" aria-hidden="true" />
              <span className="font-medium">{la.customerName}</span>
              <span className="text-muted-foreground">{la.phone}</span>
            </div>
            <div className="flex items-center gap-1">
              <Badge variant="outline" className="text-[9px] h-4">{la.tier}</Badge>
              <span className="font-bold">{la.pointsBalance} točk</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
})
