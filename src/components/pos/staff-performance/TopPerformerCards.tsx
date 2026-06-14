'use client'

// ─── Top izvajalci — poudarjene kartice ───────────────────────

import { memo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Trophy, Star, Zap, Target } from 'lucide-react'
import { ROLE_LABELS, getScoreBadge, type TopPerformerCardsProps } from './constants'

export const TopPerformerCards = memo(function TopPerformerCards({
  topPerformer,
  mostTips,
  fastest,
  bestUpseller,
}: TopPerformerCardsProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {topPerformer && (
        <Card className="border-amber-300 dark:border-amber-800 bg-gradient-to-br from-amber-50 to-yellow-50 dark:from-amber-900/20 dark:to-yellow-900/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Trophy className="h-5 w-5 text-amber-500" />
              <span className="text-xs font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider">Top izvajalec</span>
            </div>
            <p className="text-lg font-bold">{topPerformer.employeeName}</p>
            <p className="text-xs text-muted-foreground mb-2">{ROLE_LABELS[topPerformer.role] || topPerformer.role}</p>
            <div className="flex items-center justify-between">
              <Badge className={getScoreBadge(topPerformer.performanceScore)}>
                {topPerformer.performanceScore}/100
              </Badge>
              <span className="text-sm font-semibold">€{topPerformer.totalRevenue.toFixed(2)}</span>
            </div>
          </CardContent>
        </Card>
      )}
      {mostTips && (
        <Card className="border-emerald-300 dark:border-emerald-800 bg-gradient-to-br from-emerald-50 to-green-50 dark:from-emerald-900/20 dark:to-green-900/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Star className="h-5 w-5 text-emerald-500" />
              <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">Največ napitnin</span>
            </div>
            <p className="text-lg font-bold">{mostTips.employeeName}</p>
            <p className="text-xs text-muted-foreground mb-2">{ROLE_LABELS[mostTips.role] || mostTips.role}</p>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{mostTips.totalOrders} naročil</span>
              <span className="text-sm font-semibold text-emerald-600">€{mostTips.totalTips.toFixed(2)}</span>
            </div>
          </CardContent>
        </Card>
      )}
      {fastest && (
        <Card className="border-blue-300 dark:border-blue-800 bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Zap className="h-5 w-5 text-blue-500" />
              <span className="text-xs font-bold text-blue-700 dark:text-blue-400 uppercase tracking-wider">Najhitrejši</span>
            </div>
            <p className="text-lg font-bold">{fastest.employeeName}</p>
            <p className="text-xs text-muted-foreground mb-2">{ROLE_LABELS[fastest.role] || fastest.role}</p>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Povprečno</span>
              <span className="text-sm font-semibold text-blue-600">{fastest.avgServiceTime.toFixed(0)} min</span>
            </div>
          </CardContent>
        </Card>
      )}
      {bestUpseller && bestUpseller.upsellRate > 0 && (
        <Card className="border-purple-300 dark:border-purple-800 bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Target className="h-5 w-5 text-purple-500" />
              <span className="text-xs font-bold text-purple-700 dark:text-purple-400 uppercase tracking-wider">Najboljši upseller</span>
            </div>
            <p className="text-lg font-bold">{bestUpseller.employeeName}</p>
            <p className="text-xs text-muted-foreground mb-2">{ROLE_LABELS[bestUpseller.role] || bestUpseller.role}</p>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Upsell stopnja</span>
              <span className="text-sm font-semibold text-purple-600">{bestUpseller.upsellRate.toFixed(0)}%</span>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
})
