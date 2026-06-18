'use client'

// ─── Zavihek Stroski za P&L porocilo ──────────────────────────

import { memo } from 'react'
import { type LucideIcon } from 'lucide-react'
import { Users, Home, Building, BarChart3, Package, Calculator, Receipt } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCurrency, type ExpensesTabProps } from './constants'
import { safeToFixed, safeNum } from '@/lib/safe-format'

interface ExpenseItem {
  label: string
  value: number
  icon: LucideIcon
  color: string
}

export const ExpensesTab = memo(function ExpensesTab({ data }: ExpensesTabProps) {
  const items: ExpenseItem[] = [
    { label: 'Stroski dela', value: data.operatingExpenses.labor, icon: Users, color: 'bg-red-500' },
    { label: 'Najemnina', value: data.operatingExpenses.rent, icon: Home, color: 'bg-orange-500' },
    { label: 'Komunalije', value: data.operatingExpenses.utilities, icon: Building, color: 'bg-yellow-500' },
    { label: 'Marketing', value: data.operatingExpenses.marketing, icon: BarChart3, color: 'bg-blue-500' },
    { label: 'Material', value: data.operatingExpenses.supplies, icon: Package, color: 'bg-green-500' },
    { label: 'Vzdrzevanje', value: data.operatingExpenses.maintenance, icon: Calculator, color: 'bg-purple-500' },
    { label: 'Zavarovanje', value: data.operatingExpenses.insurance, icon: Calculator, color: 'bg-pink-500' },
    { label: 'Ostalo', value: data.operatingExpenses.other, icon: Receipt, color: 'bg-gray-500' },
  ]

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">Razclenitev stroskov</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {items.map(item => {
            const percent = data.operatingExpenses.total > 0 ? (item.value / data.operatingExpenses.total) * 100 : 0
            const IconComp = item.icon
            return (
              <div key={item.label}>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-sm flex items-center gap-2">
                    <IconComp className="h-3 w-3" /> {item.label}
                  </span>
                  <div className="text-right">
                    <span className="font-medium text-sm">{formatCurrency(item.value)}</span>
                    <span className="text-xs text-muted-foreground ml-2">{safeToFixed(percent, 1)}%</span>
                  </div>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div className={`h-full ${item.color} rounded-full transition-all`} style={{ width: `${percent}%` }} />
                </div>
              </div>
            )
          })}
          <div className="pt-3 border-t">
            <div className="flex justify-between items-center">
              <span className="font-medium">Skupaj COGS</span>
              <span className="font-medium text-red-600">{formatCurrency(data.costOfGoods.total)}</span>
            </div>
            <div className="flex justify-between items-center mt-1">
              <span className="font-medium">Skupaj operativni stroski</span>
              <span className="font-medium text-red-600">{formatCurrency(data.operatingExpenses.total)}</span>
            </div>
            <div className="flex justify-between items-center mt-2 pt-2 border-t">
              <span className="font-bold">SKUPAJ STROSKI</span>
              <span className="font-bold text-red-600">{formatCurrency(data.costOfGoods.total + data.operatingExpenses.total)}</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
})
