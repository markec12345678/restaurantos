'use client'

import { memo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { CheckCircle } from 'lucide-react'
import { type AlertEmptyStateProps } from './constants'

// Prazno stanje, ko ni alertov
export const AlertEmptyState = memo(function AlertEmptyState(_props: AlertEmptyStateProps) {
  return (
    <Card>
      <CardContent className="p-8 text-center">
        <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-3" />
        <p className="text-lg font-medium">Vse zaloge so v redu</p>
        <p className="text-sm text-muted-foreground">Ni artiklov pod minimalno zalogo</p>
      </CardContent>
    </Card>
  )
})
