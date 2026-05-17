'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { AlertTriangle, ShieldOff, FileWarning, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { authFetch } from '@/components/pos/PinLogin'

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
    status?: string
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

// Razlogi za preklic neplačanega naročila
const CANCEL_REASONS = [
  { id: 'customer-cancel', name: 'Stranka preklicala', description: 'Stranka je odpovedala naročilo' },
  { id: 'waiter-error', name: 'Napaka natakarja', description: 'Naročilo je bilo napačno vneseno' },
  { id: 'kitchen-issue', name: 'Težava v kuhinji', description: 'Artikla ni mogoče pripraviti' },
  { id: 'duplicate-order', name: 'Dvojno naročilo', description: 'Naročilo je bilo vneseno dvakrat' },
  { id: 'other', name: 'Drug razlog', description: 'Drugi razlog za preklic' },
]

// ============================================
// KOMPONENTA
// ============================================
export function StornoDialog({ order, open, onClose, onStornoComplete }: StornoDialogProps) {
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

      // FIX HIGH: Če FURS ni na voljo (brez certifikata, timeout, itd.), 
      // dovoli storno z ročnim posodabljanjem naročila — POS MORA omogočiti storno
      // tudi ko FURS strežnik ni dosegljiv (FURS zahteva poskus, ne blokado)
      if (!fursRes.ok) {
        console.warn('[Storno] FURS storno ni uspel, posodabljam naročilo ročno:', fursResult.error)
        
        // Ročno posodobi naročilo na storno (brez FURS overjanja)
        const orderRes = await authFetch(`/api/orders/${order.id}`, {
          method: 'PUT',
          body: JSON.stringify({
            paymentStatus: 'storno',
            status: 'cancelled',
            cancelReason: `STORNO (brez FURS): ${reasonText}`,
          }),
        })
        if (!orderRes.ok) throw new Error('Napaka pri ročnem storniranju naročila')
        
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
      queryClient.invalidateQueries({ queryKey: ['orders'] })
      queryClient.invalidateQueries({ queryKey: ['receipt'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      queryClient.invalidateQueries({ queryKey: ['cash-register'] })
      queryClient.invalidateQueries({ queryKey: ['tables'] })
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

  const totalWithTip = order.total + (order.tip || 0)

  // Če je naročilo že stornirano ali preklicano, prikaži informacijo
  if (isStorno || isCancelled) {
    return (
      <Dialog open={open} onOpenChange={() => resetAndClose()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-600">
              <FileWarning className="h-5 w-5" />
              {isStorno ? 'Stornirano naročilo' : 'Preklicano naročilo'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-3 text-sm">
              <p className="font-medium">Naročilo #{order.orderNumber} je {isStorno ? 'stornirano' : 'preklicano'}.</p>
              <p className="text-xs text-muted-foreground mt-1">Te operacije ni mogoče razveljaviti.</p>
            </div>
            <div className="bg-muted/50 rounded-lg p-3 space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Znesek</span>
                <span className="font-semibold">€{totalWithTip.toFixed(2)}</span>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={resetAndClose}>Zapri</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
          {isPaid && (
            <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg p-3 flex items-start gap-2 text-sm">
              <AlertTriangle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
              <div className="text-red-800 dark:text-red-200">
                <strong>Storno računa je nepovratna operacija!</strong>
                <span className="block mt-1 text-xs">
                  Ustvari se storno račun z negativnimi zneski, ki se pošlje FURS.
                  Originalni račun se označi kot storniran. Znesek bo vrnjen stranki.
                  Operacija se zabeleži v dnevnik in je vidna v poročilih.
                </span>
              </div>
            </div>
          )}

          {!isPaid && (
            <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-3 flex items-start gap-2 text-sm">
              <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
              <div className="text-amber-800 dark:text-amber-200">
                <strong>Naročilo še ni plačano</strong>
                <span className="block mt-1 text-xs">
                  Naročilo se bo preklicalo in sprostila bo miza (če je dodeljena).
                  Ker ni bilo plačano, FURS storno račun ni potreben.
                  Vsi artikli bodo označeni kot preklicani.
                </span>
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

          {/* Izbira razloga - obvezno za storno (FURS) */}
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

          {/* Za preklic neplačanega - izbira razloga */}
          {!isPaid && (
            <>
              <div>
                <p className="text-sm font-semibold mb-2">
                  Razlog za preklic <span className="text-amber-500">*</span>
                </p>
                <div className="space-y-1.5">
                  {CANCEL_REASONS.map((reason) => (
                    <button
                      key={reason.id}
                      onClick={() => { setSelectedReason(reason.id); if (reason.id !== 'other') setCustomReason('') }}
                      className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors border ${
                        selectedReason === reason.id
                          ? 'border-amber-500 bg-amber-50 dark:bg-amber-950/30'
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
                  placeholder="Vnesite razlog za preklic..."
                  value={customReason}
                  onChange={e => setCustomReason(e.target.value)}
                  className="h-8 text-xs"
                />
              )}
            </>
          )}

          {/* Potrditveno besedilo za storno */}
          {isPaid && canSubmitStorno && (
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

          {/* Potrditveno besedilo za preklic (enostavnejše) */}
          {!isPaid && canSubmitCancel && (
            <>
              <Separator />
              <div>
                <p className="text-xs text-muted-foreground mb-1.5">
                  Za potrditev vpišite <strong>PREKLIČI</strong>:
                </p>
                <Input
                  placeholder="PREKLIČI"
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
}
