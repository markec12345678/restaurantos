'use client'

import { memo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { LucideIcon } from 'lucide-react'

interface StatsCardProps {
  title: string
  value: string | number
  subtitle?: string
  icon: LucideIcon
  trend?: 'up' | 'down' | 'neutral'
  className?: string
}

/**
 * StatsCard — prikaz statističnega podatka z ikono in trendom.
 * Ovito z React.memo za preprečevanje odvečnega re-renderja
 * (stari starši z Dashboard ponovno renderirajo pri vsaki spremembi stanja).
 */
export const StatsCard = memo(function StatsCard({ title, value, subtitle, icon: Icon, trend, className }: StatsCardProps) {
  return (
    <Card className={cn('hover:shadow-md transition-shadow', className)}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold">{value}</p>
            {subtitle && (
              <p className={cn(
                'text-xs',
                trend === 'up' && 'text-emerald-600',
                trend === 'down' && 'text-red-500',
                trend === 'neutral' && 'text-muted-foreground',
                !trend && 'text-muted-foreground'
              )}>
                {subtitle}
              </p>
            )}
          </div>
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
})
