'use client'

import { memo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import { PIE_COLORS } from '../../constants'

// ============================================
// DDV TORTNI DIAGRAM — Delež po DDV stopnjah
// ============================================

interface VatPieChartProps {
  vatBreakdown: Array<{ rate: number; label: string; baseAmount: number; totalAmount: number }>
  vatColors: Record<string, string>
}

export const VatPieChart = memo(function VatPieChart({ vatBreakdown, vatColors }: VatPieChartProps) {
  const filteredData = vatBreakdown.filter(vr => vr.baseAmount > 0)

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">Delež po DDV stopnjah</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={filteredData}
                dataKey="totalAmount"
                nameKey="label"
                cx="50%"
                cy="50%"
                outerRadius={80}
                label={({ label, percent }: { label: string; percent: number }) => `${label} ${(percent * 100).toFixed(0)}%`}
              >
                {filteredData.map((vr, index) => (
                  <Cell key={`cell-${index}`} fill={vatColors[String(vr.rate)] || PIE_COLORS[index % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(value: number) => [`€${value.toFixed(2)}`, 'Znesek z DDV']} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
})
