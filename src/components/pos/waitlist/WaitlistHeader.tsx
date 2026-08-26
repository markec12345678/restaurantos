'use client'

import { memo } from 'react'
import { Button } from '@/components/ui/button'
import { type WaitlistHeaderProps } from './constants'

// Glava čakalne vrste z gumbom za dodajanje
export const WaitlistHeader = memo(function WaitlistHeader({ waitingCount, notifiedCount, onOpenForm }: WaitlistHeaderProps) {
  return (
    <div className="flex items-center justify-between p-4 border-b bg-white">
      <div className="flex items-center gap-3">
        <h2 className="text-xl font-bold">Čakalna vrsta</h2>
        <span className="bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full text-xs font-medium">
          {waitingCount + notifiedCount} čakajo
        </span>
      </div>
      <Button onClick={onOpenForm} className="bg-orange-500 hover:bg-orange-600 text-white" aria-label="Dodaj v čakalno vrsto">
        + Dodaj v čakalno
      </Button>
    </div>
  )
})
