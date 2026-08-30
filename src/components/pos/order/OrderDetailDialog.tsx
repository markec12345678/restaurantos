'use client'

import { memo, useState, useCallback } from 'react'
import dynamic from 'next/dynamic'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { format } from 'date-fns'
import { toast } from 'sonner'
import { ArrowLeftRight } from 'lucide-react'
import type { OrderType } from './OrderList'
import { safeToFixed, safeNum } from '@/lib/safe-format'
import { authFetch } from '@/components/pos/PinLogin'
import { useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/lib/query-keys'

// Lazy-loaded podkomponenta
const OrderItemsSection = dynamic(() => import('./OrderItemsSection').then(m => ({ default: m.OrderItemsSection })), { ssr: false })

// ============================================
// TIPI
// ============================================
export interface OrderDetailDialogProps {
  detailOrder: OrderType | null
  setDetailOrder: (_order: OrderType | null) => void
  statusColors: Record<string, string>
  statusLabels: Record<string, string>
  paymentStatusLabels: Record<string, string>
  paymentStatusColors: Record<string, string>
  onVoidItem: (_item: { id: string; name: string; quantity: number; price: number; vatRate: number; voided: boolean; orderId: string }) => void
}

// ============================================
// ORDER DETAIL DIALOG - Podrobnosti naročila
// ============================================
export const OrderDetailDialog = memo(function OrderDetailDialog({
  detailOrder,
  setDetailOrder,
  statusColors,
  statusLabels,
  paymentStatusLabels,
  paymentStatusColors,
  onVoidItem,
}: OrderDetailDialogProps) {
  const queryClient = useQueryClient()
  const [showTransfer, setShowTransfer] = useState(false)
  const [transferTableId, setTransferTableId] = useState('')
  const [tables, setTables] = useState<Array<{ id: string; number: number; capacity: number; status: string }>>([])
  const [isTransferring, setIsTransferring] = useState(false)

  const loadTables = useCallback(async () => {
    try {
      const res = await authFetch('/api/tables')
      if (!res.ok) return
      const json = await res.json()
      const arr = Array.isArray(json) ? json : (json.tables ?? [])
      // FIX: OrderType nima tableId direktno — uporabi detailOrder.table?.number za primerjavo
      const currentTableNumber = (detailOrder as { table?: { number?: number } })?.table?.number
      setTables(arr.filter((t: { id: string; status: string; number?: number }) =>
        t.status === 'available' && t.number !== currentTableNumber
      ))
    } catch {
      // ignore
    }
  }, [detailOrder])

  const handleTransfer = useCallback(async () => {
    if (!detailOrder || !transferTableId) return
    setIsTransferring(true)
    try {
      const res = await authFetch(`/api/orders/${detailOrder.id}/transfer`, {
        method: 'POST',
        body: JSON.stringify({ newTableId: transferTableId }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Napaka pri prenosu')
      }
      toast.success('Naročilo preneseno na drugo mizo')
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.tables.all })
      setShowTransfer(false)
      setTransferTableId('')
      setDetailOrder(null)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Napaka pri prenosu')
    } finally {
      setIsTransferring(false)
    }
  }, [detailOrder, transferTableId, queryClient, setDetailOrder])
  return (
    <Dialog open={!!detailOrder} onOpenChange={(open) => !open && setDetailOrder(null)}>
      <DialogContent className="max-w-lg" tabIndex={-1}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Naročilo #{detailOrder?.orderNumber || ''}
            <Badge variant="outline" className={statusColors[detailOrder?.status || ''] || ''}>
              {statusLabels[detailOrder?.status || ''] || detailOrder?.status || ''}
            </Badge>
            {(detailOrder?.paymentStatus === 'paid' || detailOrder?.paymentStatus === 'storno') && (
              <Badge variant="outline" className={paymentStatusColors[detailOrder?.paymentStatus || ''] || ''}>
                {paymentStatusLabels[detailOrder?.paymentStatus || ''] || detailOrder?.paymentStatus || ''}
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {/* Storno/Preklic opozorilo */}
          {(detailOrder?.status === 'cancelled' || detailOrder?.paymentStatus === 'storno') && (
            <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg p-3 space-y-1">
              <p className="text-sm font-semibold text-red-700 dark:text-red-300">
                {detailOrder?.paymentStatus === 'storno' ? 'Stornirano naročilo' : 'Preklicano naročilo'}
              </p>
              {Boolean(detailOrder?.cancelReason) && (
                <p className="text-xs text-red-600 dark:text-red-400">
                  Razlog: {detailOrder?.cancelReason}
                </p>
              )}
              {Boolean(detailOrder?.cancelledAt) && (
                <p className="text-xs text-red-600/70 dark:text-red-400/70">
                  Preklicano: {(() => {
                    // FIX RangeError: Invalid time value
                    const dt = detailOrder?.cancelledAt
                    if (!dt) return '—'
                    try {
                      const d = new Date(dt)
                      if (isNaN(d.getTime())) return '—'
                      return format(d, 'dd.MM.yyyy HH:mm')
                    } catch {
                      return '—'
                    }
                  })()}
                </p>
              )}
              {Boolean(detailOrder?.cancelledBy) && (
                <p className="text-xs text-red-600/70 dark:text-red-400/70">
                  Preklical/a: {detailOrder?.cancelledBy}
                </p>
              )}
            </div>
          )}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div><p className="text-muted-foreground">Stranka</p><p className="font-medium">{detailOrder?.customerName || 'Hodič'}</p></div>
            <div><p className="text-muted-foreground">Vrsta</p><p className="font-medium">{detailOrder?.type === 'dine-in' ? 'Na mestu' : detailOrder?.type === 'takeout' ? 'Za s seboj' : 'Dostava'}</p></div>
            <div><p className="text-muted-foreground">Miza</p><p className="font-medium">{detailOrder?.table ? `Miza ${detailOrder.table.number}` : 'Brez'}</p></div>
            <div>
              <p className="text-muted-foreground">Plačilo</p>
              <div className="flex items-center gap-1">
                <Badge variant="outline" className={paymentStatusColors[detailOrder?.paymentStatus || ''] || 'bg-yellow-100 text-yellow-800'}>
                  {paymentStatusLabels[detailOrder?.paymentStatus || ''] || 'Neplačano'}
                </Badge>
                {Boolean(detailOrder?.paymentMethod) && <span className="text-xs text-muted-foreground uppercase">{detailOrder?.paymentMethod}</span>}
              </div>
            </div>
            <div><p className="text-muted-foreground">Čas</p><p className="font-medium">{detailOrder?.createdAt ? format(new Date(detailOrder.createdAt), 'MMM dd, yyyy HH:mm') : 'Brez'}</p></div>
          </div>
          <Separator />
          <OrderItemsSection
            orderItems={detailOrder?.orderItems || []}
            paymentStatus={detailOrder?.paymentStatus || ''}
            orderStatus={detailOrder?.status || ''}
            orderId={detailOrder?.id || ''}
            onVoidItem={onVoidItem}
          />
          <Separator />
          <div className="space-y-1 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Vmesna vsota</span><span>€{safeToFixed(detailOrder?.subtotal || 0, 2)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Davek</span><span>€{safeToFixed(detailOrder?.tax || 0, 2)}</span></div>
            {Number(detailOrder?.discount || 0) > 0 && <div className="flex justify-between text-emerald-600"><span>Popust</span><span>-€{safeToFixed(detailOrder?.discount || 0, 2)}</span></div>}
            <div className="flex justify-between font-bold"><span>Skupaj</span><span>€{safeToFixed(detailOrder?.total || 0, 2)}</span></div>
          </div>

          {/* Prenesi na drugo mizo — samo za dine-in naročila ki niso plačana */}
          {detailOrder?.type === 'dine-in' && (detailOrder as { tableId?: string })?.tableId && detailOrder?.paymentStatus !== 'paid' && detailOrder?.status !== 'cancelled' && (
            <div className="pt-2 border-t">
              {showTransfer ? (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground">Izberi ciljno mizo:</p>
                  <Select
                    value={transferTableId}
                    onValueChange={setTransferTableId}
                    onOpenChange={(open) => { if (open) loadTables() }}
                  >
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue placeholder="Izberi prosto mizo" />
                    </SelectTrigger>
                    <SelectContent>
                      {tables.map(t => (
                        <SelectItem key={t.id} value={t.id}>
                          Miza {t.number} ({t.capacity} mest)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="flex-1" onClick={() => { setShowTransfer(false); setTransferTableId('') }}>
                      Prekliči
                    </Button>
                    <Button size="sm" className="flex-1" onClick={handleTransfer} disabled={!transferTableId || isTransferring}>
                      <ArrowLeftRight className="h-3.5 w-3.5 mr-1" />
                      {isTransferring ? 'Prenos...' : 'Prenesi'}
                    </Button>
                  </div>
                </div>
              ) : (
                <Button variant="outline" size="sm" className="w-full" onClick={() => setShowTransfer(true)}>
                  <ArrowLeftRight className="h-3.5 w-3.5 mr-1" />
                  Prenesi na drugo mizo
                </Button>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
})
