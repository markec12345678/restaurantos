'use client'

import { memo } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { XCircle, ImageIcon } from 'lucide-react'
import { format } from 'date-fns'
import type { OrderType, OrderItemType } from './OrderList'

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
                  Preklicano: {format(new Date(detailOrder?.cancelledAt || ''), 'dd.MM.yyyy HH:mm')}
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
          <div className="space-y-2">
            <p className="text-sm font-semibold">Artikli</p>
            {(detailOrder?.orderItems || []).map((oi: OrderItemType) => (
              <div key={oi.id} className={`flex items-start justify-between text-sm py-1 gap-2 ${oi.voided ? 'opacity-40 line-through' : ''}`}>
                <div className="flex items-start gap-2 flex-1">
                  {oi.menuItem.image ? (
                    <div className="w-9 h-9 rounded-md overflow-hidden flex-shrink-0">
                      <img src={oi.menuItem.image} alt={oi.menuItem.name} className="w-full h-full object-cover" />
                    </div>
                  ) : (
                    <div className="w-9 h-9 rounded-md bg-muted flex-shrink-0 flex items-center justify-center">
                      <ImageIcon className="h-3.5 w-3.5 text-muted-foreground/50" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{oi.quantity}x {oi.menuItem.name}</span>
                      <Badge variant="outline" className={`text-[10px] h-4 capitalize ${oi.voided ? 'bg-red-100 text-red-800' : ''}`}>{oi.voided ? 'VOID' : oi.status}</Badge>
                    </div>
                    {oi.modifiersJson && (() => {
                      try {
                        const mods = JSON.parse(oi.modifiersJson)
                        if (mods.length > 0) return (
                          <div className="flex flex-wrap gap-0.5 mt-0.5">
                            {mods.map((m: { name: string; price: number }, mi: number) => (
                              <Badge key={mi} variant="outline" className="text-[9px] h-3.5 px-1 py-0">{m.name}{m.price > 0 ? ` +€${m.price.toFixed(2)}` : ''}</Badge>
                            ))}
                          </div>
                        )
                      } catch {
                        // Neveljavni podatki o alergenih — prikaži brez alergenov
                      }
                      return null
                    })()}
                    {oi.notes && <p className="text-xs text-muted-foreground italic mt-0.5">{oi.notes}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <span className="font-medium">€{(oi.price * oi.quantity).toFixed(2)}</span>
                  {!oi.voided && detailOrder?.paymentStatus !== 'paid' && detailOrder?.status !== 'cancelled' && (
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Storniraj"
                      className="h-6 w-6 text-red-500 hover:text-red-700 hover:bg-red-50"
                      onClick={() => {
                        onVoidItem({
                          id: oi.id,
                          name: oi.menuItem.name,
                          quantity: oi.quantity,
                          price: oi.price,
                          vatRate: oi.vatRate || 22.0,
                          voided: false,
                          orderId: detailOrder?.id || '',
                        })
                      }}
                      title="Void artikla"
                    >
                      <XCircle className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
          <Separator />
          <div className="space-y-1 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Vmesna vsota</span><span>€{(detailOrder?.subtotal || 0).toFixed(2)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Davek</span><span>€{(detailOrder?.tax || 0).toFixed(2)}</span></div>
            {Number(detailOrder?.discount || 0) > 0 && <div className="flex justify-between text-emerald-600"><span>Popust</span><span>-€{(detailOrder?.discount || 0).toFixed(2)}</span></div>}
            <div className="flex justify-between font-bold"><span>Skupaj</span><span>€{(detailOrder?.total || 0).toFixed(2)}</span></div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
})
