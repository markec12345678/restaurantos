'use client'

import { memo } from 'react'
import { Button } from '@/components/ui/button'
import { CreditCard, Plus } from 'lucide-react'

// --- Props ---

interface GiftCardPageHeaderProps {
  onOpenNewCard: () => void
}

// --- Komponenta za glavo strani ---

export const GiftCardPageHeader = memo(function GiftCardPageHeader({
  onOpenNewCard,
}: GiftCardPageHeaderProps) {
  return (
    <div className="flex items-center justify-between flex-wrap gap-3">
      <div>
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <CreditCard className="h-6 w-6 text-primary" />
          Darilne kartice
        </h2>
        <p className="text-muted-foreground">Upravljanje darilnih kartic in bonov</p>
      </div>
      <Button onClick={onOpenNewCard}>
        <Plus className="h-4 w-4 mr-2" />
        Nova kartica
      </Button>
    </div>
  )
})
