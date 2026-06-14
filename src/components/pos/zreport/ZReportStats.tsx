'use client'

// ═══════════════════════════════════════════════════════════════
// GLAVNA STATISTIKA — vrstica s KPI karticami Z-poročila
// ═══════════════════════════════════════════════════════════════

import { memo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { DollarSign, Receipt, Calculator, ShoppingBag, Users, TrendingUp } from 'lucide-react'
import { formatCurrency } from './constants'
import type { ZReportStatsProps, StatItemProps } from './constants'

// ─── Pomožna komponenta: StatCard ──────────────────────────────
const StatCard = memo(function StatCard({ icon: Icon, label, value, color }: StatItemProps) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-1">
          <Icon className={`h-4 w-4 ${color}`} />
          <span className="text-xs text-muted-foreground">{label}</span>
        </div>
        <div className={`text-xl font-bold ${color}`}>{value}</div>
      </CardContent>
    </Card>
  )
})

// ─── Glavna komponenta ─────────────────────────────────────────
export const ZReportStats = memo(function ZReportStats({ report }: ZReportStatsProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
      <StatCard icon={DollarSign} label="Skupna prodaja" value={formatCurrency(report.totalSales)} color="text-green-600" />
      <StatCard icon={Receipt} label="Čista prodaja" value={formatCurrency(report.totalNetSales)} color="text-blue-600" />
      <StatCard icon={Calculator} label="DDV" value={formatCurrency(report.totalTax)} color="text-amber-600" />
      <StatCard icon={ShoppingBag} label="Naročila" value={String(report.totalOrders)} color="text-purple-600" />
      <StatCard icon={Users} label="Gostov" value={String(report.totalGuests)} color="text-indigo-600" />
      <StatCard icon={TrendingUp} label="Povprečno" value={formatCurrency(report.avgOrderValue)} color="text-teal-600" />
    </div>
  )
})
