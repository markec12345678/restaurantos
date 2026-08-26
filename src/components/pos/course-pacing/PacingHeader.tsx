'use client'

import { memo } from 'react'
import { Badge } from '@/components/ui/badge'
import { Layers, Flame } from 'lucide-react'
import type { PacingHeaderProps } from './constants'

// ============================================
// GLAVA TEMPA JEDI
// ============================================
export const PacingHeader = memo(function PacingHeader({
  orderCount,
}: PacingHeaderProps) {
  return (
    <div className="flex items-center justify-between px-4 py-3 border-b bg-card flex-shrink-0">
      <div className="flex items-center gap-3">
        <Layers className="h-5 w-5 text-primary" />
        <h1 className="text-lg font-bold">Tempo jedi</h1>
        <Badge variant="outline" className="text-xs">{orderCount} naročil</Badge>
      </div>
      <div className="flex items-center gap-2">
        <Badge variant="outline" className="text-xs gap-1">
          <Flame className="h-3 w-3 text-orange-500" />
          Fire Next Course
        </Badge>
      </div>
    </div>
  )
})
