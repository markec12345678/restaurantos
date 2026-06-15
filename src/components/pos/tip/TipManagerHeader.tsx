'use client'

import { memo } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { DollarSign, HandCoins, ChevronLeft, ChevronRight } from 'lucide-react'
import type { TipPoolData } from './constants'

// ============================================
// TIP MANAGER HEADER — Naslov + navigacija datuma + gumb za generiranje
// ============================================

interface TipManagerHeaderProps {
  selectedDate: string
  onDateChange: (_date: string) => void
  onDatePrev: () => void
  onDateNext: () => void
  pool: TipPoolData | null
  onGenerate: () => void
}

export const TipManagerHeader = memo(function TipManagerHeader({
  selectedDate, onDateChange, onDatePrev, onDateNext, pool, onGenerate,
}: TipManagerHeaderProps) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <HandCoins className="h-6 w-6 text-green-500" />
          Upravitelj napitnin
        </h2>
        <p className="text-muted-foreground">Distribucija napitnin med zaposlene</p>
      </div>
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" aria-label="Nazaj" onClick={onDatePrev}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Input type="date" value={selectedDate} onChange={(e) => onDateChange(e.target.value)} className="w-40" id="tip-date" />
          <Button variant="outline" size="icon" aria-label="Naprej" onClick={onDateNext}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        {!pool && (
          <Button onClick={onGenerate}>
            <DollarSign className="h-4 w-4 mr-2" />
            Generiraj
          </Button>
        )}
      </div>
    </div>
  )
})
