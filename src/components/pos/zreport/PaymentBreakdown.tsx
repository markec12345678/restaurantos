'use client'

// ═══════════════════════════════════════════════════════════════
// NAČIN PLAČILA + VRSTA NAROČILA — razčlenitev po načinu in vrsti
// ═══════════════════════════════════════════════════════════════

import { memo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Banknote, CreditCard, Smartphone, Package, UtensilsCrossed, ShoppingBag, Truck } from 'lucide-react'
import type { PaymentBreakdownProps, PaymentRowProps } from './constants'

// ─── Pomožna komponenta: PaymentRow ────────────────────────────
const PaymentRow = memo(function PaymentRow({ icon: Icon, label, value, total, color }: PaymentRowProps) {
  const pct = total > 0 ? (value / total) * 100 : 0
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-2 text-sm">
          <Icon className="h-3.5 w-3.5 text-muted-foreground" />
          {label}
        </span>
        <span className="text-sm font-medium">€{(value || 0).toFixed(2)} <span className="text-xs text-muted-foreground">({pct.toFixed(0)}%)</span></span>
      </div>
      <div className="w-full bg-gray-100 dark:bg-gray-800 rounded-full h-1.5">
        <div className={`h-1.5 rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
})

// ─── Glavna komponenta ─────────────────────────────────────────
export const PaymentBreakdown = memo(function PaymentBreakdown({ report }: PaymentBreakdownProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Po načinu plačila */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Po načinu plačila</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <PaymentRow icon={Banknote} label="Gotovina" value={report.cashSales} total={report.totalSales} color="bg-green-500" />
          <PaymentRow icon={CreditCard} label="Kartica" value={report.cardSales} total={report.totalSales} color="bg-blue-500" />
          <PaymentRow icon={Smartphone} label="Mobilno" value={report.mobileSales} total={report.totalSales} color="bg-purple-500" />
          <PaymentRow icon={Package} label="Alternativno" value={report.alternateSales} total={report.totalSales} color="bg-amber-500" />
        </CardContent>
      </Card>

      {/* Po vrsti naročila */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Po vrsti naročila</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <PaymentRow icon={UtensilsCrossed} label="Na mestu" value={report.dineInSales} total={report.totalSales} color="bg-green-500" />
          <PaymentRow icon={ShoppingBag} label="Za s seboj" value={report.takeoutSales} total={report.totalSales} color="bg-blue-500" />
          <PaymentRow icon={Truck} label="Dostava" value={report.deliverySales} total={report.totalSales} color="bg-amber-500" />
        </CardContent>
      </Card>
    </div>
  )
})
