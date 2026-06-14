'use client'

import { memo } from 'react'
import { Badge } from '@/components/ui/badge'
import { Ticket } from 'lucide-react'
import type { AltPaymentItem } from './types'

interface AlternatePaymentSectionProps {
  altPayments: AltPaymentItem[]
  selectedAltPayment: string
  setSelectedAltPayment: (_val: string) => void
}

export const AlternatePaymentSection = memo(function AlternatePaymentSection({
  altPayments,
  selectedAltPayment,
  setSelectedAltPayment,
}: AlternatePaymentSectionProps) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold">Izberi vrsto</p>
      <div className="space-y-1">
        {(altPayments || []).map(apt => (
          <button
            key={apt.id}
            onClick={() => setSelectedAltPayment(apt.id)}
            className={`w-full flex items-center justify-between p-2 rounded-md text-xs transition-colors ${
              selectedAltPayment === apt.id
                ? 'bg-primary/10 border-primary border'
                : 'bg-muted/50 hover:bg-muted'
            }`}
          >
            <div className="flex items-center gap-2">
              <Ticket className="h-3.5 w-3.5" aria-hidden="true" />
              <span className="font-medium">{apt.name}</span>
              <span className="text-muted-foreground">({apt.code})</span>
            </div>
            <Badge variant="secondary" className="text-[9px] h-4">{apt.type}</Badge>
          </button>
        ))}
      </div>
    </div>
  )
})
