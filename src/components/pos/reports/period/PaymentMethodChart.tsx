'use client'

import { safeToFixed, safeNum } from '@/lib/safe-format'
import { memo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CreditCard, Wallet, Smartphone } from 'lucide-react'
import { PIE_COLORS, paymentMethodLabels } from '../constants'
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
} from 'recharts'

// ============================================
// PLAČILNE METODE — Pie chart + povzetek
// ============================================

interface PaymentMethodChartProps {
  paymentMethods: { method: string; revenue: number }[]
  cashRegister: { totalCashSales: number; totalCardSales: number; totalMobileSales: number }
  fmt: (_n: number) => string
}

export const PaymentMethodChart = memo(function PaymentMethodChart({ paymentMethods, cashRegister, fmt }: PaymentMethodChartProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <CreditCard className="h-4 w-4" />
          Plačilne metode
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={paymentMethods}
                dataKey="revenue"
                nameKey="method"
                cx="50%"
                cy="50%"
                outerRadius={80}
                label={({ method, percent }: { method: string; percent: number }) => `${paymentMethodLabels[method] || method} ${safeToFixed(percent * 100, 0)}%`}
              >
                {paymentMethods.map((_: unknown, index: number) => (
                  <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(value: number) => [`€${safeToFixed(value, 2)}`, 'Prihodek']} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        {/* Podatki o plačilih */}
        <div className="grid grid-cols-3 gap-3 mt-4">
          <div className="text-center p-2 bg-green-50 dark:bg-green-900/20 rounded-lg">
            <Wallet className="h-4 w-4 mx-auto text-green-600 mb-1" />
            <p className="text-xs text-muted-foreground">Gotovina</p>
            <p className="font-bold text-sm">{fmt(cashRegister.totalCashSales)}</p>
          </div>
          <div className="text-center p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <CreditCard className="h-4 w-4 mx-auto text-blue-600 mb-1" />
            <p className="text-xs text-muted-foreground">Kartice</p>
            <p className="font-bold text-sm">{fmt(cashRegister.totalCardSales)}</p>
          </div>
          <div className="text-center p-2 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
            <Smartphone className="h-4 w-4 mx-auto text-purple-600 mb-1" />
            <p className="text-xs text-muted-foreground">Mobilno</p>
            <p className="font-bold text-sm">{fmt(cashRegister.totalMobileSales)}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
})
