'use client'

import { memo } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Coins } from 'lucide-react'
import { type LoyaltyAccount } from './constants'
import { LoyaltyAdjustForm, type AdjustData } from './LoyaltyAdjustForm'

interface LoyaltyAdjustPointsDialogProps {
  open: boolean
  adjustAccount: LoyaltyAccount | null
  adjustData: AdjustData
  isPending: boolean
  onOpenChange: (_open: boolean) => void
  onAdjustDataChange: (_data: AdjustData) => void
  onSubmit: () => void
  onCancel: () => void
}

export const LoyaltyAdjustPointsDialog = memo(function LoyaltyAdjustPointsDialog({
  open,
  adjustAccount,
  adjustData,
  isPending,
  onOpenChange,
  onAdjustDataChange,
  onSubmit,
  onCancel,
}: LoyaltyAdjustPointsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Coins className="h-5 w-5 text-primary" />
            Prilagodi točke
          </DialogTitle>
          <DialogDescription>
            Ročno dodajte ali odštejte točke za{' '}
            <strong>{adjustAccount?.customerName || 'stranko'}</strong>.
          </DialogDescription>
        </DialogHeader>
        <LoyaltyAdjustForm
          adjustAccount={adjustAccount}
          adjustData={adjustData}
          isPending={isPending}
          onAdjustDataChange={onAdjustDataChange}
          onSubmit={onSubmit}
          onCancel={onCancel}
        />
      </DialogContent>
    </Dialog>
  )
})
