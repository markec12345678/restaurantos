'use client'

import { memo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Lock, Unlock } from 'lucide-react'

// ============================================
// CASH REGISTER LOADING SKELETON
// ============================================

export const CashRegisterLoading = memo(function CashRegisterLoading() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-10 w-48" />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28" />)}
      </div>
      <Skeleton className="h-64" />
    </div>
  )
})

// ============================================
// NO ACTIVE SHIFT CARD
// ============================================

interface NoActiveShiftCardProps {
  onOpenShift: () => void
}

export const NoActiveShiftCard = memo(function NoActiveShiftCard({ onOpenShift }: NoActiveShiftCardProps) {
  return (
    <Card className="border-dashed">
      <CardContent className="py-12 text-center">
        <Lock className="h-12 w-12 mx-auto mb-4 text-muted-foreground/30" />
        <h3 className="text-lg font-semibold mb-2">Blagajna ni odprta</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Za začetek prodaje morate odpreti novo izmeno in vnesti začetno stanje gotovine.
        </p>
        <Button onClick={onOpenShift} aria-label="Odpri izmeno">
          <Unlock className="h-4 w-4 mr-2" />
          Odpri izmeno
        </Button>
      </CardContent>
    </Card>
  )
})
