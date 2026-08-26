'use client'

// ─── Scatter graf za Menu Engineering ─────────────────────────

import { memo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Target, Info } from 'lucide-react'
import {
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, ZAxis, Legend, ReferenceLine,
} from 'recharts'
import { QUADRANT_COLORS, QUADRANT_LABELS, type ScatterViewProps } from './constants'
import { MatrixTooltip } from './MatrixTooltip'

export const ScatterView = memo(function ScatterView({
  chartData,
  medianProfitability,
  medianPopularity,
}: ScatterViewProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Target className="h-4 w-4" />
          Profitabilnost vs Priljubljenost
          <Info className="h-3 w-3 text-muted-foreground" />
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[400px]">
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis
                type="number"
                dataKey="x"
                name="Prodano"
                label={{ value: 'Priljubljenost (kolicina)', position: 'insideBottom', offset: -10, style: { fontSize: 11 } }}
                tick={{ fontSize: 10 }}
              />
              <YAxis
                type="number"
                dataKey="y"
                name="Bruto dobcek %"
                domain={[0, 100]}
                label={{ value: 'Profitabilnost (%)', angle: -90, position: 'insideLeft', offset: 10, style: { fontSize: 11 } }}
                tick={{ fontSize: 10 }}
              />
              <ZAxis type="number" dataKey="z" range={[80, 400]} name="Prihodek" />
              <Tooltip content={<MatrixTooltip />} />
              <ReferenceLine
                y={medianProfitability}
                stroke="#94a3b8"
                strokeDasharray="5 5"
                label={{ value: 'Mediana profit.', position: 'insideTopRight', style: { fontSize: 9, fill: '#94a3b8' } }}
              />
              <ReferenceLine
                x={medianPopularity}
                stroke="#94a3b8"
                strokeDasharray="5 5"
                label={{ value: 'Mediana priljub.', position: 'insideTopRight', style: { fontSize: 9, fill: '#94a3b8' } }}
              />
              <Scatter data={chartData} fill="#8884d8">
                {chartData.map((entry, index) => (
                  <Cell key={index} fill={QUADRANT_COLORS[entry.quadrant]} fillOpacity={0.8} />
                ))}
              </Scatter>
              <Legend
                content={() => (
                  <div className="flex justify-center gap-4 mt-2">
                    {Object.entries(QUADRANT_LABELS).map(([key, label]) => (
                      <div key={key} className="flex items-center gap-1.5 text-xs">
                        <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: QUADRANT_COLORS[key as keyof typeof QUADRANT_COLORS] }} />
                        <span>{label}</span>
                      </div>
                    ))}
                  </div>
                )}
              />
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
})
