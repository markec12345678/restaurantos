'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { AlertTriangle, ShieldOff, FileWarning } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

// ============================================
// TIPI
// ============================================
interface StornoDialogProps {
  order: {
    id: string
    orderNumber: number
    total: number
    subtotal: number
    tax: number
    discount: number
    tip: number
    paymentMethod: string
    paymentStatus: string
  } | null
  open: boolean
  onClose: () => void
  onStornoComplete?: () => void
}

// FURS zahtevani razlogi za storno po ZDDV-1
const STORNO_REASONS = [
  { id: 'error', name: 'Napaka na računu', description: 'Podatki na računu so napačni (znesek, DDV, artikli...)' },
  { id: 'duplicate', name: 'Dvojno zaračunan', description: 'Račun je bil izdan dvakrat za isto transakcijo' },
  { id: 'returned', name: 'Vračilo blaga/storitve', description: 'Stranka je vrnila blago ali storitev' },
  { id: 'cancelled', name: 'Preklicana naročnina', description: 'Naročena storitev je bila preklicana' },
  { id: 'discount', name: 'Popust po izdaji', description: 'Popust je bil odobren po izdaji računa' },
  { id: 'other', name: 'Drug razlog', description: 'Drugi razlogi za storno (navesti morate)' },
]

// ============================================
// KOMPONENTA
// ============================================
export function StornoDialog({ order, open, onClose, onStornoComplete }: StornoDialogProps) {
  const queryClient = useQueryClient()
  const [selectedReason, setSelectedReason] = useState<string | null>(null)
  const [customReason, setCustomReason] = useState('')
  const [confirmText, setConfirmText] = useState('')

  const canSubmit = selectedReason && (selectedReason !== 'other' || customReason.trim().length >= 3)

  // Storno mutacija
  const stornoMutation = useMutation({
    mutationFn: async () => {
      if (!order) return null
      const res = await fetch('/api/furs', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: order.id,
          reason: selectedReason === 'other' ? customReason : STORNO_REASONS.find(r => r.id === selectedReason)?.name,
          reasonCode: selectedReason,
        }),
      })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error || 'Napaka pri storniranju')
      return result
    },
    onSuccess: (result) => {
      toast.success(result.message || 'Storno račun uspešno ustvarjen')
      queryClient.invalidateQueries({ queryKey: ['orders'] })
      queryClient.invalidateQueries({ queryKey: ['receipt'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      queryClient.invalidateQueries({ queryKey: ['cash-register'] })
      onStornoComplete?.()
      resetAndClose()
    },
    onError: (err: Error) => {
      toast.error(`Napaka pri storniranju: ${err.message}`)
    },
  })

  // Popolna preklic naročila (brez FURS, za neplačana naročila)
  const cancelOrderMutation = useMutation({
    mutationFn: async () => {
      if (!order) return null
      const res = await fetch(`/api/orders/${order.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'cancelled' }),
      })
      if (!res.ok) throw new Error('Napaka pri preklicu naročila')
      return res.json()
    },
    onSuccess: () => {
      toast.success('Naročilo preklicano')
      queryClient.invalidateQueries({ queryKey: ['orders'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      queryClient.invalidateQueries({ queryKey: ['tables'] })
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

  if (!order) return null

  const isPaid = order.paymentStatus === 'paid'
  const totalWithTip = order.total + (order.tip || 0)

  return (
    <Dialog open={open} onOpenChange={() => resetAndClose()}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-600">
            <FileWarning className="h-5 w-5" />
            {isPaid ? 'Storno računa' : 'Preklic naročila'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Opozorilo glede FURS */}
          {isPaid && (
            <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg p-3 flex items-start gap-2 text-sm">
              <AlertTriangle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
              <div className="text-red-800 dark:text-red-200">
                <strong>Storno računa je nepovratna operacija!</strong>
                <span className="block mt-1 text-xs">
                  Ustvari se storno račun z negativnimi zneski, ki se pošlje FURS.
                  Originalni račun se označi kot storniran. Operacija se zabeleži v dnevnik.
                </span>
              </div>
            </div>
          )}

          {!isPaid && (
            <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-3 flex items-start gap-2 text-sm">
              <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
              <div className="text-amber-800 dark:text-amber-200">
                Naročilo še ni plačano, zato ga lahko samo prekličete (brez FURS storna).
              </div>
            </div>
          )}

          {/* Podatki naročila */}
          <div className="bg-muted/50 rounded-lg p-3 space-y-1.5">
            <div className="flex justify-between font-semibold">
              <span>Naročilo #{order.orderNumber}</span>
              <span>€{totalWithTip.toFixed(2)}</span>
            </div>
            {order.discount > 0 && (
              <div className="flex justify-between text-xs text-emerald-600">
                <span>Popust</span>
                <span>-€{order.discount.toFixed(2)}</span>
              </div>
            )}
            {order.tip > 0 && (
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Napitnina</span>
                <span>€{order.tip.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Način plačila</span>
              <span>{order.paymentMethod || 'Ni plačano'}</span>
            </div>
          </div>

          {/* Izbira razloga - obvezno za storno */}
          {isPaid && (
            <>
              <div>
                <p className="text-sm font-semibold mb-2">
                  Razlog za storno <span className="text-red-500">*</span>
                  <span className="text-xs text-muted-foreground ml-1">(FURS zahteva)</span>
                </p>
                <div className="space-y-1.5">
                  {STORNO_REASONS.map((reason) => (
                    <button
                      key={reason.id}
                      onClick={() => { setSelectedReason(reason.id); if (reason.id !== 'other') setCustomReason('') }}
                      className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors border ${
                        selectedReason === reason.id
                          ? 'border-red-500 bg-red-50 dark:bg-red-950/30'
                          : 'border-border hover:bg-accent'
                      }`}
                    >
                      <div className="font-medium">{reason.name}</div>
                      <div className="text-xs text-muted-foreground">{reason.description}</div>
                    </button>
                  ))}
                </div>
              </div>

              {selectedReason === 'other' && (
                <Input
                  placeholder="Vnesite razlog za storno..."
                  value={customReason}
                  onChange={e => setCustomReason(e.target.value)}
                  className="h-8 text-xs"
                />
              )}
            </>
          )}

          {/* Za preklic neplačanega - preprost razlog */}
          {!isPaid && (
            <div>
              <p className="text-sm font-semibold mb-2">Razlog za preklic</p>
              <Input
                placeholder="Npr. Stranka odpovedala..."
                value={customReason}
                onChange={e => setCustomReason(e.target.value)}
                className="h-8 text-xs"
              />
            </div>
          )}

          {/* Potrditveno besedilo za storno */}
          {isPaid && canSubmit && (
            <>
              <Separator />
              <div>
                <p className="text-xs text-muted-foreground mb-1.5">
                  Za potrditev vpišite <strong>STORNO</strong>:
                </p>
                <Input
                  placeholder="STORNO"
                  value={confirmText}
                  onChange={e => setConfirmText(e.target.value)}
                  className="h-8 text-xs font-mono"
                />
              </div>
            </>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={resetAndClose}>Nazaj</Button>
          {isPaid ? (
            <Button
              variant="destructive"
              disabled={!canSubmit || confirmText !== 'STORNO' || stornoMutation.isPending}
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
              disabled={cancelOrderMutation.isPending}
              onClick={() => cancelOrderMutation.mutate()}
            >
              {cancelOrderMutation.isPending ? 'Preklicujem...' : (
                <>
                  <FileWarning className="h-4 w-4 mr-1" />
                  Prekliči naročilo
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
