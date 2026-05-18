'use client'

// ═══════════════════════════════════════════════════════════════
// RestaurantOS — Menu Engineering Matrix
// Profitability (gross profit %) vs Popularity (prodaja količina)
// 4 kvadranti: Star, Puzzle, Plowhorse, Dog
// Toast POS + Lightspeed standard za optimizacijo menija
// ═══════════════════════════════════════════════════════════════

import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { authFetch } from '@/components/pos/PinLogin'
import {
  Star, Puzzle, Dog, TrendingUp, TrendingDown,
  BarChart3, Target, AlertTriangle, ArrowUpRight, ArrowDownRight,
  Info, Truck,
} from 'lucide-react'
import { useState, useMemo } from 'react'
import {
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, ZAxis, Legend, ReferenceLine,
} from 'recharts'

// ─── Tipi ──────────────────────────────────────────────────────
interface MenuItemAnalysis {
  id: string
  name: string
  category: string
  price: number
  foodCost: number
  grossProfit: number
  grossProfitPercent: number
  quantitySold: number
  revenue: number
  popularityRank: number
  profitabilityRank: number
  quadrant: 'star' | 'puzzle' | 'plowhorse' | 'dog'
}

interface MenuEngineeringData {
  items: MenuItemAnalysis[]
  medianPopularity: number
  medianProfitability: number
  totalItems: number
  stars: number
  puzzles: number
  plowhorses: number
  dogs: number
}

// ─── Kvadrant barve ──────────────────────────────────────────────
const QUADRANT_COLORS = {
  star: '#10b981',      // Emerald - visoka profitabilnost, visoka priljubljenost
  puzzle: '#3b82f6',    // Blue - visoka profitabilnost, nizka priljubljenost
  plowhorse: '#f59e0b', // Amber - nizka profitabilnost, visoka priljubljenost
  dog: '#ef4444',       // Red - nizka profitabilnost, nizka priljubljenost
}

const QUADRANT_LABELS: Record<string, string> = {
  star: 'Zvezda',
  puzzle: 'Uganka',
  plowhorse: 'Delavski konj',
  dog: 'Pes',
}

const QUADRANT_DESCRIPTIONS: Record<string, string> = {
  star: 'Visoka profitabilnost in priljubljenost. Ohrani in promoviraj!',
  puzzle: 'Visoka profitabilnost, nizka priljubljenost. Promoviraj in vizualno izpostavi!',
  plowhorse: 'Nizka profitabilnost, visoka priljubljenost. Povišaj ceno ali zmanjšaj porcijo!',
  dog: 'Nizka profitabilnost in priljubljenost. Premisli o odstranitvi ali redesignu!',
}

// ─── Custom Tooltip ──────────────────────────────────────────────
function MatrixTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null
  const item: MenuItemAnalysis = payload[0].payload
  return (
    <div className="bg-card border rounded-lg shadow-lg p-3 max-w-xs">
      <div className="flex items-center gap-2 mb-2">
        <div className="h-3 w-3 rounded-full" style={{ backgroundColor: QUADRANT_COLORS[item.quadrant] }} />
        <span className="font-semibold text-sm">{item.name}</span>
      </div>
      <div className="space-y-1 text-xs">
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">Kategorija:</span>
          <span>{item.category}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">Cena:</span>
          <span>€{item.price.toFixed(2)}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">Strošek hrane:</span>
          <span>€{item.foodCost.toFixed(2)}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">Bruto dobček:</span>
          <span className={item.grossProfitPercent >= 70 ? 'text-emerald-600' : item.grossProfitPercent >= 50 ? 'text-amber-600' : 'text-red-600'}>
            {item.grossProfitPercent.toFixed(1)}%
          </span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">Prodano:</span>
          <span>{item.quantitySold}x</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">Prihodek:</span>
          <span>€{item.revenue.toFixed(2)}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">Kvadrant:</span>
          <Badge style={{ backgroundColor: QUADRANT_COLORS[item.quadrant] + '20', color: QUADRANT_COLORS[item.quadrant] }} className="text-[10px] h-5">
            {QUADRANT_LABELS[item.quadrant]}
          </Badge>
        </div>
      </div>
    </div>
  )
}

