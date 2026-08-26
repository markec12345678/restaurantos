'use client'

import { memo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Bell, CheckCircle2, XCircle, Clock } from 'lucide-react'
import { format } from 'date-fns'
import { channelIcons, channelLabels } from './constants'
import type { NotificationHistoryProps } from './constants'

// Zgodovina poslanih obvestil
export const NotificationHistory = memo(function NotificationHistory({
  notifications,
}: NotificationHistoryProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <Clock className="h-4 w-4" />
          Zadnja obvestila
        </CardTitle>
      </CardHeader>
      <CardContent>
        {notifications.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Bell className="h-8 w-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">Ni poslanih obvestil</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto custom-scrollbar">
            {notifications.map((notif) => {
              const details = typeof notif.details === 'string' ? JSON.parse(notif.details) : (notif.details as Record<string, unknown> || {})
              const channel = (details?.channel as string) || 'unknown'
              const recipient = (details?.recipient as string) || ''
              const success = notif.action === 'NOTIFICATION_SENT'
              const ChannelIcon = channelIcons[channel] || Bell
              return (
                <div key={notif.id} className={`p-2.5 rounded-lg border ${success ? 'border-emerald-200 dark:border-emerald-800' : 'border-red-200 dark:border-red-800'}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <ChannelIcon className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-xs font-medium">{recipient}</span>
                      <Badge variant="outline" className="text-[9px]">{channelLabels[channel] || channel}</Badge>
                    </div>
                    <div className="flex items-center gap-1">
                      {success ? (
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                      ) : (
                        <XCircle className="h-3.5 w-3.5 text-red-500" />
                      )}
                      <span className="text-[10px] text-muted-foreground">
                        {format(new Date(notif.timestamp), 'HH:mm')}
                      </span>
                    </div>
                  </div>
                  {details?.subject && (
                    <p className="text-xs font-medium mt-1">{details.subject as string}</p>
                  )}
                  {details?.message && (
                    <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-1">{details.message as string}</p>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
})
