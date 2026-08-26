'use client'

import { memo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { CheckCircle2, XCircle, Phone, Mail } from 'lucide-react'
import type { NotificationStatsCardsProps } from './constants'

// Statistične kartice obvestil
export const NotificationStatsCards = memo(function NotificationStatsCards({
  stats,
}: NotificationStatsCardsProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="h-8 w-8 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            </div>
            <span className="text-xs text-muted-foreground">Poslana danes</span>
          </div>
          <p className="text-2xl font-bold">{stats?.totalSent || 0}</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="h-8 w-8 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
              <XCircle className="h-4 w-4 text-red-600" />
            </div>
            <span className="text-xs text-muted-foreground">Neuspešna</span>
          </div>
          <p className="text-2xl font-bold">{stats?.totalFailed || 0}</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="h-8 w-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
              <Phone className="h-4 w-4 text-blue-600" />
            </div>
            <span className="text-xs text-muted-foreground">SMS</span>
          </div>
          <p className="text-2xl font-bold">{stats?.byType?.sms || 0}</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="h-8 w-8 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
              <Mail className="h-4 w-4 text-purple-600" />
            </div>
            <span className="text-xs text-muted-foreground">E-pošta</span>
          </div>
          <p className="text-2xl font-bold">{stats?.byType?.email || 0}</p>
        </CardContent>
      </Card>
    </div>
  )
})
