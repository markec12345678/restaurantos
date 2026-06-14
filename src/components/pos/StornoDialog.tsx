'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { ShieldOff, Trash2 } from 'lucide-react'
import { useState, memo } from 'react'
import dynamic from 'next/dynamic'
import { toast } from 'sonner'
import { authFetch } from '@/components/pos/PinLogin'
import { queryKeys } from '@/lib/query-keys'
import { STORNO_REASONS, CANCEL_REASONS } from './storno/constants'
import type { StornoDialogProps } from './storno/constants'

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
  const queryClient = useQueryClient()
  const [selectedReason, setSelectedReason] = useState<string | null>(null)
  const [customReason, setCustomReason] = useState('')
  const [confirmText, setConfirmText] = useState('')

  const isPaid = order?.paymentStatus === 'paid'
  const isStorno = order?.paymentStatus === 'storno'
  const isCancelled = order?.status === 'cancelled'

  const canSubmitStorno = selectedReason && (selectedReason !== 'other' || customReason.trim().length >= 3)
  const canSubmitCancel = selectedReason || customReason.trim().length >= 3

  // Storno mutacija — za plačana naročila (FURS)
  const stornoMutation = useMutation({
    mutationFn: async () => {
      if (!order) return null
      const reasonText = selectedReason === 'other'
        ? customReason
        : STORNO_REASONS.find(r => r.id === selectedReason)?.name

      // 1. Storno pri FURS — ustvari storno račun
      const fursRes = await authFetch('/api/furs', {
        method: 'PUT',
        body: JSON.stringify({
          orderId: order.id,
          reason: reasonText,
          reasonCode: selectedReason,
        }),
      })
      const fursResult = await fursRes.json()

      // FIX HIGH: Ce FURS ni na voljo (brez certifikata, timeout, itd.),
      // dovoli storno z rocnim posodabljanjem naročila — POS MORA omogočiti storno
      // tudi ko FURS strežnik ni dosegljiv (FURS zahteva poskus, ne blokado)
      if (!fursRes.ok) {
        toast.warning('FURS storno ni uspel, naročilo posodobljeno ročno')

        // Rocno posodobi naročilo na storno (brez FURS overjanja)
        const orderRes = await authFetch(`/api/orders/${order.id}`, {
          method: 'PUT',
          body: JSON.stringify({
            paymentStatus: 'storno',
            status: 'cancelled',
            cancelReason: `STORNO (brez FURS): ${reasonText}`,
          }),
        })
        if (!orderRes.ok) throw new Error('Napaka pri rocnem storniranju naročila')

        toast.warning('Storno izveden brez FURS overjanja — račun mora biti overjen kasneje', { duration: 5000 })
        return { success: true, message: 'Storno izveden brez FURS overjanja', isSimulation: true }
      }

      // FIX: FURS PUT /api/furs že posodobi naročilo (status:cancelled, stock:returned)
      // znotraj transakcije — NE pošiljaj še enega PUT na /api/orders, ker bi to
      // povzročilo double stock return in double table release!

      return fursResult
    },
    onSuccess: (result) => {
      toast.success(result?.message || 'Storno račun uspešno ustvarjen')
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.all })
      queryClient.invalidateQueries({ queryKey: ['receipt'] })
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.cashRegister.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.tables.all })
      onStornoComplete?.()
      resetAndClose()
    },
    onError: (err: Error) => {
      toast.error(`Napaka pri storniranju: ${err.message}`)
    },
  })

  // Preklic naročila (brez FURS, za neplačana naročila)
  const cancelOrderMutation = useMutation({
    mutationFn: async () => {
      if (!order) return null
      const reasonText = selectedReason === 'other'
        ? customReason
        : CANCEL_REASONS.find(r => r.id === selectedReason)?.name || customReason

      const res = await authFetch(`/api/orders/${order.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          status: 'cancelled',
          cancelReason: reasonText || 'Preklicano',
        }),
      })
      if (!res.ok) throw new Error('Napaka pri preklicu naročila')
      return res.json()
    },
    onSuccess: () => {
      toast.success('Naročilo preklicano')
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.tables.all })
      onStornoComplete?.()
      resetAndClose()
    },
    onError: () => {
      toast.error('Napaka pri preklicu naročila')
    },
  })

  const resetAndClose = () => {
    setSelectedReason(null)
    setCustomReason('')
    setConfirmText('')
    onClose()
  }

  const handleReasonSelect = (reasonId: string) => {
    setSelectedReason(reasonId)
    if (reasonId !== 'other') setCustomReason('')
  }

  if (!order) return null

  const totalWithTip = order.total + (order.tip || 0)

  // Ce je naročilo že stornirano ali preklicano, prikaži informacijo
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
          {/* Opozorilo glede FURS */}
          <StornoWarningBanner isPaid={isPaid} />

          {/* Podatki naročila */}
          <OrderInfoPanel order={order} totalWithTip={totalWithTip} />

          {/* Izbira razloga - obvezno za storno (FURS) */}
          <ReasonSelector
            isPaid={isPaid}
            selectedReason={selectedReason}
            customReason={customReason}
            onReasonSelect={handleReasonSelect}
            onCustomReasonChange={setCustomReason}
          />

          {/* Potrditveno besedilo */}
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
              {stornoMutation.isPending ? 'Storniram...' : (
                <>
                  <ShieldOff className="h-4 w-4 mr-1" />
                  Potrdi storno
                </>
              )}
            </Button>
          ) : (
            <Button
              variant="destructive"
              disabled={!canSubmitCancel || confirmText !== 'PREKLIČI' || cancelOrderMutation.isPending}
              onClick={() => cancelOrderMutation.mutate()}
            >
              {cancelOrderMutation.isPending ? 'Preklicujem...' : (
                <>
                  <Trash2 className="h-4 w-4 mr-1" />
                  Prekliči naročilo
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
})
