'use client'

import { memo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { CalendarDays, ArrowUpRight, ArrowDownRight } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import type { WoWComparisonProps } from './constants'

/**
 * WoWComparison — primerjava s prejšnjim tednom (Week-over-Week).
 * Prikazuje spremembe prihodka, naročil in povprečnega naročila
 * ter dnevni stolpčni diagram.
 */
export const WoWComparison = memo(function WoWComparison({ wow, wowChartData }: WoWComparisonProps) {
  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-primary" />
          Primerjava s prejšnjim tednom (WoW)
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          {/* Prihodek WoW */}
          <div className="p-3 rounded-lg bg-muted/50">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground font-medium">Prihodek</span>
              {(wow?.changes?.revenue || 0) >= 0 ? (
                <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400 text-[10px]">
                  <ArrowUpRight className="h-3 w-3 mr-0.5" />+{(wow?.changes?.revenue || 0).toFixed(1)}%
                </Badge>
              ) : (
                <Badge className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 text-[10px]">
                  <ArrowDownRight className="h-3 w-3 mr-0.5" />{(wow?.changes?.revenue || 0).toFixed(1)}%
                </Badge>
              )}
            </div>
            <p className="text-lg font-bold">€{(wow?.thisWeek?.revenue || 0).toFixed(2)}</p>
            <p className="text-[10px] text-muted-foreground">Prejšnji teden: €{(wow?.lastWeek?.revenue || 0).toFixed(2)}</p>
          </div>
          {/* Naročila WoW */}
          <div className="p-3 rounded-lg bg-muted/50">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground font-medium">Naročila</span>
              {(wow?.changes?.orders || 0) >= 0 ? (
                <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400 text-[10px]">
                  <ArrowUpRight className="h-3 w-3 mr-0.5" />+{(wow?.changes?.orders || 0).toFixed(1)}%
                </Badge>
              ) : (
                <Badge className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 text-[10px]">
                  <ArrowDownRight className="h-3 w-3 mr-0.5" />{(wow?.changes?.orders || 0).toFixed(1)}%
                </Badge>
              )}
            </div>
            <p className="text-lg font-bold">{wow?.thisWeek?.orders || 0}</p>
            <p className="text-[10px] text-muted-foreground">Prejšnji teden: {wow?.lastWeek?.orders || 0}</p>
          </div>
          {/* Povprečno naročilo WoW */}
          <div className="p-3 rounded-lg bg-muted/50">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground font-medium">Povpr. naročilo</span>
              {(wow?.changes?.avgOrder || 0) >= 0 ? (
                <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400 text-[10px]">
                  <ArrowUpRight className="h-3 w-3 mr-0.5" />+{(wow?.changes?.avgOrder || 0).toFixed(1)}%
                </Badge>
              ) : (
                <Badge className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 text-[10px]">
                  <ArrowDownRight className="h-3 w-3 mr-0.5" />{(wow?.changes?.avgOrder || 0).toFixed(1)}%
                </Badge>
              )}
            </div>
            <p className="text-lg font-bold">€{(wow?.thisWeek?.avgOrder || 0).toFixed(2)}</p>
            <p className="text-[10px] text-muted-foreground">Prejšnji teden: €{(wow?.lastWeek?.avgOrder || 0).toFixed(2)}</p>
          </div>
        </div>
        {/* Dnevni WoW diagram */}
        {wowChartData.length > 0 && (
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={wowChartData} barGap={4}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="day" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `€${v}`} />
                <Tooltip formatter={(value: number, name: string) => [`€${value.toFixed(2)}`, name]} contentStyle={{ borderRadius: '8px', border: '1px solid var(--border)' }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="Ta teden" fill="oklch(0.7 0.15 55)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Prejšnji teden" fill="oklch(0.6 0.1 250)" radius={[4, 4, 0, 0]} opacity={0.6} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  )
})
