'use client'

import { memo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Scale } from 'lucide-react'
import { type RecipeEmptyStateProps } from './constants'

// Prazno stanje, ko ni izbranega recepta
export const RecipeEmptyState = memo(function RecipeEmptyState(_props: RecipeEmptyStateProps) {
  return (
    <Card className="h-full flex items-center justify-center">
      <CardContent className="p-8 text-center">
        <Scale className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
        <p className="text-lg font-medium">Izberite recept</p>
        <p className="text-sm text-muted-foreground">Kliknite na recept na levi za raztegovanje</p>
      </CardContent>
    </Card>
  )
})
