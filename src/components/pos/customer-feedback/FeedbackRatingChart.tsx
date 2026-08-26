'use client'

// ============================================
// STOLPICNI GRAF DISTRIBUCIJE OCEN
// ============================================

import { memo } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { PIE_COLORS } from './constants'
import type { FeedbackRatingChartProps } from './constants'

export const FeedbackRatingChart = memo(function FeedbackRatingChart({ ratingDistribution }: FeedbackRatingChartProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Distribucija ocen</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={ratingDistribution}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="rating" tick={{ fontSize: 11 }} label={{ value: 'Ocena', position: 'insideBottom', offset: -5, style: { fontSize: 10 } }} />
              <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="count" name="Steilo" radius={[4, 4, 0, 0]}>
                {ratingDistribution.map((_entry, index) => (
                  <Cell key={index} fill={PIE_COLORS[index]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
})
