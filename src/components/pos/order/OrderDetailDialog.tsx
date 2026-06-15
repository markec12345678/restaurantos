'use client'

import { memo } from 'react'
import dynamic from 'next/dynamic'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { format } from 'date-fns'
import type { OrderType } from './OrderList'

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
          <OrderItemsSection
            orderItems={detailOrder?.orderItems || []}
            paymentStatus={detailOrder?.paymentStatus || ''}
            orderStatus={detailOrder?.status || ''}
            orderId={detailOrder?.id || ''}
            onVoidItem={onVoidItem}
          />
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
