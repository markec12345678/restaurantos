'use client'

import { memo } from 'react'
import { Truck } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'

export const DeliveryEmptyState = memo(function DeliveryEmptyState() {
  return (
    <Card className="col-span-full text-center py-16">
      <CardContent>
        <Truck className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
        <h3 className="text-lg font-semibold mb-2">Ni aktivnih dostav</h3>
        <p className="text-muted-foreground">Trenutno ni dostav za prikaz</p>
      </CardContent>
    </Card>
  )
})
