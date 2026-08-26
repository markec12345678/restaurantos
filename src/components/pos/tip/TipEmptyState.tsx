'use client'

import { memo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { HandCoins, DollarSign } from 'lucide-react'
import { format } from 'date-fns'
import { sl } from 'date-fns/locale'

interface TipEmptyStateProps {
  selectedDate: string
  onGenerate: () => void
}

export const TipEmptyState = memo(function TipEmptyState({
  selectedDate,
  onGenerate,
}: TipEmptyStateProps) {
  return (
    <Card className="text-center py-16">
      <CardContent>
        <HandCoins className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
        <h3 className="text-lg font-semibold mb-2">Ni tip poola za {format(new Date(selectedDate), 'd. MMMM yyyy', { locale: sl })}</h3>
        <p className="text-muted-foreground mb-4">Generirajte tip pool za distribucijo napitnin</p>
        <Button onClick={onGenerate}>
          <DollarSign className="h-4 w-4 mr-2" />
          Generiraj tip pool
        </Button>
      </CardContent>
    </Card>
  )
})
