'use client'

import { memo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Settings } from 'lucide-react'
import { locationHasFursCert, type CurrentConfigProps } from './constants'

// ============================================
// TRENUTNA KONFIGURACIJA — Prikaz FURS nastavitev
// ============================================

export const CurrentConfig = memo(function CurrentConfig({ location }: CurrentConfigProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <Settings className="h-4 w-4" />
          Trenutna FURS konfiguracija
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="flex justify-between p-2 bg-muted/50 rounded-lg">
            <span className="text-muted-foreground">Matična št.</span>
            <span className="font-mono">{location?.businessId || '—'}</span>
          </div>
          <div className="flex justify-between p-2 bg-muted/50 rounded-lg">
            <span className="text-muted-foreground">DDV ID</span>
            <span className="font-mono">{location?.taxId || '—'}</span>
          </div>
          <div className="flex justify-between p-2 bg-muted/50 rounded-lg">
            <span className="text-muted-foreground">Blagajna</span>
            <span className="font-mono">{location?.registerNumber || '—'}</span>
          </div>
          <div className="flex justify-between p-2 bg-muted/50 rounded-lg">
            <span className="text-muted-foreground">Poslovni prostor</span>
            <span className="font-mono">{location?.premisesId || '—'}</span>
          </div>
          <div className="flex justify-between p-2 bg-muted/50 rounded-lg">
            <span className="text-muted-foreground">Okolje</span>
            <Badge variant={location?.fursEnvironment === 'production' ? 'default' : 'secondary'}>
              {location?.fursEnvironment === 'production' ? 'Produkcija' : 'Test'}
            </Badge>
          </div>
          <div className="flex justify-between p-2 bg-muted/50 rounded-lg">
            <span className="text-muted-foreground">Certifikat</span>
            <Badge variant={locationHasFursCert(location) ? 'default' : 'secondary'} className={locationHasFursCert(location) ? 'bg-green-600' : ''}>
              {locationHasFursCert(location) ? 'Naložen' : 'Manjka'}
            </Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  )
})
