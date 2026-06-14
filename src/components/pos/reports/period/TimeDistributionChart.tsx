'use client'

import { memo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Clock } from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'

// ============================================
// ČASOVNA PORAZDELITEV — Bar chart po urah/dnevih/mesecih
// ============================================

interface TimeDistributionChartProps {
  data: unknown[]
  periodLabel: string
}

export const TimeDistributionChart = memo(function TimeDistributionChart({ data, periodLabel }: TimeDistributionChartProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <Clock className="h-4 w-4" />
          {periodLabel}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="period" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `€${v}`} />
              <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid var(--border)' }} />
              <Legend />
              <Bar dataKey="revenue" name="Trenutno" fill="oklch(0.7 0.15 55)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="prevRevenue" name="Prejšnje" fill="oklch(0.5 0.1 55)" radius={[4, 4, 0, 0]} opacity={0.5} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
})
