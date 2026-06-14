'use client'

// ============================================
// KARTICA REZERVACIJE
// ============================================

import { memo } from 'react'
import { format } from 'date-fns'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Clock, Users, Phone, Check, X, Edit, UserCheck, AlertCircle, UtensilsCrossed, Star, MessageSquare } from 'lucide-react'
import { statusLabels, statusColors, sourceLabels } from './constants'
import type { ReservationCardProps } from './constants'

export const ReservationCard = memo(function ReservationCard({
  reservation,
  onEdit,
  onStatusChange,
}: ReservationCardProps) {
  const r = reservation
  const time = format(new Date(r.dateTime), 'HH:mm')
  const endTime = format(new Date(new Date(r.dateTime).getTime() + r.duration * 60000), 'HH:mm')

  const nextActions: Record<string, { status: string; label: string; icon: React.ReactNode }[]> = {
    confirmed: [
      { status: 'seated', label: 'Posedljeno', icon: <UserCheck className="h-3.5 w-3.5" /> },
      { status: 'no_show', label: 'Ni prišel', icon: <AlertCircle className="h-3.5 w-3.5" /> },
      { status: 'cancelled', label: 'Prekliči', icon: <X className="h-3.5 w-3.5" /> },
    ],
    seated: [
      { status: 'completed', label: 'Zaključi', icon: <Check className="h-3.5 w-3.5" /> },
    ],
  }

  return (
    <Card className={`border ${statusColors[r.status]} hover:shadow-sm transition-shadow`}>
      <CardContent className="p-3">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            {/* Čas */}
            <div className="text-center min-w-12">
              <p className="text-lg font-bold">{time}</p>
              <p className="text-[10px] text-muted-foreground">do {endTime}</p>
            </div>

            {/* Podatki */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-semibold text-sm">{r.customerName}</span>
                <Badge variant="outline" className={`text-[9px] h-5 px-1.5 ${statusColors[r.status]}`}>
                  {statusLabels[r.status]}
                </Badge>
                {r.source !== 'walk_in' && (
                  <Badge variant="secondary" className="text-[9px] h-5 px-1.5">
                    {sourceLabels[r.source] || r.source}
                  </Badge>
                )}
              </div>

              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><Users className="h-3 w-3" />{r.partySize} oseb</span>
                {r.table && (
                  <span className="flex items-center gap-1"><UtensilsCrossed className="h-3 w-3" />Miza {r.table.number}</span>
                )}
                {r.customerPhone && (
                  <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{r.customerPhone}</span>
                )}
                {r.duration !== 120 && (
                  <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{r.duration} min</span>
                )}
              </div>

              {r.specialRequests && (
                <div className="flex items-center gap-1 mt-1 text-xs text-amber-600 dark:text-amber-400">
                  <Star className="h-3 w-3" />
                  <span className="truncate">{r.specialRequests}</span>
                </div>
              )}
              {r.notes && (
                <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                  <MessageSquare className="h-3 w-3" />
                  <span className="truncate">{r.notes}</span>
                </div>
              )}
            </div>
          </div>

          {/* Akcije */}
          <div className="flex items-center gap-1 flex-shrink-0">
            {nextActions[r.status]?.map(action => (
              <Button
                key={action.status}
                variant="outline"
                size="sm"
                className="h-7 text-[10px] px-2"
                onClick={() => onStatusChange(r.id, action.status)}
              >
                {action.icon} {action.label}
              </Button>
            ))}
            <Button variant="ghost" size="icon" aria-label="Uredi" className="h-7 w-7" onClick={onEdit}>
              <Edit className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
})
