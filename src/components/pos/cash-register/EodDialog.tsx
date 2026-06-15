'use client'

// ============================================
// ZOD: DIALOG ZA ZAKLJUČEK OBRATOVALNEGA DNEVA
// ============================================

import { memo } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { CalendarCheck } from 'lucide-react'
import type { EodFormType } from './constants'
import { EodPendingWarning } from './EodPendingWarning'
import { EodSummaryStats } from './EodSummaryStats'
import { EodVatBreakdown } from './EodVatBreakdown'
import { EodPaymentMethods } from './EodPaymentMethods'
import { EodCostAnalysis } from './EodCostAnalysis'
import { EodEmployeeBreakdown } from './EodEmployeeBreakdown'
import { EodCloseForm } from './EodCloseForm'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type EodData = any

interface EodDialogProps {
  open: boolean
  onOpenChange: (_open: boolean) => void
  eodData: EodData
  eodLoading: boolean
  form: EodFormType
  onFormChange: (_form: EodFormType) => void
  onSubmit: () => void
  isPending: boolean
}

export const EodDialog = memo(function EodDialog({
  open,
  onOpenChange,
  eodData,
  eodLoading,
  form,
  onFormChange,
  onSubmit,
  isPending,
}: EodDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarCheck className="h-5 w-5" />
            Zaključek obratovalnega dneva (ZOD)
          </DialogTitle>
        </DialogHeader>

        {eodLoading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12" />)}
          </div>
        ) : !eodData ? (
          <p className="text-center py-8 text-muted-foreground">Ni podatkov za ta dan</p>
        ) : (
          <div className="space-y-4">
            <EodPendingWarning eodData={eodData} />
            <EodSummaryStats eodData={eodData} />
            <EodVatBreakdown eodData={eodData} />
            <EodPaymentMethods eodData={eodData} />
            <EodCostAnalysis eodData={eodData} />
            <EodEmployeeBreakdown eodData={eodData} />
            <EodCloseForm eodData={eodData} form={form} onFormChange={onFormChange} onSubmit={onSubmit} isPending={isPending} />
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
})
