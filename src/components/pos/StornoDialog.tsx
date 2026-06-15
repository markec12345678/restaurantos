'use client'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { ShieldOff, Trash2 } from 'lucide-react'
import { useState, useCallback, memo } from 'react'
import dynamic from 'next/dynamic'
import type { StornoDialogProps } from './storno/constants'
import { useStornoMutations } from './storno/useStornoMutations'

// Lazy-loaded podkomponente
const AlreadyCancelledView = dynamic(() => import('./storno/AlreadyCancelledView').then(m => ({ default: m.AlreadyCancelledView })), { ssr: false })
const StornoWarningBanner = dynamic(() => import('./storno/StornoWarningBanner').then(m => ({ default: m.StornoWarningBanner })), { ssr: false })
const OrderInfoPanel = dynamic(() => import('./storno/OrderInfoPanel').then(m => ({ default: m.OrderInfoPanel })), { ssr: false })
const ReasonSelector = dynamic(() => import('./storno/ReasonSelector').then(m => ({ default: m.ReasonSelector })), { ssr: false })
const ConfirmInput = dynamic(() => import('./storno/ConfirmInput').then(m => ({ default: m.ConfirmInput })), { ssr: false })

// ============================================
// KOMPONENTA
// ============================================
export const StornoDialog = memo(function StornoDialog({ order, open, onClose, onStornoComplete }: StornoDialogProps) {
  const [selectedReason, setSelectedReason] = useState<string | null>(null)
  const [customReason, setCustomReason] = useState('')
  const [confirmText, setConfirmText] = useState('')

  const isPaid = order?.paymentStatus === 'paid'
  const isStorno = order?.paymentStatus === 'storno'
  const isCancelled = order?.status === 'cancelled'

  const canSubmitStorno = selectedReason && (selectedReason !== 'other' || customReason.trim().length >= 3)
  const canSubmitCancel = selectedReason || customReason.trim().length >= 3

  const resetAndClose = useCallback(() => {
    setSelectedReason(null)
    setCustomReason('')
    setConfirmText('')
    onClose()
  }, [onClose])

  const { stornoMutation, cancelOrderMutation } = useStornoMutations(order, selectedReason, customReason, resetAndClose, onStornoComplete)

  const handleReasonSelect = (reasonId: string) => {
    setSelectedReason(reasonId)
    if (reasonId !== 'other') setCustomReason('')
  }

  if (!order) return null

  const totalWithTip = order.total + (order.tip || 0)

  if (isStorno || isCancelled) {
    return (
      <AlreadyCancelledView
        order={order}
        open={open}
        onClose={resetAndClose}
        isStorno={isStorno}
        totalWithTip={totalWithTip}
      />
    )
  }

  return (
    <Dialog open={open} onOpenChange={() => resetAndClose()}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-600">
            {isPaid ? <ShieldOff className="h-5 w-5" /> : <Trash2 className="h-5 w-5" />}
            {isPaid ? 'Storno računa' : 'Preklic naročila'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <StornoWarningBanner isPaid={isPaid} />
          <OrderInfoPanel order={order} totalWithTip={totalWithTip} />
          <ReasonSelector
            isPaid={isPaid}
            selectedReason={selectedReason}
            customReason={customReason}
            onReasonSelect={handleReasonSelect}
            onCustomReasonChange={setCustomReason}
          />
          <ConfirmInput
            isPaid={isPaid}
            canSubmit={isPaid ? !!canSubmitStorno : !!canSubmitCancel}
            confirmText={confirmText}
            onConfirmTextChange={setConfirmText}
          />
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={resetAndClose}>Nazaj</Button>
          {isPaid ? (
            <Button
              variant="destructive"
              disabled={!canSubmitStorno || confirmText !== 'STORNO' || stornoMutation.isPending}
              onClick={() => stornoMutation.mutate()}
            >
              {stornoMutation.isPending ? 'Storniram...' : (<><ShieldOff className="h-4 w-4 mr-1" />Potrdi storno</>)}
            </Button>
          ) : (
            <Button
              variant="destructive"
              disabled={!canSubmitCancel || confirmText !== 'PREKLIČI' || cancelOrderMutation.isPending}
              onClick={() => cancelOrderMutation.mutate()}
            >
              {cancelOrderMutation.isPending ? 'Preklicujem...' : (<><Trash2 className="h-4 w-4 mr-1" />Prekliči naročilo</>)}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
})
