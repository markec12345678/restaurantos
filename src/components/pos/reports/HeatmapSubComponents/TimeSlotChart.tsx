'use client'
import { memo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Clock } from 'lucide-react'
import {
  BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'

// ============================================
// TIME SLOT CHART — Promet po delih dneva
// ============================================
interface TimeSlotChartProps {
  heatmap: Array<{ hour: number; revenue: number }>
}

export const TimeSlotChart = memo(function TimeSlotChart({ heatmap }: TimeSlotChartProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <Clock className="h-4 w-4" />
          Promet po delih dneva
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={heatmap}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="hour" tick={{ fontSize: 10 }} tickFormatter={(v) => `${v}h`} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `€${v}`} />
              <Tooltip formatter={(value: number, name: string) => [name === 'revenue' ? `€${value.toFixed(2)}` : value, name === 'revenue' ? 'Prihodek' : 'Naročila']} contentStyle={{ borderRadius: '8px', border: '1px solid var(--border)' }} />
              <Bar dataKey="revenue" fill="#f59e0b" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
})
