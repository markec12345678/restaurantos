'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  ChefHat,
  Flame,
  Clock,
  Package,
  AlertTriangle,
  CheckCircle,
  Settings,
  Plus,
  Minus,
  RefreshCw,
  Zap,
  Timer,
  Users,
  UtensilsCrossed,
  Coffee,
  Pizza,
  Fish,
  Salad,
  IceCreamCone,
  Soup,
} from 'lucide-react'

interface Station {
  id: string
  name: string
  type: 'grill' | 'fry' | 'salad' | 'dessert' | 'pizza' | 'sushi' | 'bar' | 'prep' | 'saute' | 'general'
  icon: string
  status: 'active' | 'paused' | 'closed'
  capacity: number
  currentLoad: number
  queue: StationOrder[]
  avgPrepTime: number
  assignedCooks: string[]
  temperature: number | null
  lastOrderAt: string | null
}

interface StationOrder {
  id: string
  orderId: string
  itemName: string
  quantity: number
  priority: 'normal' | 'high' | 'rush'
  startedAt: string | null
  estimatedMinutes: number
  elapsedMinutes: number
  notes: string | null
}

const stationDefaults: Omit<Station, 'queue' | 'currentLoad' | 'lastOrderAt'>[] = [
  { id: 'grill', name: 'Žar', type: 'grill', icon: '🥩', status: 'active', capacity: 8, avgPrepTime: 12, assignedCooks: [], temperature: null },
  { id: 'fry', name: 'Friteza', type: 'fry', icon: '🍟', status: 'active', capacity: 10, avgPrepTime: 6, assignedCooks: [], temperature: null },
  { id: 'saute', name: 'Kuhalna plošča', type: 'saute', icon: '🍳', status: 'active', capacity: 6, avgPrepTime: 15, assignedCooks: [], temperature: null },
  { id: 'salad', name: 'Hladna kuhinja', type: 'salad', icon: '🥗', status: 'active', capacity: 12, avgPrepTime: 5, assignedCooks: [], temperature: null },
  { id: 'pizza', name: 'Peč za pice', type: 'pizza', icon: '🍕', status: 'active', capacity: 4, avgPrepTime: 12, assignedCooks: [], temperature: null },
  { id: 'dessert', name: 'Sladice', type: 'dessert', icon: '🍰', status: 'active', capacity: 8, avgPrepTime: 8, assignedCooks: [], temperature: null },
  { id: 'bar', name: 'Bar', type: 'bar', icon: '🍸', status: 'active', capacity: 15, avgPrepTime: 3, assignedCooks: [], temperature: null },
  { id: 'prep', name: 'Priprava', type: 'prep', icon: '🔪', status: 'active', capacity: 10, avgPrepTime: 10, assignedCooks: [], temperature: null },
]

