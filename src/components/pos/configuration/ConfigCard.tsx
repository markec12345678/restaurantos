'use client'

import React from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Pencil, Trash2 } from 'lucide-react'
import { memo } from 'react'
import { type ConfigItem } from './constants'
import {
  renderTaxRate, renderDiningOption, renderRevenueCenter,
  renderSalesCategory, renderPriceGroup, renderServiceCharge,
  renderPrepStation, renderVoidReason, renderNoSaleReason,
  renderAltPaymentType, renderPrinter, renderDiscount,
  renderGiftCard, renderLoyaltyAccount, renderWebhook,
} from './ConfigCardRenderers'

// ============================================
// KARTICA KONFIGURACIJSKEGA VNOSA
// Renderiranje delegirano v ConfigCardRenderers
// ============================================

const RENDER_MAP: Record<string, (_item: ConfigItem) => React.ReactNode> = {
  'tax-rates': renderTaxRate,
  'dining-options': renderDiningOption,
  'revenue-centers': renderRevenueCenter,
  'sales-categories': renderSalesCategory,
  'price-groups': renderPriceGroup,
  'service-charges': renderServiceCharge,
  'prep-stations': renderPrepStation,
  'void-reasons': renderVoidReason,
  'no-sale-reasons': renderNoSaleReason,
  'alt-payment-types': renderAltPaymentType,
  'printers': renderPrinter,
  'discounts': renderDiscount,
  'gift-cards': renderGiftCard,
  'loyalty': renderLoyaltyAccount,
  'webhooks': renderWebhook,
}

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
  const renderer = RENDER_MAP[tabKey]

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4 space-y-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            {renderer ? renderer(item) : <p className="text-sm text-muted-foreground">Nepoznan tip</p>}
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
