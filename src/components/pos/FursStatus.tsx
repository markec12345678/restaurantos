'use client'

import { memo } from 'react'
import { Badge } from '@/components/ui/badge'
import { Shield } from 'lucide-react'
import type { FursEnvironment, FursStatus as FursStatusType } from './furs/constants'

// ============================================
// FURS STATUS — Prikaz stanja FURS povezave
// ============================================

interface FursStatusProps {
  fursStatus: FursStatusType | undefined
  environment: FursEnvironment
  certPath: string
  isConnected: boolean
  isSimulation: boolean
}

export const FursStatus = memo(function FursStatus({
  isSimulation,
  isConnected,
  environment,
  certPath,
}: FursStatusProps) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="h-6 w-6" />
            FURS Davčno potrjevanje
          </h2>
          <p className="text-muted-foreground">Upravljanje FURS certifikata in overjanje računov</p>
        </div>
        <Badge variant={isSimulation ? 'secondary' : 'default'} className={isSimulation ? '' : 'bg-green-600'}>
          {isSimulation ? 'Simulacija' : 'Produkcija'}
        </Badge>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 border rounded-lg text-center">
          <p className="text-xs text-muted-foreground">Povezava</p>
          <p className={`text-lg font-bold ${isConnected ? 'text-green-600' : 'text-red-500'}`}>
            {isConnected ? 'Povezano' : 'Nepovezano'}
          </p>
        </div>
        <div className="p-4 border rounded-lg text-center">
          <p className="text-xs text-muted-foreground">Okolje</p>
          <p className="text-lg font-bold capitalize">{environment}</p>
        </div>
        <div className="p-4 border rounded-lg text-center">
          <p className="text-xs text-muted-foreground">Certifikat</p>
          <p className="text-sm font-medium truncate" title={certPath}>{certPath || 'Ni nastavljen'}</p>
        </div>
        <div className="p-4 border rounded-lg text-center">
          <p className="text-xs text-muted-foreground">Način</p>
          <p className="text-lg font-bold">{isSimulation ? 'Simulacija' : 'Produkcija'}</p>
        </div>
      </div>
    </div>
  )
})
