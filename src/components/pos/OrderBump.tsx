'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Sparkles,
  TrendingUp,
  ArrowUpRight,
  Plus,
  X,
  Star,
  Flame,
  UtensilsCrossed,
  Coffee,
  Percent,
  DollarSign,
  ShoppingCart,
  ChevronRight,
  Zap,
  Target,
} from 'lucide-react'

interface UpsellItem {
  id: string
  name: string
  price: number
  originalPrice?: number
  category: string
  reason: string
  type: 'add-on' | 'upgrade' | 'combo' | 'side'
  popularity: number // 0-100
  margin: number // percent
  imageEmoji: string
}

interface OrderBumpRule {
  id: string
  name: string
  trigger: string
  suggestion: string
  type: 'add-on' | 'upgrade' | 'combo' | 'side'
  discount: number
  enabled: boolean
  conversionRate: number
  totalRevenue: number
}

export function OrderBump() {
  const [suggestions, setSuggestions] = useState<UpsellItem[]>([])
  const [rules, setRules] = useState<OrderBumpRule[]>([])
  const [loading, setLoading] = useState(true)
  const [addedItems, setAddedItems] = useState<Set<string>>(new Set())

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const [menuRes, ordersRes] = await Promise.all([
        fetch('/api/menu-items'),
        fetch('/api/orders?status=completed&limit=50'),
      ])
      const menuData = await menuRes.json()
      const ordersData = await ordersRes.json()

      // Analiziraj pogoste kombinacije
      const pairCounts: Record<string, number> = {}
      ;(ordersData || []).forEach((order: any) => {
        const items = order.items || order.orderItems || []
        const names = items.map((i: any) => i.itemName || i.name || '')
        for (let i = 0; i < names.length; i++) {
          for (let j = i + 1; j < names.length; j++) {
            const key = [names[i], names[j]].sort().join('|||')
            pairCounts[key] = (pairCounts[key] || 0) + 1
          }
        }
      })

      // Generiraj upsell predloge
      const upsellItems: UpsellItem[] = [
        {
          id: 'dessert-upsell',
          name: 'Domaci štrudelj',
          price: 4.90,
          originalPrice: 5.90,
          category: 'Sladice',
          reason: 'Stranke, ki naročijo glavno jed, pogosto dodajo sladico',
          type: 'add-on',
          popularity: 78,
          margin: 72,
          imageEmoji: '🍰',
        },
        {
          id: 'wine-upgrade',
          name: 'Refošk Premium',
          price: 6.50,
          originalPrice: 8.50,
          category: 'Vina',
          reason: 'Nadgradnja na premium vino ob naročilu zrezka',
          type: 'upgrade',
          popularity: 45,
          margin: 80,
          imageEmoji: '🍷',
        },
        {
          id: 'side-combo',
          name: 'Pomfri + Solata',
          price: 3.90,
          category: 'Priloge',
          reason: 'Najbolj priljubljena kombinacija prilog',
          type: 'combo',
          popularity: 82,
          margin: 65,
          imageEmoji: '🍟',
        },
        {
          id: 'coffee-add',
          name: 'Espresso',
          price: 2.20,
          category: 'Kava',
          reason: 'Kava ob sladici poveča zadovoljstvo za 34%',
          type: 'add-on',
          popularity: 91,
          margin: 88,
          imageEmoji: '☕',
        },
        {
          id: 'soup-upgrade',
          name: 'Juha dneva + Predjedi',
          price: 5.90,
          originalPrice: 7.40,
          category: 'Predjedi',
          reason: 'Kombo predjedi poveča povprečni račun za 18%',
          type: 'combo',
          popularity: 56,
          margin: 70,
          imageEmoji: '🍲',
        },
        {
          id: 'kids-drink',
          name: 'Sok za otroke',
          price: 1.90,
          category: 'Otroški meni',
          reason: '75% otroških obrokov vključuje pijačo',
          type: 'side',
          popularity: 75,
          margin: 82,
          imageEmoji: '🧃',
        },
      ]

      setSuggestions(upsellItems)

      // Pravila upsell
      const bumpRules: OrderBumpRule[] = [
        { id: 'r1', name: 'Sladica ob glavni jedi', trigger: 'Glavna jed > 10 EUR', suggestion: 'Dodaj sladico za 17% popust', type: 'add-on', discount: 17, enabled: true, conversionRate: 28, totalRevenue: 2450 },
        { id: 'r2', name: 'Premium vino ob zrezku', trigger: 'Zrezek v naročilu', suggestion: 'Nadgradnja na premium vino', type: 'upgrade', discount: 15, enabled: true, conversionRate: 18, totalRevenue: 1820 },
        { id: 'r3', name: 'Priloga kombo', trigger: 'Brez priloge', suggestion: 'Dodaj pomfri + solato za 3.90 EUR', type: 'combo', discount: 12, enabled: true, conversionRate: 34, totalRevenue: 3100 },
        { id: 'r4', name: 'Kava ob sladici', trigger: 'Sladica v naročilu', suggestion: 'Kava + sladica = popolna kombinacija', type: 'add-on', discount: 10, enabled: true, conversionRate: 42, totalRevenue: 1560 },
        { id: 'r5', name: 'Otroški sok', trigger: 'Otroški meni', suggestion: 'Dodaj sok za 1.90 EUR', type: 'side', discount: 0, enabled: true, conversionRate: 65, totalRevenue: 890 },
        { id: 'r6', name: 'Aperitiv ob čakanju', trigger: 'Čakanje > 15 min', suggestion: 'Aperitiv na popust med čakanjem', type: 'add-on', discount: 20, enabled: false, conversionRate: 22, totalRevenue: 560 },
      ]

      setRules(bumpRules)
    } catch (err) {
      console.error('Error loading order bump data:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleAddSuggestion = (id: string) => {
    setAddedItems(prev => new Set(prev).add(id))
    setTimeout(() => {
      setAddedItems(prev => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
    }, 2000)
  }

  const handleToggleRule = (ruleId: string) => {
    setRules(prev => prev.map(r =>
      r.id === ruleId ? { ...r, enabled: !r.enabled } : r
    ))
  }

  const totalPotentialRevenue = rules.filter(r => r.enabled).reduce((s, r) => s + r.totalRevenue, 0)
  const avgConversion = rules.filter(r => r.enabled).length > 0
    ? Math.round(rules.filter(r => r.enabled).reduce((s, r) => s + r.conversionRate, 0) / rules.filter(r => r.enabled).length)
    : 0
  const activeRules = rules.filter(r => r.enabled).length

  const typeConfig = {
    'add-on': { label: 'Dodatek', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' },
    'upgrade': { label: 'Nadgradnja', color: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400' },
    'combo': { label: 'Kombo', color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' },
    'side': { label: 'Priloga', color: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400' },
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('sl-SI', { style: 'currency', currency: 'EUR' }).format(amount)
  }

  return (
    <div className="p-4 space-y-4 h-full overflow-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-yellow-100 dark:bg-yellow-900/30">
            <Sparkles className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Order Bump & Upsell</h2>
            <p className="text-sm text-muted-foreground">Pametni predlogi za povečanje povprečnega računa</p>
          </div>
        </div>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-3 text-center">
            <DollarSign className="h-5 w-5 text-green-500 mx-auto mb-1" />
            <p className="text-xl font-bold">{formatCurrency(totalPotentialRevenue)}</p>
            <p className="text-xs text-muted-foreground">Potencialni prihodek</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <Target className="h-5 w-5 text-blue-500 mx-auto mb-1" />
            <p className="text-xl font-bold">{avgConversion}%</p>
            <p className="text-xs text-muted-foreground">Povprečna konverzija</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <Zap className="h-5 w-5 text-amber-500 mx-auto mb-1" />
            <p className="text-xl font-bold">{activeRules}/{rules.length}</p>
            <p className="text-xs text-muted-foreground">Aktivna pravila</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <TrendingUp className="h-5 w-5 text-purple-500 mx-auto mb-1" />
            <p className="text-xl font-bold">+{Math.round(totalPotentialRevenue * avgConversion / 100)}</p>
            <p className="text-xs text-muted-foreground">Dejanski prihodek</p>
          </CardContent>
        </Card>
      </div>

      {/* Upsell predlogi */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-yellow-500" /> Predlagani upsell artikli
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-3">
            {suggestions.map(item => {
              const typeConf = typeConfig[item.type]
              const isAdded = addedItems.has(item.id)
              return (
                <div key={item.id} className={`p-3 rounded-lg border transition-all ${isAdded ? 'border-green-500 bg-green-50 dark:bg-green-900/10' : 'hover:border-primary hover:shadow-sm'}`}>
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{item.imageEmoji}</span>
                      <div>
                        <span className="font-medium text-sm block">{item.name}</span>
                        <Badge className={`${typeConf.color} text-[10px]`}>{typeConf.label}</Badge>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-bold text-lg">{formatCurrency(item.price)}</span>
                    {item.originalPrice && (
                      <span className="text-sm text-muted-foreground line-through">{formatCurrency(item.originalPrice)}</span>
                    )}
                    {item.originalPrice && (
                      <Badge variant="destructive" className="text-[10px]">
                        -{Math.round((1 - item.price / item.originalPrice) * 100)}%
                      </Badge>
                    )}
                  </div>

                  <p className="text-xs text-muted-foreground mb-3">{item.reason}</p>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><Star className="h-3 w-3" /> {item.popularity}%</span>
                      <span className="flex items-center gap-1"><Percent className="h-3 w-3" /> {item.margin}% marža</span>
                    </div>
                    <Button
                      size="sm"
                      variant={isAdded ? 'default' : 'outline'}
                      onClick={() => handleAddSuggestion(item.id)}
                      className="h-7 text-xs"
                    >
                      {isAdded ? (
                        <><Sparkles className="h-3 w-3 mr-1" /> Dodano!</>
                      ) : (
                        <><Plus className="h-3 w-3 mr-1" /> Dodaj</>
                      )}
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Pravila */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Zap className="h-4 w-4 text-amber-500" /> Upsell pravila
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {rules.map(rule => {
              const typeConf = typeConfig[rule.type]
              return (
                <div key={rule.id} className={`flex items-center justify-between p-3 rounded-lg border ${rule.enabled ? '' : 'opacity-60'}`}>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => handleToggleRule(rule.id)}
                      className={`h-5 w-9 rounded-full transition-colors relative ${rule.enabled ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'}`}
                    >
                      <div className={`h-4 w-4 rounded-full bg-white absolute top-0.5 transition-transform ${rule.enabled ? 'translate-x-4' : 'translate-x-0.5'}`} />
                    </button>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{rule.name}</span>
                        <Badge className={`${typeConf.color} text-[10px]`}>{typeConf.label}</Badge>
                        {rule.discount > 0 && (
                          <Badge variant="destructive" className="text-[10px]">-{rule.discount}%</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                        <span>Prožilec: {rule.trigger}</span>
                        <span>·</span>
                        <span>{rule.suggestion}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-sm font-medium">{rule.conversionRate}% konverzija</p>
                      <p className="text-xs text-muted-foreground">{formatCurrency(rule.totalRevenue)} prihodek</p>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
