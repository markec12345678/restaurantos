'use client'

import { memo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Clock } from 'lucide-react'
import type { WaitlistQueueProps, WaitlistData } from './constants'

// ============================================
// ČAKALNA VRSTA — Prikaz trenutne čakalne vrste
// ============================================

export const WaitlistQueue = memo(function WaitlistQueue({ waitlist, waitlistCount }: WaitlistQueueProps) {
  if (waitlistCount === 0) return null

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Clock className="h-4 w-4" /> Trenutna čakalna vrsta
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {(waitlist || []).filter((w: WaitlistData) => w.status === 'waiting').map((w: WaitlistData, idx: number) => (
            <div key={w.id} className="flex items-center justify-between p-2 rounded-lg border">
              <div className="flex items-center gap-3">
                <span className="text-lg font-bold text-muted-foreground">#{idx + 1}</span>
                <div>
                  <div className="font-medium text-sm">{w.customerName}</div>
                  <div className="text-xs text-muted-foreground">{w.partySize} oseb</div>
                </div>
              </div>
              <Badge variant="outline">
                <Clock className="h-3 w-3 mr-1" />
                ~{w.quotedTime} min
              </Badge>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
})
