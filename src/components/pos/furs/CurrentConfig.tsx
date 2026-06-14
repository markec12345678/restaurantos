'use client'

import { memo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Settings } from 'lucide-react'
import type { CurrentConfigProps } from './constants'

// ============================================
// TRENUTNA KONFIGURACIJA — Prikaz FURS nastavitev
// ============================================

export const CurrentConfig = memo(function CurrentConfig({ settings }: CurrentConfigProps) {
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
            <span className="font-mono">{settings?.businessId || '—'}</span>
          </div>
          <div className="flex justify-between p-2 bg-muted/50 rounded-lg">
            <span className="text-muted-foreground">DDV ID</span>
            <span className="font-mono">{settings?.taxId || '—'}</span>
          </div>
          <div className="flex justify-between p-2 bg-muted/50 rounded-lg">
            <span className="text-muted-foreground">Blagajna</span>
            <span className="font-mono">{settings?.registerNumber || '—'}</span>
          </div>
          <div className="flex justify-between p-2 bg-muted/50 rounded-lg">
            <span className="text-muted-foreground">Poslovni prostor</span>
            <span className="font-mono">{settings?.premisesId || '—'}</span>
          </div>
          <div className="flex justify-between p-2 bg-muted/50 rounded-lg">
            <span className="text-muted-foreground">Okolje</span>
            <Badge variant={settings?.fursEnvironment === 'production' ? 'default' : 'secondary'}>
              {settings?.fursEnvironment === 'production' ? 'Produkcija' : 'Test'}
            </Badge>
          </div>
          <div className="flex justify-between p-2 bg-muted/50 rounded-lg">
            <span className="text-muted-foreground">Certifikat</span>
            <Badge variant={settings?.fursCertPath ? 'default' : 'secondary'} className={settings?.fursCertPath ? 'bg-green-600' : ''}>
              {settings?.fursCertPath ? 'Naložen' : 'Manjka'}
            </Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  )
})
