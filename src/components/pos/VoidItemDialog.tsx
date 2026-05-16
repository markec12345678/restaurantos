'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { AlertTriangle, XCircle, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { authFetch } from '@/components/pos/PinLogin'

// ============================================
// TIPI
// ============================================
interface VoidItemDialogProps {
  orderItem: {
    id: string
    name: string
    quantity: number
    price: number
    vatRate: number
    voided: boolean
  } | null
  orderId: string
  open: boolean
  onClose: () => void
  onVoided?: () => void
}

// ============================================
// KOMPONENTA
// ============================================
export function VoidItemDialog({ orderItem, orderId, open, onClose, onVoided }: VoidItemDialogProps) {
  const queryClient = useQueryClient()
  const [selectedReasonId, setSelectedReasonId] = useState<string | null>(null)
  const [customReason, setCustomReason] = useState('')

  // Naloži razloge za void
  const { data: voidReasons } = useQuery({
    queryKey: ['void-reasons'],
    queryFn: async () => {
      const res = await authFetch('/api/configuration/void-reasons')
      if (!res.ok) return []
      return res.json() as Promise<{ id: string; name: string; isActive: boolean }[]>
    },
    enabled: open,
  })

  // Void mutacija
  const voidMutation = useMutation({
    mutationFn: async () => {
      if (!orderItem) return null
      const res = await authFetch(`/api/order-items/${orderItem.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          voided: true,
          voidReasonId: selectedReasonId,
          voidReasonText: customReason || voidReasons?.find(r => r.id === selectedReasonId)?.name || '',
        }),
      })
      return res.json()
    },
    onSuccess: () => {
      toast.success(`Artikel "${orderItem?.name}" je voidan (poniščen)`)
      queryClient.invalidateQueries({ queryKey: ['orders'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      queryClient.invalidateQueries({ queryKey: ['kitchen'] })
      onVoided?.()
      resetAndClose()
    },
    onError: () => {
      toast.error('Napaka pri poničitvi artikla')
    },
  })

  const resetAndClose = () => {
    setSelectedReasonId(null)
    setCustomReason('')
    onClose()
  }

  const canSubmit = selectedReasonId || customReason.trim().length >= 3

  if (!orderItem) return null

  const itemTotal = orderItem.price * orderItem.quantity
  const vatAmount = itemTotal * (orderItem.vatRate / 100)

  return (
    <Dialog open={open} onOpenChange={() => resetAndClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-600">
            <XCircle className="h-5 w-5" />
            Void artikla (poničitev)
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Opozorilo */}
          <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg p-3 flex items-start gap-2 text-sm">
            <AlertTriangle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
            <div className="text-red-800 dark:text-red-200">
              <strong>Pozor!</strong> Void artikla pomeni, da se artikel poniči in se ne zaračuna stranki.
              {orderItem.vatRate > 0 && (
                <span className="block mt-1 text-xs">
                  Vključno z DDV {orderItem.vatRate}%: €{vatAmount.toFixed(2)} davka se vrne.
                </span>
              )}
              <span className="block mt-1 text-xs">Ta operacija se zabeleži v dnevnik in je vidna v poročilih.</span>
            </div>
          </div>

          {/* Podatki artikla */}
          <div className="bg-muted/50 rounded-lg p-3 space-y-1.5">
            <div className="flex justify-between font-semibold">
              <span>{orderItem.quantity}x {orderItem.name}</span>
              <span>€{itemTotal.toFixed(2)}</span>
            </div>
            {orderItem.vatRate > 0 && (
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>DDV {orderItem.vatRate}%</span>
                <span>€{vatAmount.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-red-600 border-t pt-1.5">
              <span>Skupaj za vračilo</span>
              <span>€{(itemTotal + vatAmount).toFixed(2)}</span>
            </div>
          </div>

          {/* Izbira razloga */}
          <div>
            <p className="text-sm font-semibold mb-2">Razlog za void <span className="text-red-500">*</span></p>
            <div className="space-y-1.5">
              {(voidReasons || []).map((reason) => (
                <button
                  key={reason.id}
                  onClick={() => { setSelectedReasonId(reason.id); setCustomReason('') }}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors border ${
                    selectedReasonId === reason.id
                      ? 'border-red-500 bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300'
                      : 'border-border hover:bg-accent'
                  }`}
                >
                  <XCircle className={`h-4 w-4 ${selectedReasonId === reason.id ? 'text-red-500' : 'text-muted-foreground'}`} />
                  {reason.name}
                </button>
              ))}
            </div>
          </div>

          {/* Ročni razlog */}
          <div>
            <p className="text-xs text-muted-foreground mb-1">Ali vpiši svoj razlog:</p>
            <Input
              placeholder="Npr. Naročena napačna velikost..."
              value={customReason}
              onChange={e => { setCustomReason(e.target.value); setSelectedReasonId(null) }}
              className="h-8 text-xs"
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={resetAndClose}>Prekliči</Button>
          <Button
            variant="destructive"
            disabled={!canSubmit || voidMutation.isPending}
            onClick={() => voidMutation.mutate()}
          >
            {voidMutation.isPending ? 'Poničujem...' : (
              <>
                <XCircle className="h-4 w-4 mr-1" />
                Void artikla
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
