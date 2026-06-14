'use client'

// ============================================
// SEZNAMSKI POGLED — List
// ============================================

import { memo } from 'react'
import { Calendar } from 'lucide-react'
import type { ListViewProps } from './constants'
import { ReservationCard } from './ReservationCard'

export const ListView = memo(function ListView({
  reservations,
  onEdit,
  onStatusChange,
}: ListViewProps) {
  if (reservations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-muted-foreground gap-3">
        <Calendar className="h-12 w-12 opacity-20" />
        <p className="text-sm font-medium">Ni rezervacij</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {reservations.map(r => (
        <ReservationCard
          key={r.id}
          reservation={r}
          onEdit={() => onEdit(r)}
          onStatusChange={onStatusChange}
        />
      ))}
    </div>
  )
})
