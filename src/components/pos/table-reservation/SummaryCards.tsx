'use client'

import { memo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { CheckCircle, Users, BookOpen, Timer } from 'lucide-react'
import type { SummaryCardsProps } from './constants'

// ============================================
// POVZETEK MIZ IN REZERVACIJ
// ============================================
export const SummaryCards = memo(function SummaryCards({
  availableCount,
  occupiedCount,
  reservedCount,
  pendingCount,
}: SummaryCardsProps) {
  return (
    <div className="grid grid-cols-4 gap-3">
      <Card>
        <CardContent className="p-3 text-center">
          <CheckCircle className="h-5 w-5 text-green-500 mx-auto mb-1" />
          <p className="text-xl font-bold">{availableCount}</p>
          <p className="text-xs text-muted-foreground">Proste mize</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-3 text-center">
          <Users className="h-5 w-5 text-red-500 mx-auto mb-1" />
          <p className="text-xl font-bold">{occupiedCount}</p>
          <p className="text-xs text-muted-foreground">Zasedene mize</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-3 text-center">
          <BookOpen className="h-5 w-5 text-blue-500 mx-auto mb-1" />
          <p className="text-xl font-bold">{reservedCount}</p>
          <p className="text-xs text-muted-foreground">Rezervirane</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-3 text-center">
          <Timer className="h-5 w-5 text-amber-500 mx-auto mb-1" />
          <p className="text-xl font-bold">{pendingCount}</p>
          <p className="text-xs text-muted-foreground">Čakajoče rezervacije</p>
        </CardContent>
      </Card>
    </div>
  )
})
