'use client'

// ═══════════════════════════════════════════════════════════════
// RestaurantOS — AI Menu Recommendations
// Pametno priporočanje jedi glede na: uro, dan, sezono, 
// zgodovino naročil, popularnost, food cost, maržo
// ═══════════════════════════════════════════════════════════════

import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import { authFetch } from '@/components/pos/PinLogin'
import {
  Brain, Sparkles, TrendingUp, Clock, Flame, DollarSign,
  Star, ArrowUpRight, Target, BarChart3, CalendarDays,
  UtensilsCrossed, Zap, Crown, ThumbsUp, Eye,
} from 'lucide-react'
import { useState, useMemo } from 'react'
import { format } from 'date-fns'

interface MenuItemData {
  id: string
  name: string
  price: number
  image: string
  vatRate: number
  allergens: string
  category: { name: string; menu: { name: string } }
  salesCategory?: { name: string }
  orderItems: { id: string; quantity: number; createdAt: string }[]
}

interface Recommendation {
  item: MenuItemData
  score: number
  reasons: string[]
  category: 'popular' | 'profitable' | 'seasonal' | 'upsell' | 'trending'
}

const CATEGORY_CONFIG: Record<string, { label: string; icon: any; color: string; desc: string }> = {
  popular: { label: 'Popularne', icon: ThumbsUp, color: 'text-green-600 bg-green-100 dark:bg-green-900/30', desc: 'Najbolj prodajane jedi' },
  profitable: { label: 'Profitabilne', icon: DollarSign, color: 'text-amber-600 bg-amber-100 dark:bg-amber-900/30', desc: 'Najvišja marža' },
  seasonal: { label: 'Sezonske', icon: CalendarDays, color: 'text-blue-600 bg-blue-100 dark:bg-blue-900/30', desc: 'Glede na sezono/uro' },
  upsell: { label: 'Upsell', icon: ArrowUpRight, color: 'text-purple-600 bg-purple-100 dark:bg-purple-900/30', desc: 'Priložnost za večjo prodajo' },
  trending: { label: 'Trendi', icon: TrendingUp, color: 'text-red-600 bg-red-100 dark:bg-red-900/30', desc: 'Rastoča prodaja' },
}

