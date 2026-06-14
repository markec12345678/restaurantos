'use client'
import React from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Pencil, Trash2 } from 'lucide-react'
import { memo } from 'react'
import {
  type ConfigItem, type TaxRate, type DiningOption, type RevenueCenter,
  type SalesCategory, type PriceGroup, type ServiceCharge, type PrepStation,
  type VoidReason, type NoSaleReason, type AltPaymentType, type Printer,
  type Discount, type GiftCard, type LoyaltyAccount, type Webhook,
  formatDate,
} from './constants'

// ============================================
// KARTICA KONFIGURACIJSKEGA VNOSA
// ============================================
export const ConfigCard = memo(function ConfigCard({
  tabKey,
  item,
  onEdit,
  onDelete,
}: {
  tabKey: string
  item: ConfigItem
  onEdit: () => void
  onDelete: () => void
}) {
  const renderContent = () => {
    switch (tabKey) {
      case 'tax-rates': {
        const d = item as TaxRate
        return (
          <>
            <p className="font-medium text-sm truncate">{d.name}</p>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="default" className="text-xs">{d.rate}%</Badge>
              <span className="text-xs text-muted-foreground">{d.code}</span>
            </div>
            <Badge variant={d.isActive ? 'default' : 'secondary'} className="text-[10px] mt-1.5">
              {d.isActive ? 'Aktivna' : 'Neaktivna'}
            </Badge>
          </>
        )
      }
      case 'dining-options': {
        const d = item as DiningOption
        return (
          <>
            <p className="font-medium text-sm truncate">{d.name}</p>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="outline" className="text-xs">{d.type}</Badge>
              <span className="text-xs text-muted-foreground">{d.prepTimeMinutes} min</span>
            </div>
            {d.linkedServiceCharge && (
              <span className="text-xs text-muted-foreground">Strošek: {d.linkedServiceCharge}</span>
            )}
          </>
        )
      }
      case 'revenue-centers': {
        const d = item as RevenueCenter
        return (
          <>
            <p className="font-medium text-sm truncate">{d.name}</p>
            <Badge variant="outline" className="text-xs mt-1">{d.code}</Badge>
            <Badge variant={d.isActive ? 'default' : 'secondary'} className="text-[10px] mt-1.5">
              {d.isActive ? 'Aktiven' : 'Neaktiven'}
            </Badge>
          </>
        )
      }
      case 'sales-categories': {
        const d = item as SalesCategory
        return (
          <>
            <p className="font-medium text-sm truncate">{d.name}</p>
            <Badge variant="outline" className="text-xs mt-1">{d.code}</Badge>
            <Badge variant={d.isActive ? 'default' : 'secondary'} className="text-[10px] mt-1.5">
              {d.isActive ? 'Aktivna' : 'Neaktivna'}
            </Badge>
          </>
        )
      }
      case 'price-groups': {
        const d = item as PriceGroup
        return (
          <>
            <p className="font-medium text-sm truncate">{d.name}</p>
            {d.description && <p className="text-xs text-muted-foreground truncate mt-0.5">{d.description}</p>}
            <Badge variant={d.isActive ? 'default' : 'secondary'} className="text-[10px] mt-1.5">
              {d.isActive ? 'Aktiven' : 'Neaktiven'}
            </Badge>
          </>
        )
      }
      case 'service-charges': {
        const d = item as ServiceCharge
        return (
          <>
            <p className="font-medium text-sm truncate">{d.name}</p>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="default" className="text-xs">
                {d.type === 'percentage' ? `${d.amount}%` : `€${d.amount.toFixed(2)}`}
              </Badge>
              <Badge variant="outline" className="text-xs">{d.type === 'percentage' ? 'Odstotek' : 'Fiksno'}</Badge>
            </div>
            {d.isAutoApply && (
              <Badge variant="secondary" className="text-[10px] mt-1.5">Samodejno</Badge>
            )}
          </>
        )
      }
      case 'prep-stations': {
        const d = item as PrepStation
        return (
          <>
            <p className="font-medium text-sm truncate">{d.name}</p>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="outline" className="text-xs">{d.type}</Badge>
              <span className="text-xs text-muted-foreground">~{d.avgPrepTime} min</span>
            </div>
          </>
        )
      }
      case 'void-reasons': {
        const d = item as VoidReason
        return (
          <>
            <p className="font-medium text-sm truncate">{d.name}</p>
            <Badge variant={d.isActive ? 'default' : 'secondary'} className="text-[10px] mt-1.5">
              {d.isActive ? 'Aktiven' : 'Neaktiven'}
            </Badge>
          </>
        )
      }
      case 'no-sale-reasons': {
        const d = item as NoSaleReason
        return (
          <>
            <p className="font-medium text-sm truncate">{d.name}</p>
            <Badge variant={d.isActive ? 'default' : 'secondary'} className="text-[10px] mt-1.5">
              {d.isActive ? 'Aktiven' : 'Neaktiven'}
            </Badge>
          </>
        )
      }
      case 'alt-payment-types': {
        const d = item as AltPaymentType
        return (
          <>
            <p className="font-medium text-sm truncate">{d.name}</p>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="outline" className="text-xs">{d.code}</Badge>
              <Badge variant="secondary" className="text-xs">{d.type}</Badge>
            </div>
          </>
        )
      }
      case 'printers': {
        const d = item as Printer
        return (
          <>
            <p className="font-medium text-sm truncate">{d.name}</p>
            <div className="flex flex-wrap items-center gap-1.5 mt-1">
              <Badge variant="outline" className="text-xs">{d.type}</Badge>
              {d.location && <Badge variant="secondary" className="text-xs">{d.location}</Badge>}
            </div>
            <span className="text-xs text-muted-foreground mt-1 block">{d.ipAddress}</span>
          </>
        )
      }
      case 'discounts': {
        const d = item as Discount
        return (
          <>
            <p className="font-medium text-sm truncate">{d.name}</p>
            <div className="flex flex-wrap items-center gap-1.5 mt-1">
              <Badge variant="default" className="text-xs">
                {d.type === 'percentage' ? `${d.amount}%` : `€${d.amount.toFixed(2)}`}
              </Badge>
              <Badge variant="outline" className="text-xs">{d.triggerType}</Badge>
            </div>
            {d.promoCode && <span className="text-xs text-muted-foreground">Koda: {d.promoCode}</span>}
            <div className="flex items-center gap-1.5 mt-1">
              <Badge variant={d.isActive ? 'default' : 'secondary'} className="text-[10px]">
                {d.isActive ? 'Aktiven' : 'Neaktiven'}
              </Badge>
              {d.maxUses > 0 && <span className="text-[10px] text-muted-foreground">Max: {d.maxUses}x</span>}
            </div>
          </>
        )
      }
      case 'gift-cards': {
        const d = item as GiftCard
        return (
          <>
            <p className="font-medium text-sm truncate font-mono">{d.cardNumber}</p>
            <p className="text-xs text-muted-foreground truncate">{d.ownerName || 'Brez lastnika'}</p>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="default" className="text-xs">€{d.balance.toFixed(2)}</Badge>
              <Badge variant="outline" className="text-xs">Začetno: €{d.initialBalance.toFixed(2)}</Badge>
            </div>
            <div className="flex items-center gap-1.5 mt-1">
              <Badge variant={d.status === 'active' ? 'default' : d.status === 'expired' ? 'destructive' : 'secondary'} className="text-[10px]">
                {d.status === 'active' ? 'Aktivna' : d.status === 'expired' ? 'Potekla' : d.status === 'used' ? 'Porabljena' : d.status}
              </Badge>
              {d.expiresAt && <span className="text-[10px] text-muted-foreground">do {formatDate(d.expiresAt)}</span>}
            </div>
          </>
        )
      }
      case 'loyalty': {
        const d = item as LoyaltyAccount
        return (
          <>
            <p className="font-medium text-sm truncate">{d.customerName}</p>
            <p className="text-xs text-muted-foreground truncate">{d.phone || d.email || ''}</p>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="default" className="text-xs">{d.pointsBalance} točk</Badge>
              <Badge variant="outline" className="text-xs">{d.tier}</Badge>
            </div>
          </>
        )
      }
      case 'webhooks': {
        const d = item as Webhook
        return (
          <>
            <p className="font-medium text-sm truncate">{d.name}</p>
            <p className="text-xs text-muted-foreground truncate max-w-full">{d.url}</p>
            <div className="flex items-center gap-1.5 mt-1">
              <Badge variant={d.isActive ? 'default' : 'secondary'} className="text-[10px]">
                {d.isActive ? 'Aktiven' : 'Neaktiven'}
              </Badge>
              {d.events && (
                <Badge variant="outline" className="text-[10px]">
                  {Array.isArray(d.events) ? d.events.length : (d.events.split(',').length)} dogodkov
                </Badge>
              )}
            </div>
          </>
        )
      }
      default:
        return <p className="text-sm text-muted-foreground">Nepoznan tip</p>
    }
  }
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4 space-y-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            {renderContent()}
          </div>
          <div className="flex gap-1 flex-shrink-0">
            <Button variant="ghost" size="icon" aria-label="Uredi" className="h-7 w-7" title="Uredi" onClick={onEdit}>
              <Pencil className="h-3 w-3" />
            </Button>
            <Button variant="ghost" size="icon" aria-label="Izbriši" className="h-7 w-7 text-destructive" title="Izbriši" onClick={onDelete}>
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
})
