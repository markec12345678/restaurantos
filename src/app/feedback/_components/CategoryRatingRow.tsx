'use client'

import { memo } from 'react'
import { Star } from 'lucide-react'
import { CATEGORIES } from './constants'

interface CategoryRatingRowProps {
  category: typeof CATEGORIES[number]
  currentRating: number
  onSetRating: (_category: string, _value: number) => void
}

const RATING_LABELS: Record<number, string> = {
  1: 'Slabo',
  2: 'Slabše',
  3: 'V redu',
  4: 'Dobro',
  5: 'Odlično',
}

export const CategoryRatingRow = memo(function CategoryRatingRow({
  category,
  currentRating,
  onSetRating,
}: CategoryRatingRowProps) {
  const CatIcon = category.icon
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <CatIcon className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium">{category.label}</span>
      </div>
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map(star => (
          <button
            key={star}
            onClick={() => onSetRating(category.id, star)}
            className="p-1 transition-transform hover:scale-110 active:scale-95"
          >
            <Star className={`h-8 w-8 transition-colors ${
              star <= currentRating ? 'text-amber-400 fill-amber-400' : 'text-gray-300 dark:text-gray-600'
            }`} />
          </button>
        ))}
        {currentRating > 0 && (
          <span className="text-sm font-medium ml-2 text-amber-600">
            {RATING_LABELS[currentRating]}
          </span>
        )}
      </div>
    </div>
  )
})