// ─── Glavna komponenta ──────────────────────────────────────────
export function MenuEngineeringMatrix() {
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [viewMode, setViewMode] = useState<'matrix' | 'table'>('matrix')

  const { data, isLoading } = useQuery({
    queryKey: ['menu-engineering'],
    queryFn: async () => {
      const res = await authFetch('/api/reports/popular')
      if (!res.ok) throw new Error('Failed to fetch')
      const popular = await res.json()

      // Pridobi tudi food-cost podatke
      let foodCostMap: Record<string, number> = {}
      try {
        const fcRes = await authFetch('/api/food-cost')
        if (fcRes.ok) {
          const fcData = await fcRes.json()
          if (Array.isArray(fcData)) {
            fcData.forEach((item: any) => {
              foodCostMap[item.menuItemId || item.id] = item.foodCost || item.costPerServing || 0
            })
          }
        }
      } catch {}

      // Analiziraj artikle
      const items: MenuItemAnalysis[] = popular.popularItems.map((item: any, idx: number) => {
        const price = item.revenue / item.quantity
        const foodCost = foodCostMap[item.id] || price * 0.3 // Fallback 30%
        const grossProfit = price - foodCost
        const grossProfitPercent = price > 0 ? (grossProfit / price) * 100 : 0

        return {
          id: item.id || String(idx),
          name: item.name,
          category: item.category,
          price,
          foodCost,
          grossProfit,
          grossProfitPercent,
          quantitySold: item.quantity,
          revenue: item.revenue,
          popularityRank: 0,
          profitabilityRank: 0,
          quadrant: 'dog' as const,
        }
      })

      // Izračunaj mediane
      const sortedByPopularity = [...items].sort((a, b) => b.quantitySold - a.quantitySold)
      const sortedByProfit = [...items].sort((a, b) => b.grossProfitPercent - a.grossProfitPercent)

      const medianPopularity = sortedByPopularity.length > 0
        ? sortedByPopularity[Math.floor(sortedByPopularity.length / 2)].quantitySold
        : 0
      const medianProfitability = sortedByProfit.length > 0
        ? sortedByProfit[Math.floor(sortedByProfit.length / 2)].grossProfitPercent
        : 50

      // Dodeli kvadrante in range
      items.forEach((item, idx) => {
        item.popularityRank = sortedByPopularity.findIndex(i => i.id === item.id) + 1
        item.profitabilityRank = sortedByProfit.findIndex(i => i.id === item.id) + 1

        const isHighPopularity = item.quantitySold >= medianPopularity
        const isHighProfitability = item.grossProfitPercent >= medianProfitability

        if (isHighPopularity && isHighProfitability) item.quadrant = 'star'
        else if (!isHighPopularity && isHighProfitability) item.quadrant = 'puzzle'
        else if (isHighPopularity && !isHighProfitability) item.quadrant = 'plowhorse'
        else item.quadrant = 'dog'
      })

      return {
        items,
        medianPopularity,
        medianProfitability,
        totalItems: items.length,
        stars: items.filter(i => i.quadrant === 'star').length,
        puzzles: items.filter(i => i.quadrant === 'puzzle').length,
        plowhorses: items.filter(i => i.quadrant === 'plowhorse').length,
        dogs: items.filter(i => i.quadrant === 'dog').length,
      } as MenuEngineeringData
    },
  })

  // Kategorije za filter
  const categories = useMemo(() => {
    if (!data) return []
    const cats = new Set(data.items.map(i => i.category))
    return Array.from(cats).sort()
  }, [data])

  // Filtrirani artikli
  const filteredItems = useMemo(() => {
    if (!data) return []
    if (categoryFilter === 'all') return data.items
    return data.items.filter(i => i.category === categoryFilter)
  }, [data, categoryFilter])

  // Chart podatki
  const chartData = filteredItems.map(item => ({
    x: item.quantitySold,
    y: item.grossProfitPercent,
    z: item.revenue,
    ...item,
  }))

  if (isLoading) {
    return (
      <div className="h-full p-4 space-y-4">
        <div className="grid grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-96" />
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-card flex-shrink-0">
        <div className="flex items-center gap-3">
          <BarChart3 className="h-5 w-5 text-primary" />
          <h1 className="text-lg font-bold">Menu Engineering</h1>
          <Badge variant="outline" className="text-xs">{data?.totalItems || 0} artiklov</Badge>
        </div>
        <div className="flex items-center gap-2">
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-40 h-8 text-xs">
              <SelectValue placeholder="Kategorija" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Vse kategorije</SelectItem>
              {categories.map(cat => (
                <SelectItem key={cat} value={cat}>{cat}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex border rounded-md">
            <Button
              variant={viewMode === 'matrix' ? 'default' : 'ghost'}
              size="sm"
              className="h-8 text-xs rounded-r-none"
              onClick={() => setViewMode('matrix')}
            >
              Graf
            </Button>
            <Button
              variant={viewMode === 'table' ? 'default' : 'ghost'}
              size="sm"
              className="h-8 text-xs rounded-l-none"
              onClick={() => setViewMode('table')}
            >
              Tabela
            </Button>
          </div>
        </div>
      </div>

      {/* Quadrant Summary Cards */}
      <div className="grid grid-cols-4 gap-3 p-4 flex-shrink-0">
        {[
          { key: 'star' as const, icon: <Star className="h-4 w-4" />, count: data?.stars || 0, color: QUADRANT_COLORS.star },
          { key: 'puzzle' as const, icon: <Puzzle className="h-4 w-4" />, count: data?.puzzles || 0, color: QUADRANT_COLORS.puzzle },
          { key: 'plowhorse' as const, icon: <Truck className="h-4 w-4" />, count: data?.plowhorses || 0, color: QUADRANT_COLORS.plowhorse },
          { key: 'dog' as const, icon: <Dog className="h-4 w-4" />, count: data?.dogs || 0, color: QUADRANT_COLORS.dog },
        ].map(q => (
          <Card key={q.key} className="overflow-hidden">
            <div className="h-1" style={{ backgroundColor: q.color }} />
            <CardContent className="p-3">
              <div className="flex items-center gap-2 mb-1">
                <span style={{ color: q.color }}>{q.icon}</span>
                <span className="text-xs font-semibold" style={{ color: q.color }}>{QUADRANT_LABELS[q.key]}</span>
              </div>
              <p className="text-2xl font-bold">{q.count}</p>
              <p className="text-[10px] text-muted-foreground leading-tight mt-1">{QUADRANT_DESCRIPTIONS[q.key]}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 pb-4">
        {viewMode === 'matrix' ? (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Target className="h-4 w-4" />
                Profitabilnost vs Priljubljenost
                <Info className="h-3 w-3 text-muted-foreground" />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[400px]">
                <ResponsiveContainer width="100%" height="100%">
                  <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis
                      type="number"
                      dataKey="x"
                      name="Prodano"
                      label={{ value: 'Priljubljenost (količina)', position: 'insideBottom', offset: -10, style: { fontSize: 11 } }}
                      tick={{ fontSize: 10 }}
                    />
                    <YAxis
                      type="number"
                      dataKey="y"
                      name="Bruto dobček %"
                      domain={[0, 100]}
                      label={{ value: 'Profitabilnost (%)', angle: -90, position: 'insideLeft', offset: 10, style: { fontSize: 11 } }}
                      tick={{ fontSize: 10 }}
                    />
                    <ZAxis type="number" dataKey="z" range={[80, 400]} name="Prihodek" />
                    <Tooltip content={<MatrixTooltip />} />
                    <ReferenceLine
                      y={data?.medianProfitability || 50}
                      stroke="#94a3b8"
                      strokeDasharray="5 5"
                      label={{ value: 'Mediana profit.', position: 'insideTopRight', style: { fontSize: 9, fill: '#94a3b8' } }}
                    />
                    <ReferenceLine
                      x={data?.medianPopularity || 5}
                      stroke="#94a3b8"
                      strokeDasharray="5 5"
                      label={{ value: 'Mediana priljub.', position: 'insideTopRight', style: { fontSize: 9, fill: '#94a3b8' } }}
                    />
                    <Scatter data={chartData} fill="#8884d8">
                      {chartData.map((entry, index) => (
                        <Cell key={index} fill={QUADRANT_COLORS[entry.quadrant as keyof typeof QUADRANT_COLORS]} fillOpacity={0.8} />
                      ))}
                    </Scatter>
                    <Legend
                      content={() => (
                        <div className="flex justify-center gap-4 mt-2">
                          {Object.entries(QUADRANT_LABELS).map(([key, label]) => (
                            <div key={key} className="flex items-center gap-1.5 text-xs">
                              <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: QUADRANT_COLORS[key as keyof typeof QUADRANT_COLORS] }} />
                              <span>{label}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    />
                  </ScatterChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        ) : (
          /* Tabela */
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="text-left p-3 font-semibold">Artikel</th>
                      <th className="text-left p-3 font-semibold">Kategorija</th>
                      <th className="text-right p-3 font-semibold">Cena</th>
                      <th className="text-right p-3 font-semibold">Strošek</th>
                      <th className="text-right p-3 font-semibold">Bruto %</th>
                      <th className="text-right p-3 font-semibold">Prodano</th>
                      <th className="text-right p-3 font-semibold">Prihodek</th>
                      <th className="text-center p-3 font-semibold">Kvadrant</th>
                      <th className="text-left p-3 font-semibold">Priporočilo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredItems
                      .sort((a, b) => {
                        const order = { star: 0, puzzle: 1, plowhorse: 2, dog: 3 }
                        return order[a.quadrant] - order[b.quadrant]
                      })
                      .map(item => (
                        <tr key={item.id} className="border-b hover:bg-muted/30 transition-colors">
                          <td className="p-3 font-medium">{item.name}</td>
                          <td className="p-3 text-muted-foreground">{item.category}</td>
                          <td className="p-3 text-right">€{item.price.toFixed(2)}</td>
                          <td className="p-3 text-right">€{item.foodCost.toFixed(2)}</td>
                          <td className="p-3 text-right">
                            <span className={item.grossProfitPercent >= 70 ? 'text-emerald-600 font-semibold' : item.grossProfitPercent >= 50 ? 'text-amber-600' : 'text-red-600 font-semibold'}>
                              {item.grossProfitPercent.toFixed(1)}%
                            </span>
                          </td>
                          <td className="p-3 text-right">{item.quantitySold}x</td>
                          <td className="p-3 text-right font-medium">€{item.revenue.toFixed(2)}</td>
                          <td className="p-3 text-center">
                            <Badge style={{ backgroundColor: QUADRANT_COLORS[item.quadrant] + '20', color: QUADRANT_COLORS[item.quadrant] }} className="text-[10px]">
                              {QUADRANT_LABELS[item.quadrant]}
                            </Badge>
                          </td>
                          <td className="p-3 text-xs text-muted-foreground max-w-[200px]">
                            {item.quadrant === 'star' && 'Ohrani kakovost, promoviraj'}
                            {item.quadrant === 'puzzle' && 'Izpostavi na meniju, znižaj ceno'}
                            {item.quadrant === 'plowhorse' && 'Povišaj ceno ali zmanjšaj porcijo'}
                            {item.quadrant === 'dog' && 'Premisli o odstranitvi'}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
