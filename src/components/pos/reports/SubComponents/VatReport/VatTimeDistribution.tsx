'use client'
import { memo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Clock } from 'lucide-react'
import {
  BarChart, Bar,
  CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'

// ============================================
// DDV Časovna razdelitev — podkomponenta
// ============================================
interface VatTimeDistributionProps {
  data: Array<{ period: string; vat22: number; vat95: number; vat0: number }>
}

export const VatTimeDistribution = memo(function VatTimeDistribution({ data }: VatTimeDistributionProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <Clock className="h-4 w-4" />
          DDV po obdobjih
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="period" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `€${v}`} />
              <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid var(--border)' }} />
              <Legend />
              <Bar dataKey="vat22" name="DDV 22%" fill="#ef4444" stackId="vat" />
              <Bar dataKey="vat95" name="DDV 9.5%" fill="#f59e0b" stackId="vat" />
              <Bar dataKey="vat0" name="DDV 0%" fill="#10b981" stackId="vat" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
})
