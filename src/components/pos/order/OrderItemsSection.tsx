'use client'

import { memo } from 'react'
import Image from 'next/image'
import { safeToFixed, safeNum } from '@/lib/safe-format'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { XCircle, ImageIcon } from 'lucide-react'
import type { OrderItemType } from './OrderList'

// ============================================
// ORDER ITEMS SECTION — Artikli naročila
// ============================================

interface OrderItemsSectionProps {
  orderItems: OrderItemType[]
  paymentStatus: string
  orderStatus: string
  orderId: string
  onVoidItem: (_item: { id: string; name: string; quantity: number; price: number; vatRate: number; voided: boolean; orderId: string }) => void
}

export const OrderItemsSection = memo(function OrderItemsSection({
  orderItems,
  paymentStatus,
  orderStatus,
  orderId,
  onVoidItem,
}: OrderItemsSectionProps) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-semibold">Artikli</p>
      {(orderItems || []).map((oi: OrderItemType) => (
        <div key={oi.id} className={`flex items-start justify-between text-sm py-1 gap-2 ${oi.voided ? 'opacity-40 line-through' : ''}`}>
          <div className="flex items-start gap-2 flex-1">
            {oi.menuItem.image ? (
              <div className="w-9 h-9 rounded-md overflow-hidden flex-shrink-0 relative">
                <Image src={oi.menuItem.image} alt={oi.menuItem.name} fill sizes="36px" className="object-cover" />
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
                        <Badge key={mi} variant="outline" className="text-[9px] h-3.5 px-1 py-0">{m.name}{m.price > 0 ? ` +€${safeToFixed(m.price, 2)}` : ''}</Badge>
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
            {!oi.voided && paymentStatus !== 'paid' && orderStatus !== 'cancelled' && (
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
                    orderId,
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
  )
})
