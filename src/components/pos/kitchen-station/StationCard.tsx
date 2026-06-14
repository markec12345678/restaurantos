'use client'

import { memo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { AlertTriangle, Clock, CheckCircle, Timer } from 'lucide-react'
import type { Station } from './constants'
import { priorityConfig } from './constants'
import { Pause, Play } from './Icons'

// ============================================
// KARTICA POSAMEZNE KUHINJSKE POSTAJE
// ============================================

interface StationCardProps {
  station: Station
  onToggleStation: (_stationId: string) => void
  onCompleteItem: (_orderId: string, _itemId: string) => void
}

export const StationCard = memo(function StationCard({
  station,
  onToggleStation,
  onCompleteItem,
}: StationCardProps) {
  const loadPercent = station.capacity > 0 ? Math.round((station.currentLoad / station.capacity) * 100) : 0
  const isOverloaded = loadPercent >= 100
  const isHighLoad = loadPercent >= 75

  return (
    <Card className={`transition-all ${isOverloaded ? 'border-red-300 dark:border-red-800' : isHighLoad ? 'border-amber-300 dark:border-amber-800' : ''}`}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <span className="text-lg">{station.icon}</span>
            {station.name}
            <Badge className={station.status === 'active' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300'}>
              {station.status === 'active' ? 'Aktivna' : station.status === 'paused' ? 'Začasno ustavljena' : 'Zaprta'}
            </Badge>
            {isOverloaded && (
              <Badge className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">
                <AlertTriangle className="h-3 w-3 mr-1" /> Preobremenjena
              </Badge>
            )}
          </CardTitle>
          <Button size="sm" variant="ghost" onClick={() => onToggleStation(station.id)}>
            {station.status === 'active' ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {/* Obremenitev */}
        <div className="mb-3">
          <div className="flex justify-between text-xs text-muted-foreground mb-1">
            <span>Obremenitev: {station.currentLoad}/{station.capacity}</span>
            <span>{loadPercent}%</span>
          </div>
          <Progress
            value={loadPercent}
            className={`h-2 ${isOverloaded ? '[&>div]:bg-red-500' : isHighLoad ? '[&>div]:bg-amber-500' : '[&>div]:bg-green-500'}`}
            aria-valuetext={isOverloaded ? 'Preobremenjena' : isHighLoad ? 'Visoka obremenitev' : 'Normalna obremenitev'}
          />
        </div>
        {/* Povprečni čas */}
        <div className="flex items-center gap-3 text-xs text-muted-foreground mb-3">
          <span className="flex items-center gap-1"><Timer className="h-3 w-3" /> Povp. priprava: {station.avgPrepTime} min</span>
        </div>
        {/* Čakalna vrsta */}
        {station.queue.length > 0 ? (
          <div className="space-y-1.5 max-h-[200px] overflow-auto">
            {station.queue.map(item => {
              const prioConf = priorityConfig[item.priority]
              const isOverdue = item.elapsedMinutes > item.estimatedMinutes
              return (
                <div key={item.id} className={`flex items-center justify-between p-2 rounded text-xs border ${isOverdue ? 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/10' : ''}`}>
                  <div className="flex items-center gap-2 min-w-0">
                    <Badge className={`${prioConf.color} text-[10px] px-1 py-0`}>{prioConf.label}</Badge>
                    <span className="truncate font-medium">{item.quantity}x {item.itemName}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`flex items-center gap-1 ${isOverdue ? 'text-red-600 font-bold' : 'text-muted-foreground'}`}>
                      <Clock className="h-3 w-3" /> {item.elapsedMinutes}/{item.estimatedMinutes}m
                    </span>
                    <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => onCompleteItem(item.orderId, item.id)}>
                      <CheckCircle className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="text-center py-3">
            <CheckCircle className="h-5 w-5 text-green-500 mx-auto mb-1" />
            <p className="text-xs text-muted-foreground">Vrstna red je prazna</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
})
