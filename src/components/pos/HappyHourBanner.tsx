'use client'

import { useQuery } from '@tanstack/react-query'
import { usePOSStore } from '@/lib/store'
import { Clock, PartyPopper } from 'lucide-react'
import { useEffect, useState } from 'react'
import { authFetch } from '@/components/pos/PinLogin'

interface ActiveHappyHour {
  currentlyActive: boolean
  activeSchedules: Array<{
    id: string
    name: string
    description: string
    startTime: string
    endTime: string
    discountType: string
    discountAmount: number
    priceGroup: { id: string; name: string } | null
  }>
  activePriceGroupIds: string[]
}

export function HappyHourBanner() {
  const { setActivePriceGroupId, setHappyHourActive } = usePOSStore()
  const [timeLeft, setTimeLeft] = useState('')

  const { data } = useQuery<ActiveHappyHour>({
    queryKey: ['happy-hour-status'],
    queryFn: async () => {
      const res = await authFetch('/api/happy-hour')
      return res.json()
    },
    refetchInterval: 60000, // Osveži vsako minuto
  })

  // Samodejni preklop cenika
  useEffect(() => {
    if (data?.currentlyActive && data.activePriceGroupIds.length > 0) {
      setActivePriceGroupId(data.activePriceGroupIds[0])
      setHappyHourActive(true)
    } else {
      setActivePriceGroupId(null)
      setHappyHourActive(false)
    }
  }, [data, setActivePriceGroupId, setHappyHourActive])

  // Odštevanje do konca
  useEffect(() => {
    if (!data?.currentlyActive || !data.activeSchedules[0]) return

    const updateTimer = () => {
      const schedule = data.activeSchedules[0]
      const now = new Date()
      const [endH, endM] = schedule.endTime.split(':').map(Number)
      const endTime = new Date(now)
      endTime.setHours(endH, endM, 0, 0)

      const diff = endTime.getTime() - now.getTime()
      if (diff <= 0) {
        setTimeLeft('0:00')
        return
      }

      const minutes = Math.floor(diff / 60000)
      const hours = Math.floor(minutes / 60)
      const mins = minutes % 60
      setTimeLeft(hours > 0 ? `${hours}:${String(mins).padStart(2, '0')}` : `${mins} min`)
    }

    updateTimer()
    const interval = setInterval(updateTimer, 10000)
    return () => clearInterval(interval)
  }, [data])

  if (!data?.currentlyActive) return null

  const schedule = data.activeSchedules[0]
  if (!schedule) return null

  return (
    <div className="bg-gradient-to-r from-amber-500 via-orange-500 to-red-500 text-white px-4 py-2 flex items-center justify-between animate-pulse-subtle">
      <div className="flex items-center gap-2">
        <PartyPopper className="h-4 w-4" />
        <span className="font-bold text-sm">{schedule.name}</span>
        {schedule.description && (
          <span className="text-xs opacity-90 hidden sm:inline">— {schedule.description}</span>
        )}
        {schedule.discountType === 'percentage' && (
          <span className="bg-white/20 rounded-full px-2 py-0.5 text-xs font-bold">
            -{schedule.discountAmount}%
          </span>
        )}
      </div>
      <div className="flex items-center gap-2 text-xs">
        <Clock className="h-3 w-3" />
        <span>Konec čez {timeLeft}</span>
        <span className="opacity-70">({schedule.startTime}–{schedule.endTime})</span>
      </div>
    </div>
  )
}
