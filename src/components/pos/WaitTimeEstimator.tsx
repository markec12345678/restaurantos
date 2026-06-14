'use client'
// ═══════════════════════════════════════════════════════════════
// RestaurantOS — Wait Time Estimator
// AI-ocena čakalne dobe za goste
// Bazirano na: trenutna zasedenost, povprečen čas obroka,
// velikost skupine, dan v tednu, ura
// ═══════════════════════════════════════════════════════════════
import { useQuery } from '@tanstack/react-query'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { authFetch } from '@/components/pos/PinLogin'
import { queryKeys } from '@/lib/query-keys'
import { Timer } from 'lucide-react'
import { useState, useMemo, useCallback, memo } from 'react'
import dynamic from 'next/dynamic'
import { computeEstimation, computeAreaOccupancy } from './wait-time/constants'
import type { TableData, WaitlistData } from './wait-time/constants'

// Lazy-loaded pod-komponente
const WaitEstimateCard = dynamic(() => import('./wait-time/WaitEstimateCard').then((m) => m.WaitEstimateCard), { ssr: false })
const StatsGrid = dynamic(() => import('./wait-time/StatsGrid').then((m) => m.StatsGrid), { ssr: false })
const AreaOccupancyChart = dynamic(() => import('./wait-time/AreaOccupancyChart').then((m) => m.AreaOccupancyChart), { ssr: false })
const EstimationFactors = dynamic(() => import('./wait-time/EstimationFactors').then((m) => m.EstimationFactors), { ssr: false })
const WaitlistQueue = dynamic(() => import('./wait-time/WaitlistQueue').then((m) => m.WaitlistQueue), { ssr: false })

export const WaitTimeEstimator = memo(function WaitTimeEstimator() {
  const [partySize, setPartySize] = useState('2')
  const [diningType, setDiningType] = useState('dine-in')

  const { data: tables, isLoading: loadingTables } = useQuery({
    queryKey: queryKeys.tables.all,
    queryFn: async () => {
      const res = await authFetch('/api/tables')
      return res.json()
    },
  })

  const { data: waitlist, isLoading: loadingWaitlist } = useQuery({
    queryKey: queryKeys.waitlist.all,
    queryFn: async () => {
      const res = await authFetch('/api/waitlist')
      return res.json()
    },
  })

  const { data: orders } = useQuery({
    queryKey: ['active-orders'],
    queryFn: async () => {
      const res = await authFetch('/api/orders?status=pending,in-progress&limit=50')
      return res.json()
    },
  })

  // Izračunaj čakalno dobo
  const estimation = useMemo(
    () => computeEstimation(tables as TableData[] | undefined, waitlist as WaitlistData[] | undefined, orders, partySize, diningType),
    [tables, waitlist, orders, partySize, diningType],
  )

  const handlePartySizeChange = useCallback((v: string) => setPartySize(v), [])
  const handleDiningTypeChange = useCallback((v: string) => setDiningType(v), [])

  const areaOccupancy = useMemo(
    () => computeAreaOccupancy(tables as TableData[] | undefined),
    [tables],
  )

  if (loadingTables || loadingWaitlist) {
    return (
      <div className="space-y-4 p-4">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-3 gap-4">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-28" />)}</div>
        <Skeleton className="h-48" />
      </div>
    )
  }

  return (
    <div className="space-y-4 p-2 overflow-y-auto h-full custom-scrollbar">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Timer className="h-6 w-6 text-blue-500" />
          Ocena čakalne dobe
        </h2>
        <p className="text-muted-foreground">AI ocena čakanja za goste glede na zasedenost</p>
      </div>

      {/* Izbira parametra */}
      <div className="flex items-center gap-4">
        <div>
          <label className="text-sm font-medium">Stevilo oseb</label>
          <Select value={partySize} onValueChange={handlePartySizeChange}>
            <SelectTrigger className="w-28 mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[1, 2, 3, 4, 5, 6, 7, 8, 10, 12, 15, 20].map(n => (
                <SelectItem key={n} value={String(n)}>{n} {n === 1 ? 'oseba' : n < 5 ? 'osebe' : 'oseb'}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-sm font-medium">Vrsta</label>
          <Select value={diningType} onValueChange={handleDiningTypeChange}>
            <SelectTrigger className="w-40 mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="dine-in">Na mestu</SelectItem>
              <SelectItem value="takeout">Za s seboj</SelectItem>
              <SelectItem value="delivery">Dostava</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Ocena čakanja */}
      <WaitEstimateCard estimation={estimation} partySize={partySize} diningType={diningType} />

      {/* Statistika */}
      <StatsGrid estimation={estimation} />

      {/* Zasedenost po območjih */}
      <AreaOccupancyChart areaOccupancy={areaOccupancy} />

      {/* Dejavniki */}
      <EstimationFactors estimation={estimation} partySize={partySize} />

      {/* Čakalna vrsta */}
      <WaitlistQueue waitlist={waitlist as WaitlistData[] | undefined} waitlistCount={estimation.waitlistCount} />
    </div>
  )
})
