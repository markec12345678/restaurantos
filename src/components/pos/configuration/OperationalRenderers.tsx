import { Badge } from '@/components/ui/badge'
import {
  type ConfigItem, type DiningOption, type RevenueCenter,
  type SalesCategory, type PriceGroup, type PrepStation,
  type VoidReason, type NoSaleReason, type AltPaymentType, type Printer,
  type Webhook,
} from './constants'

export function renderDiningOption(item: ConfigItem) {
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

export function renderRevenueCenter(item: ConfigItem) {
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

export function renderSalesCategory(item: ConfigItem) {
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

export function renderPriceGroup(item: ConfigItem) {
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

export function renderPrepStation(item: ConfigItem) {
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

export function renderVoidReason(item: ConfigItem) {
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

export function renderNoSaleReason(item: ConfigItem) {
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

export function renderAltPaymentType(item: ConfigItem) {
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

export function renderPrinter(item: ConfigItem) {
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

export function renderWebhook(item: ConfigItem) {
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
