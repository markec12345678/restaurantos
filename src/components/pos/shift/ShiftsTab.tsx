'use client'

import { memo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { CalendarDays, Plus } from 'lucide-react'
import { ShiftsTabProps } from './constants'
import dynamic from 'next/dynamic'

const ShiftsTable = dynamic(() => import('./ShiftsTable').then(m => ({ default: m.ShiftsTable })), { ssr: false })

export const ShiftsTab = memo(function ShiftsTab({
  shifts,
  shiftsLoading,
  openCreateShift,
  openEditShift,
  startShift,
  completeShift,
  markAbsent,
  onDeleteShift,
}: ShiftsTabProps) {
  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={openCreateShift}><Plus className="h-4 w-4 mr-2" />Dodaj izmeno</Button>
      </div>
      {shiftsLoading ? (
        <div className="space-y-2">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-14" />)}</div>
      ) : shifts.length === 0 ? (
        <div className="text-center py-16">
          <CalendarDays className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
          <h3 className="text-lg font-semibold mb-1">Ni izmen</h3>
          <p className="text-sm text-muted-foreground mb-4">Ustvarite prvo izmeno za začetek razporeda</p>
          <Button onClick={openCreateShift}><Plus className="h-4 w-4 mr-2" />Dodaj izmeno</Button>
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <ShiftsTable
              shifts={shifts}
              openEditShift={openEditShift}
              startShift={startShift}
              completeShift={completeShift}
              markAbsent={markAbsent}
              onDeleteShift={onDeleteShift}
            />
          </CardContent>
        </Card>
      )}
    </div>
  )
})
