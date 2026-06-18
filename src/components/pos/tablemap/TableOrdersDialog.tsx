'use client'

import { memo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Separator } from '@/components/ui/separator'
import { Plus, Users, ShoppingBag, Clock, UtensilsCrossed } from 'lucide-react'
import { format } from 'date-fns'
import { safeToFixed, safeNum } from '@/lib/safe-format'
import { type TableData, type TableOrderData, orderStatusColors, orderStatusLabels } from './constants'

// --- Props ---

interface TableOrdersDialogProps {
  table: TableData | null
  orders: TableOrderData[] | undefined
  onOpenChange: (_open: boolean) => void
  onAddToOrder: (_orderId: string, _orderNumber: number, _tableId: string) => void
  onNewOrderForTable: (_tableId: string, _tableNumber: number) => void
}

// --- Komponenta: Dijalog z naročili za mizo ---

export const TableOrdersDialog = memo(function TableOrdersDialog({
  table,
  orders,
  onOpenChange,
  onAddToOrder,
  onNewOrderForTable,
}: TableOrdersDialogProps) {
  return (
    <Dialog open={!!table} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg" tabIndex={-1}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Miza {table?.number as number} — Naročila
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {(!orders || orders.length === 0) ? (
            <div className="text-center py-8 text-muted-foreground">
              <ShoppingBag className="h-10 w-10 mx-auto mb-2 opacity-20" />
              <p className="text-sm">Ni aktivnih naročil za to mizo</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-96 overflow-y-auto custom-scrollbar">
              {(orders || []).map((order) => (
                <Card key={order.id} className="border-2">
                  <CardContent className="p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-bold">#{order.orderNumber}</span>
                        <Badge variant="outline" className={orderStatusColors[order.status] || ''}>
                          {orderStatusLabels[order.status] || order.status}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        {order.paymentStatus === 'paid' ? (
                          <Badge variant="outline" className="bg-emerald-100 text-emerald-800 text-[10px]">
                            Plačano
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-amber-100 text-amber-800 text-[10px]">
                            Neplačano
                          </Badge>
                        )}
                        <span className="font-bold text-sm">€{safeToFixed(order.total, 2)}</span>
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      <Clock className="h-3 w-3 inline mr-1" />
                      {format(new Date(order.createdAt), 'HH:mm')}
                      {order.customerName && ` · ${order.customerName}`}
                    </div>
                    <div className="space-y-1">
                      {order.orderItems.map(oi => (
                        <div key={oi.id} className="flex justify-between text-sm">
                          <span>{oi.quantity}x {oi.menuItem.name}</span>
                          <span className="text-muted-foreground">€{safeToFixed(oi.price * oi.quantity, 2)}</span>
                        </div>
                      ))}
                    </div>
                    {/* Gumb za dodajanje artiklov k naročilu */}
                    {order.status !== 'completed' && order.status !== 'cancelled' && (
                      <Button
                        size="sm"
                        className="w-full h-8 text-xs"
                        variant="default"
                        onClick={() => onAddToOrder(order.id, order.orderNumber, table?.id as string)}
                      >
                        <UtensilsCrossed className="h-3.5 w-3.5 mr-1.5" />
                        Dodaj artikle k naročilu #{order.orderNumber}
                      </Button>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          <Separator />

          <Button
            className="w-full"
            onClick={() => {
              if (table) {
                onNewOrderForTable(table.id as string, table.number as number)
              }
            }}
          >
            <Plus className="h-4 w-4 mr-2" />
            Dodaj novo naročilo za mizo {table?.number as number}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
})
