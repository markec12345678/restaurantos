'use client'

import { memo } from 'react'
import { UtensilsCrossed, Search } from 'lucide-react'
import type { TranslationValue } from '../translations'

// ============================================
// EMPTY STATES za MenuItemsList
// ============================================

interface EmptySearchResultsProps {
  t: TranslationValue
}

export const EmptySearchResults = memo(function EmptySearchResults({ t }: EmptySearchResultsProps) {
  return (
    <div className="text-center py-12">
      <Search className="h-12 w-12 text-gray-300 mx-auto mb-3" />
      <p className="text-muted-foreground">{t.emptyMenu}</p>
    </div>
  )
})

interface EmptyCategoryProps {
  t: TranslationValue
}

export const EmptyCategory = memo(function EmptyCategory({ t }: EmptyCategoryProps) {
  return (
    <div className="text-center py-12">
      <UtensilsCrossed className="h-12 w-12 text-gray-300 mx-auto mb-3" />
      <p className="text-muted-foreground">{t.emptyMenu}</p>
    </div>
  )
})
