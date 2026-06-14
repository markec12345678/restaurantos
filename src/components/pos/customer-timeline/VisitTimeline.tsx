'use client'

import { memo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Calendar, Star } from 'lucide-react'
import type { GuestVisit } from './constants'
import { formatDate, formatCurrency } from './constants'

// --- Props ---

interface VisitTimelineProps {
  visits: GuestVisit[]
}

// --- Komponenta: Časovnica obiskov ---

export const VisitTimeline = memo(function VisitTimeline({
  visits,
}: VisitTimelineProps) {
  if (visits.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <Calendar className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Ni zabeleženih obiskov</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      {visits.map((visit, _idx) => (
        <Card key={visit.id} className="relative">
          <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-border -z-0" />
          <CardContent className="p-4 pl-10 relative">
            <div className="absolute left-2.5 top-5 h-3 w-3 rounded-full bg-primary border-2 border-background" />
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium text-sm">{formatDate(visit.date)}</span>
                  {visit.table && (
                    <Badge variant="outline" className="text-xs">Miza {visit.table}</Badge>
                  )}
                  {visit.server && (
                    <span className="text-xs text-muted-foreground">Natakar: {visit.server}</span>
                  )}
                </div>
                {visit.items.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-2">
                    {visit.items.slice(0, 5).map((item, i) => (
                      <Badge key={item || i} variant="secondary" className="text-xs">{item}</Badge>
                    ))}
                    {visit.items.length > 5 && (
                      <Badge variant="secondary" className="text-xs">+{visit.items.length - 5}</Badge>
                    )}
                  </div>
                )}
                {visit.rating && (
                  <div className="flex items-center gap-1">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star
                        key={`star-${i}`}
                        className={`h-3 w-3 ${i < visit.rating! ? 'text-yellow-500 fill-yellow-500' : 'text-gray-500'}`}
                      />
                    ))}
                    {visit.feedback && (
                      <span className="text-xs text-muted-foreground ml-2">&quot;{visit.feedback}&quot;</span>
                    )}
                  </div>
                )}
              </div>
              <span className="font-semibold text-sm">{formatCurrency(visit.total)}</span>
            </div>
          </CardContent>
        </Card>
      ))}
    </>
  )
})
