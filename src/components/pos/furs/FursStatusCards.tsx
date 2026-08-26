'use client'

import { memo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Wifi, WifiOff, Server, Key, Activity } from 'lucide-react'
import type { FursStatusCardsProps } from './constants'

// ============================================
// STATUSNE KARTICE — Prikaz statusa FURS povezave
// ============================================

export const FursStatusCards = memo(function FursStatusCards({ isConnected, environment, certPath, verifiedCount }: FursStatusCardsProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <Card>
        <CardContent className="p-4 text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            {isConnected ? <Wifi className="h-4 w-4 text-green-600" /> : <WifiOff className="h-4 w-4 text-red-500" />}
            <p className="text-xs text-muted-foreground">Povezava</p>
          </div>
          <p className={`font-bold ${isConnected ? 'text-green-600' : 'text-red-500'}`}>
            {isConnected ? 'Vzpostavljena' : 'Ni povezave'}
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4 text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Server className="h-4 w-4 text-blue-600" />
            <p className="text-xs text-muted-foreground">Okolje</p>
          </div>
          <p className="font-bold">{environment === 'test' ? 'Testno' : 'Produkcijsko'}</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4 text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Key className="h-4 w-4 text-amber-600" />
            <p className="text-xs text-muted-foreground">Certifikat</p>
          </div>
          <p className={`font-bold ${certPath ? 'text-green-600' : 'text-red-500'}`}>
            {certPath ? 'Naložen' : 'Manjka'}
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4 text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Activity className="h-4 w-4 text-purple-600" />
            <p className="text-xs text-muted-foreground">Overjeni računi</p>
          </div>
          <p className="font-bold">{verifiedCount}</p>
        </CardContent>
      </Card>
    </div>
  )
})
