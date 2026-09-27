'use client'

import { memo } from 'react'
import { Badge } from '@/components/ui/badge'
import { METHOD_LABELS, tipPoolStatusMeta } from './constants'
import { Equal } from 'lucide-react'

interface TipMethodStatusProps {
  distributionMethod: string
  status: string
}

export const TipMethodStatus = memo(function TipMethodStatus({
  distributionMethod,
  status,
}: TipMethodStatusProps) {
  const m = METHOD_LABELS[distributionMethod]
  const Icon = m?.icon || Equal

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium">Metoda:</span>
        <Badge variant="outline" className="gap-1">
          <Icon className="h-3 w-3" />
          {m?.label || distributionMethod}
        </Badge>
      </div>
      <Badge className={tipPoolStatusMeta(status).color}>
        {tipPoolStatusMeta(status).label}
      </Badge>
    </div>
  )
})
