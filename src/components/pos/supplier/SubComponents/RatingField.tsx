'use client'

import { memo } from 'react'
import { Star } from 'lucide-react'

// ============================================
// OCENA — Zvezdice za oceno dobavitelja
// ============================================

interface RatingFieldProps {
  rating: number
  onRatingChange: (_rating: number) => void
}

export const RatingField = memo(function RatingField({
  rating, onRatingChange,
}: RatingFieldProps) {
  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Ocena dobavitelja</p>
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map(star => (
          <button key={star} type="button" onClick={() => onRatingChange(star)} className="transition-transform hover:scale-110" aria-label={star <= rating ? `${star} od 5 zvezdic` : `Izberi ${star} zvezdic`}>
            <Star className={`h-6 w-6 ${star <= rating ? 'text-amber-400 fill-amber-400' : 'text-muted-foreground/30'}`} />
          </button>
        ))}
        <span className="text-xs text-muted-foreground ml-2">{rating > 0 ? `${rating}/5` : 'Ni ocene'}</span>
      </div>
    </div>
  )
})
