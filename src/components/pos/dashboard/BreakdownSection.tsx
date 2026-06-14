'use client'

import { memo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Clock, Receipt, Calculator } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import type { BreakdownSectionProps } from './constants'

/**
 * BreakdownSection — urni pregled prihodka, razdelitev po vrsti naročila
 * in DDV po stopnjah.
 */
export const BreakdownSection = memo(function BreakdownSection({
  hourlyRevenue,
  orderTypeBreakdown,
  vatBreakdown,
  typeLabels,
  todayRevenue,
}: BreakdownSectionProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {/* Urni pregled — črtni diagram */}
      <Card className="md:col-span-1">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2"><Clock className="h-4 w-4" /> Urni pregled</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={hourlyRevenue?.filter((h) => h.hour >= 6 && h.hour <= 23) || []}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `€${v}`} />
                <Tooltip formatter={(value: number) => [`€${value.toFixed(2)}`, 'Prihodek']} />
                <Line type="monotone" dataKey="revenue" stroke="oklch(0.7 0.15 55)" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Vrsta naročila */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2"><Receipt className="h-4 w-4" /> Vrsta naročila</CardTitle>
        </CardHeader>
        <CardContent>
          {orderTypeBreakdown?.length > 0 ? (
            <div className="space-y-3">
              {orderTypeBreakdown.map((item) => (
                <div key={item.type} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{item.type === 'dine-in' ? '🍽️' : item.type === 'takeout' ? '📦' : item.type === 'delivery' ? '🚚' : '❓'}</span>
                    <div>
                      <p className="text-sm font-medium">{typeLabels[item.type] || item.type}</p>
                      <p className="text-xs text-muted-foreground">{item.count} naročil</p>
                    </div>
                  </div>
                  <span className="font-bold text-sm">€{item.revenue.toFixed(2)}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">Ni podatkov</div>
          )}
        </CardContent>
      </Card>

      {/* DDV po stopnjah */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2"><Calculator className="h-4 w-4" /> DDV po stopnjah</CardTitle>
        </CardHeader>
        <CardContent>
          {vatBreakdown?.length > 0 ? (
            <div className="space-y-3">
              {vatBreakdown.map((item) => (
                <div key={item.rate} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="font-medium">DDV {item.rate}%</span>
                    <span className="font-bold">€{item.vat.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Osnova: €{item.base.toFixed(2)}</span>
                    <span>Skupaj: €{(item.base + item.vat).toFixed(2)}</span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-primary rounded-full" style={{ width: `${Math.min(100, (item.base / (todayRevenue || 1)) * 100)}%` }} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">Ni podatkov</div>
          )}
        </CardContent>
      </Card>
    </div>
  )
})
