'use client'

import { memo } from 'react'
import { ShoppingCart } from 'lucide-react'
import type { TranslationValue } from '../translations'

// ============================================
// Empty cart view sub-component
// ============================================
interface EmptyCartViewProps {
  t: TranslationValue
}

export const EmptyCartView = memo(function EmptyCartView({ t }: EmptyCartViewProps) {
  return (
    <div className="text-center py-8">
      <ShoppingCart className="h-12 w-12 text-gray-300 mx-auto mb-3" />
      <p className="text-muted-foreground">{t.empty}</p>
    </div>
  )
})