export function KitchenStationManager() {
  const [stations, setStations] = useState<Station[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadStations()
    const interval = setInterval(loadStations, 10000) // Osveži vsakih 10s
    return () => clearInterval(interval)
  }, [])

  const loadStations = async () => {
    try {
      // Naloži aktivna naročila
      const ordersRes = await fetch('/api/orders?status=in_kitchen')
      const ordersData = await ordersRes.json()

      // Naloži zaposlene
      const empRes = await fetch('/api/employees')
      const empData = await empRes.json()

      // Razporedi naročila po postajah
      const stationMap: Record<string, StationOrder[]> = {}
      stationDefaults.forEach(s => { stationMap[s.id] = [] })

      const typeMapping: Record<string, string> = {
        'grill': 'grill', 'steak': 'grill', 'meso': 'grill', 'burger': 'grill',
        'fry': 'fry', 'friteza': 'fry', 'pomfrit': 'fry', 'krompirček': 'fry',
        'salad': 'salad', 'solate': 'salad', 'hladno': 'salad',
        'pizza': 'pizza', 'pice': 'pizza',
        'dessert': 'dessert', 'sladice': 'dessert', 'sladko': 'dessert', 'torta': 'dessert',
        'bar': 'bar', 'pijača': 'bar', 'koktajl': 'bar', 'vino': 'bar', 'kava': 'bar', 'coffee': 'bar',
        'saute': 'saute', 'testenine': 'saute', 'rižote': 'saute', 'rižota': 'saute', 'juhe': 'saute', 'soup': 'saute',
        'prep': 'prep', 'predjedi': 'prep', 'prigrizki': 'prep',
      }

      ;(ordersData || []).forEach((order: any) => {
        const items = order.items || order.orderItems || []
        items.forEach((item: any) => {
          const cat = (item.category || item.itemName || '').toLowerCase()
          let stationId = 'general'

          for (const [keyword, sId] of Object.entries(typeMapping)) {
            if (cat.includes(keyword)) {
              stationId = sId
              break
            }
          }

          if (!stationMap[stationId]) stationId = 'prep'
          if (!stationMap[stationId]) stationId = 'grill'

          const startedAt = item.startedAt || order.createdAt
          const elapsed = startedAt
            ? Math.floor((Date.now() - new Date(startedAt).getTime()) / 60000)
            : 0

          stationMap[stationId]?.push({
            id: item.id || `${order.id}-${item.menuItemId}`,
            orderId: order.id,
            itemName: item.itemName || item.name || 'Artikel',
            quantity: item.quantity || 1,
            priority: (item.priority || order.priority) === 'rush' ? 'rush' : (item.priority || order.priority) === 'high' ? 'high' : 'normal',
            startedAt,
            estimatedMinutes: item.prepTime || 10,
            elapsedMinutes: elapsed,
            notes: item.notes || item.specialInstructions || null,
          })
        })
      })

      // Zgradi postaje
      const activeStations: Station[] = stationDefaults.map(defaultStation => {
        const queue = stationMap[defaultStation.id] || []
        // Sortiraj po prioriteti
        queue.sort((a, b) => {
          const prio = { rush: 0, high: 1, normal: 2 }
          return prio[a.priority] - prio[b.priority]
        })

        return {
          ...defaultStation,
          queue,
          currentLoad: queue.length,
          lastOrderAt: queue.length > 0 ? queue[0].startedAt : null,
        }
      })

      setStations(activeStations)
    } catch (err) {
      console.error('Error loading kitchen stations:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleToggleStation = (stationId: string) => {
    setStations(prev => prev.map(s =>
      s.id === stationId
        ? { ...s, status: s.status === 'active' ? 'paused' : 'active' }
        : s
    ))
  }

  const handleCompleteItem = async (orderId: string, itemId: string) => {
    try {
      await fetch(`/api/order-items/${itemId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'ready' }),
      })
      await loadStations()
    } catch (err) {
      console.error('Error completing item:', err)
    }
  }

  const totalOrders = stations.reduce((s, st) => s + st.currentLoad, 0)
  const activeStations = stations.filter(s => s.status === 'active').length
  const overloadedStations = stations.filter(s => s.currentLoad >= s.capacity).length
  const avgLoad = stations.length > 0 ? stations.reduce((s, st) => s + (st.currentLoad / st.capacity) * 100, 0) / stations.length : 0

  const priorityConfig = {
    normal: { label: 'Normalno', color: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300' },
    high: { label: 'Prioritetno', color: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400' },
    rush: { label: 'NUJNO', color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' },
  }

  return (
    <div className="p-4 space-y-4 h-full overflow-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-rose-100 dark:bg-rose-900/30">
            <ChefHat className="h-5 w-5 text-rose-600 dark:text-rose-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Kuhinjske postaje</h2>
            <p className="text-sm text-muted-foreground">Upravljanje kuhinjskih postaj in obremenitve</p>
          </div>
        </div>
        <Button size="sm" variant="outline" onClick={loadStations}>
          <RefreshCw className="h-3 w-3 mr-1" /> Osveži
        </Button>
      </div>

      {/* Povzetek */}
      <div className="grid grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-3 text-center">
            <Flame className="h-5 w-5 text-orange-500 mx-auto mb-1" />
            <p className="text-xl font-bold">{activeStations}</p>
            <p className="text-xs text-muted-foreground">Aktivne postaje</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <Package className="h-5 w-5 text-blue-500 mx-auto mb-1" />
            <p className="text-xl font-bold">{totalOrders}</p>
            <p className="text-xs text-muted-foreground">Artikli v pripravi</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <AlertTriangle className="h-5 w-5 text-amber-500 mx-auto mb-1" />
            <p className="text-xl font-bold">{overloadedStations}</p>
            <p className="text-xs text-muted-foreground">Preobremenjene</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <Zap className="h-5 w-5 text-purple-500 mx-auto mb-1" />
            <p className="text-xl font-bold">{Math.round(avgLoad)}%</p>
            <p className="text-xs text-muted-foreground">Povprečna obremenitev</p>
          </CardContent>
        </Card>
      </div>

      {/* Postaje */}
      <div className="grid grid-cols-2 gap-3">
        {stations.map(station => {
          const loadPercent = station.capacity > 0 ? Math.round((station.currentLoad / station.capacity) * 100) : 0
          const isOverloaded = loadPercent >= 100
          const isHighLoad = loadPercent >= 75

          return (
            <Card key={station.id} className={`transition-all ${isOverloaded ? 'border-red-300 dark:border-red-800' : isHighLoad ? 'border-amber-300 dark:border-amber-800' : ''}`}>
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
                  <Button size="sm" variant="ghost" onClick={() => handleToggleStation(station.id)}>
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
                            <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => handleCompleteItem(item.orderId, item.id)}>
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
        })}
      </div>
    </div>
  )
}

function Pause({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" />
    </svg>
  )
}

function Play({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <polygon points="6 3 20 12 6 21 6 3" />
    </svg>
  )
}