export function AIRecommendations() {
  const [activeTab, setActiveTab] = useState('all')

  const { data: menuItems, isLoading } = useQuery({
    queryKey: ['menu-items-all'],
    queryFn: async () => {
      const res = await authFetch('/api/menu-items?limit=500')
      return res.json()
    },
  })

  const { data: orders } = useQuery({
    queryKey: ['recent-orders-7d'],
    queryFn: async () => {
      const res = await authFetch('/api/orders?limit=200')
      return res.json()
    },
  })

  // AI priporočila
  const recommendations = useMemo(() => {
    const items = (menuItems || []) as MenuItemData[]
    if (!items.length) return []

    const now = new Date()
    const hour = now.getHours()
    const month = now.getMonth()
    const dayOfWeek = now.getDay()

    const recs: Recommendation[] = []

    for (const item of items) {
      let score = 0
      const reasons: string[] = []
      let category: Recommendation['category'] = 'popular'

      // 1. Popularnost (skupno naročil)
      const totalOrders = item.orderItems?.length || 0
      const popularityScore = Math.min(totalOrders / 50, 1) * 30
      score += popularityScore
      if (totalOrders > 20) reasons.push(`Popularno (${totalOrders}x naročeno)`)
      if (totalOrders > 50) reasons.push('Top prodajalec')

      // 2. Profitabilnost (višja cena = višja marža, običajno)
      const profitScore = Math.min(item.price / 20, 1) * 25
      score += profitScore
      if (item.price >= 15) {
        reasons.push(`Visoka marža (€${item.price.toFixed(2)})`)
        if (category === 'popular') category = 'profitable'
      }

      // 3. Čas dneva
      const categoryName = item.category?.name?.toLowerCase() || ''
      const menuName = item.category?.menu?.name?.toLowerCase() || ''

      if (hour >= 6 && hour <= 10) {
        if (categoryName.includes('zajtrk') || categoryName.includes('kava') || menuName.includes('zajtrk')) {
          score += 20
          reasons.push('Ustrezno za jutranji meni')
          if (category === 'popular') category = 'seasonal'
        }
      }
      if (hour >= 11 && hour <= 14) {
        if (categoryName.includes('kosilo') || categoryName.includes('dnevna') || categoryName.includes('business')) {
          score += 20
          reasons.push('Priljubljeno ob kosilu')
          if (category === 'popular') category = 'seasonal'
        }
      }
      if (hour >= 18 && hour <= 22) {
        if (categoryName.includes('večer') || categoryName.includes('glavne') || categoryName.includes('steak')) {
          score += 15
          reasons.push('Priljubljeno za večerjo')
          if (category === 'popular') category = 'seasonal'
        }
      }

      // 4. Sezona
      if (month >= 5 && month <= 8) { // Jun-Sep = poletje
        if (categoryName.includes('solat') || categoryName.includes('hladn') || categoryName.includes('sladice')) {
          score += 15
          reasons.push('Poletni hit')
          if (category === 'popular') category = 'seasonal'
        }
      }
      if (month >= 11 || month <= 1) { // Dec-Jan = zima
        if (categoryName.includes('juh') || categoryName.includes('tople') || categoryName.includes('vroč')) {
          score += 15
          reasons.push('Zimski hit')
          if (category === 'popular') category = 'seasonal'
        }
      }

      // 5. Trending (nedavna rast)
      const recentOrders = (item.orderItems || []).filter(oi => {
        const d = new Date(oi.createdAt)
        return now.getTime() - d.getTime() < 7 * 86400000
      })
      const olderOrders = (item.orderItems || []).filter(oi => {
        const d = new Date(oi.createdAt)
        const diff = now.getTime() - d.getTime()
        return diff >= 7 * 86400000 && diff < 14 * 86400000
      })
      if (recentOrders.length > olderOrders.length * 1.3 && recentOrders.length >= 3) {
        score += 20
        reasons.push(`Rastoča prodaja (+${Math.round(((recentOrders.length / Math.max(olderOrders.length, 1)) - 1) * 100)}%)`)
        if (category === 'popular') category = 'trending'
      }

      // 6. Upsell priložnosti
      if (item.price >= 8 && item.price <= 15 && totalOrders > 10) {
        score += 10
        reasons.push('Odlična upsell priložnost')
        if (category === 'popular') category = 'upsell'
      }

      // Vikend bonus
      if (dayOfWeek === 0 || dayOfWeek === 5 || dayOfWeek === 6) {
        if (categoryName.includes('sladice') || categoryName.includes('palačinke') || categoryName.includes('desert')) {
          score += 10
          reasons.push('Vikendski priljubljenec')
        }
      }

      if (reasons.length > 0 && score > 15) {
        recs.push({ item, score: Math.round(score), reasons, category })
      }
    }

    return recs.sort((a, b) => b.score - a.score).slice(0, 30)
  }, [menuItems, orders])

  const filtered = activeTab === 'all'
    ? recommendations
    : recommendations.filter(r => r.category === activeTab)

  if (isLoading) {
    return (
      <div className="space-y-4 p-4">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-3 gap-4">{[...Array(6)].map((_, i) => <Skeleton key={i} className="h-32" />)}</div>
      </div>
    )
  }

  return (
    <div className="space-y-4 p-2 overflow-y-auto h-full custom-scrollbar">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Brain className="h-6 w-6 text-purple-500" />
          AI Priporočila
        </h2>
        <p className="text-muted-foreground">Pametna priporočila jedi glede na uro, sezono, popularnost in profitabilnost</p>
      </div>

      {/* Povzetek */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {Object.entries(CATEGORY_CONFIG).map(([key, cfg]) => {
          const Icon = cfg.icon
          const count = recommendations.filter(r => r.category === key).length
          return (
            <Card key={key} className={`cursor-pointer transition-all ${activeTab === key ? 'ring-2 ring-purple-400' : ''}`}
              onClick={() => setActiveTab(activeTab === key ? 'all' : key)}>
              <CardContent className="p-3 text-center">
                <Icon className={`h-5 w-5 mx-auto mb-1 ${cfg.color.split(' ')[0]}`} />
                <div className="text-lg font-bold">{count}</div>
                <div className="text-xs text-muted-foreground">{cfg.label}</div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="all">Vse ({recommendations.length})</TabsTrigger>
          {Object.entries(CATEGORY_CONFIG).map(([key, cfg]) => (
            <TabsTrigger key={key} value={key}>{cfg.label}</TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value={activeTab} className="mt-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((rec, idx) => {
              const cfg = CATEGORY_CONFIG[rec.category] || CATEGORY_CONFIG.popular
              const Icon = cfg.icon
              return (
                <Card key={rec.item.id} className="overflow-hidden">
                  <div className={`h-1 ${cfg.color.split(' ')[1] || 'bg-gray-200'}`} />
                  <CardContent className="p-4 space-y-3">
                    {/* Header */}
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-lg font-bold text-muted-foreground">#{idx + 1}</span>
                        <div>
                          <div className="font-semibold text-sm">{rec.item.name}</div>
                          <div className="text-xs text-muted-foreground">{rec.item.category?.name}</div>
                        </div>
                      </div>
                      <Badge className={cfg.color}>
                        <Icon className="h-3 w-3 mr-1" />
                        {cfg.label}
                      </Badge>
                    </div>

                    {/* Cena + Score */}
                    <div className="flex items-center justify-between">
                      <span className="text-lg font-bold text-green-600">€{rec.item.price.toFixed(2)}</span>
                      <div className="flex items-center gap-1">
                        <Sparkles className="h-4 w-4 text-amber-500" />
                        <span className="text-sm font-semibold">{rec.score}</span>
                        <span className="text-xs text-muted-foreground">točk</span>
                      </div>
                    </div>

                    {/* Razlogi */}
                    <div className="space-y-1">
                      {rec.reasons.map((reason, i) => (
                        <div key={i} className="flex items-center gap-2 text-xs">
                          <Zap className="h-3 w-3 text-amber-500 shrink-0" />
                          <span className="text-muted-foreground">{reason}</span>
                        </div>
                      ))}
                    </div>

                    {/* Score bar */}
                    <div className="w-full bg-gray-100 dark:bg-gray-800 rounded-full h-1.5">
                      <div className="h-1.5 rounded-full bg-gradient-to-r from-purple-400 to-indigo-600"
                        style={{ width: `${Math.min(rec.score, 100)}%` }} />
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>

          {filtered.length === 0 && (
            <Card className="text-center py-16">
              <CardContent>
                <Brain className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">Ni priporočil za to kategorijo</h3>
                <p className="text-muted-foreground">Poskusite drugo kategorijo ali dodajte več jedi v meni</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
