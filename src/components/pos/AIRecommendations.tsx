'use client'

import { useQuery } from '@tanstack/react-query'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import { authFetch } from '@/components/pos/PinLogin'
import { queryKeys } from '@/lib/query-keys'
import { Brain } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { useState, memo } from 'react'
import type { MenuItemData } from './ai-recommendations/constants'
import { CATEGORY_CONFIG } from './ai-recommendations/constants'
import { RecommendationCard } from './ai-recommendations/RecommendationCard'
import { CategoryFilterCards } from './ai-recommendations/CategoryFilterCards'
import { useRecommendationEngine } from './useRecommendationEngine'

export const AIRecommendations = memo(function AIRecommendations() {
  const [activeTab, setActiveTab] = useState('all')

  const { data: menuItems, isLoading } = useQuery({
    queryKey: queryKeys.menuItems.all,
    queryFn: async () => {
      const res = await authFetch('/api/menu-items?limit=500')
      if (!res.ok) throw new Error('Napaka pri nalaganju')
      return res.json()
    },
  })

  useQuery({
    queryKey: queryKeys.recentOrders7d.all,
    queryFn: async () => {
      const res = await authFetch('/api/orders?limit=200')
      if (!res.ok) throw new Error('Napaka pri nalaganju')
      return res.json()
    },
  })

  const recommendations = useRecommendationEngine(menuItems as MenuItemData[] | undefined)

  const filtered = activeTab === 'all'
    ? recommendations
    : recommendations.filter(r => r.category === activeTab)

  if (isLoading) {
    return (
      <div className="space-y-4 p-4">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-3 gap-4">{[...Array(6)].map((_, i) => <Skeleton key={i} className="h-132" />)}</div>
      </div>
    )
  }

  return (
    <div className="space-y-4 p-2 overflow-y-auto h-full custom-scrollbar">
      <div>
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Brain className="h-6 w-6 text-purple-500" />
          AI Priporočila
        </h2>
        <p className="text-muted-foreground">Pametna priporočila jedi glede na uro, sezono, popularnost in profitabilnost</p>
      </div>

      <CategoryFilterCards activeTab={activeTab} onTabChange={setActiveTab} recommendations={recommendations} />

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="all">Vse ({recommendations.length})</TabsTrigger>
          {Object.entries(CATEGORY_CONFIG).map(([key, cfg]) => (
            <TabsTrigger key={key} value={key}>{cfg.label}</TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value={activeTab} className="mt-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((rec, idx) => (
              <RecommendationCard key={rec.item.id} rec={rec} index={idx} />
            ))}
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
})
