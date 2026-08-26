import { safeToFixed, safeNum } from '@/lib/safe-format'
import { Badge } from '@/components/ui/badge'
import {
  type ConfigItem, type TaxRate, type ServiceCharge,
  type Discount, type GiftCard, type LoyaltyAccount,
  formatDate,
} from './constants'

export function renderTaxRate(item: ConfigItem) {
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

export function renderServiceCharge(item: ConfigItem) {
  const d = item as ServiceCharge
  return (
    <>
      <p className="font-medium text-sm truncate">{d.name}</p>
      <div className="flex items-center gap-2 mt-1">
        <Badge variant="default" className="text-xs">
          {d.type === 'percentage' ? `${d.amount}%` : `€${safeToFixed(d.amount, 2)}`}
        </Badge>
        <Badge variant="outline" className="text-xs">{d.type === 'percentage' ? 'Odstotek' : 'Fiksno'}</Badge>
      </div>
      {d.isAutoApply && (
        <Badge variant="secondary" className="text-[10px] mt-1.5">Samodejno</Badge>
      )}
    </>
  )
}

export function renderDiscount(item: ConfigItem) {
  const d = item as Discount
  return (
    <>
      <p className="font-medium text-sm truncate">{d.name}</p>
      <div className="flex flex-wrap items-center gap-1.5 mt-1">
        <Badge variant="default" className="text-xs">
          {d.type === 'percentage' ? `${d.amount}%` : `€${safeToFixed(d.amount, 2)}`}
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

export function renderGiftCard(item: ConfigItem) {
  const d = item as GiftCard
  return (
    <>
      <p className="font-medium text-sm truncate font-mono">{d.cardNumber}</p>
      <p className="text-xs text-muted-foreground truncate">{d.ownerName || 'Brez lastnika'}</p>
      <div className="flex items-center gap-2 mt-1">
        <Badge variant="default" className="text-xs">€{safeToFixed(d.balance, 2)}</Badge>
        <Badge variant="outline" className="text-xs">Začetno: €{safeToFixed(d.initialBalance, 2)}</Badge>
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

export function renderLoyaltyAccount(item: ConfigItem) {
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
