'use client'

import { memo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { AlertTriangle } from 'lucide-react'
import { statusConfig, statusBadgeStyles } from './constants'
import type { HaccpEntry } from './types'

interface HaccpAlertsProps {
  allEntries: HaccpEntry[]
  activeTab: string
  onTabChange: (_tab: string) => void
}

export const HaccpAlerts = memo(function HaccpAlerts({
  allEntries,
  activeTab,
  onTabChange,
}: HaccpAlertsProps) {
  const alertEntries = allEntries.filter((e) => e.status === 'warning' || e.status === 'critical')
  if (alertEntries.length === 0) return null

  return (
    <Card className="border-red-200 dark:border-red-900/50">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <AlertTriangle className="h-5 w-5 text-red-500" />
          <span className="font-semibold text-red-600 dark:text-red-400">
            Aktivna opozorila ({alertEntries.length})
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          {alertEntries.slice(0, 8).map((entry) => {
            const cfg = statusConfig[entry.status]
            return (
              <Badge
                key={entry.id}
                className={`text-xs cursor-pointer ${statusBadgeStyles[entry.status]}`}
                role="button"
                tabIndex={0}
                onClick={() => {
                  const cat = entry.category
                  if (activeTab !== cat) onTabChange(cat)
                }}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); const cat = entry.category; if (activeTab !== cat) onTabChange(cat) } }}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${cfg.dotColor} mr-1`} aria-hidden="true" />
                {entry.title}: {entry.value || cfg.label}
                {!entry.correctiveAction && ' \u26A0 Brez ukrepa'}
              </Badge>
            )
          })}
          {alertEntries.length > 8 && (
            <Badge variant="outline" className="text-xs">
              +{alertEntries.length - 8} ve\u010D
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  )
})
