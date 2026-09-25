'use client'

// ============================================
// R129 (P1-07) — seznam razlagalnih faktorjev predloga
// Faktorji so že človeku berljivi stavki (strežnik jih sestavi) —
// prikažemo jih kot navaden seznam; dolgi seznami do max-h z drsenjem
// (hišno pravilo max-h-96 + custom-scrollbar iz globals.css).
// ============================================

import { cn } from '@/lib/utils'

interface FactorsListProps {
  factors: string[]
  className?: string
  maxHeightClass?: string
}

export function FactorsList({ factors, className, maxHeightClass = 'max-h-96' }: FactorsListProps) {
  if (!factors || factors.length === 0) {
    return <p className={cn('text-xs text-muted-foreground', className)}>Ni dodatne razlage za ta predlog.</p>
  }
  return (
    <ul className={cn('custom-scrollbar space-y-1 overflow-y-auto pr-1', maxHeightClass, className)}>
      {factors.map((factor, i) => (
        <li key={i} className="flex items-start gap-1.5 text-xs text-muted-foreground">
          <span aria-hidden className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-muted-foreground/60" />
          <span>{factor}</span>
        </li>
      ))}
    </ul>
  )
}
