'use client'

import { memo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { MessageSquare, Bell } from 'lucide-react'
import { templates, channelIcons, channelLabels } from './constants'
import type { NotificationTemplatesProps } from './constants'

// Predloge obvestil za hitro pošiljanje
export const NotificationTemplates = memo(function NotificationTemplates({
  onUseTemplate,
}: NotificationTemplatesProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <MessageSquare className="h-4 w-4" />
          Predloge obvestil
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {templates.map((tpl, idx) => {
            const ChannelIcon = channelIcons[tpl.channel] || Bell
            return (
              <button
                key={idx}
                className="w-full text-left p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                onClick={() => {
                  onUseTemplate({
                    channel: tpl.channel,
                    recipient: '',
                    subject: tpl.subject,
                    message: tpl.message,
                  })
                }}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium">{tpl.name}</span>
                  <Badge variant="outline" className="text-[10px] gap-1">
                    <ChannelIcon className="h-3 w-3" />
                    {channelLabels[tpl.channel]}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground line-clamp-1">{tpl.message}</p>
              </button>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
})
