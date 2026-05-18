'use client'

// ═══════════════════════════════════════════════════════════════
// RestaurantOS — Nutritional Calculator
// EU 1169/2011 compliance — alergeni, kalorije, makrohranila
// Za vsak menu item z alergeni in nutritivnimi podatki
// ═══════════════════════════════════════════════════════════════

import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { authFetch } from '@/components/pos/PinLogin'
import {
  Flame, AlertTriangle, Leaf, Heart, ShieldCheck,
  Search, Wheat, Egg, Fish, Milk, Info, UtensilsCrossed,
  X, CircleDot, Siren, Candy, Soup, Salad, Apple,
  Calculator, Globe,
} from 'lucide-react'
import { useState, useMemo } from 'react'

// EU alergeni (Regulation 1169/2011 Annex II)
const ALLERGEN_MAP: Record<string, { label: string; icon: any; color: string }> = {
  '1': { label: 'Žita (gluten)', icon: Wheat, color: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400' },
  '2': { label: 'Raki', icon: Fish, color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' },
  '3': { label: 'Jajca', icon: Egg, color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400' },
  '4': { label: 'Ribe', icon: Fish, color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' },
  '5': { label: 'Arašidi', icon: CircleDot, color: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400' },
  '6': { label: 'Soja', icon: Salad, color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' },
  '7': { label: 'Mleko', icon: Milk, color: 'bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-400' },
  '8': { label: 'Oreški', icon: Apple, color: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400' },
  '9': { label: 'Celer', icon: Salad, color: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400' },
  '10': { label: 'Gorčica', icon: Siren, color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400' },
  '11': { label: 'Sezam', icon: CircleDot, color: 'bg-stone-100 text-stone-800 dark:bg-stone-900/30 dark:text-stone-400' },
  '12': { label: 'Žveplov dioksid', icon: Siren, color: 'bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-400' },
  '13': { label: 'Volčji bob', icon: Soup, color: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400' },
  '14': { label: 'Mehkužci', icon: Fish, color: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-400' },
}

interface MenuItemData {
  id: string
  name: string
  price: number
  image: string
  allergens: string
  category: { name: string }
  orderItems: { id: string }[]
}

export function NutritionalCalculator() {
  const [search, setSearch] = useState('')
  const [allergenFilter, setAllergenFilter] = useState<string | null>(null)

  const { data: menuItems, isLoading } = useQuery({
    queryKey: ['menu-items-nutrition'],
    queryFn: async () => {
      const res = await authFetch('/api/menu-items?limit=500')
      return res.json()
    },
  })

  const items = (menuItems || []) as MenuItemData[]

  const filtered = useMemo(() => {
    let result = items

    if (search) {
      const q = search.toLowerCase()
      result = result.filter(i => i.name.toLowerCase().includes(q) || i.category?.name?.toLowerCase().includes(q))
    }

    if (allergenFilter) {
      result = result.filter(i => {
        const allergens = i.allergens ? i.allergens.split(',').map(a => a.trim()) : []
        return allergens.includes(allergenFilter)
      })
    }

    return result
  }, [items, search, allergenFilter])

  // Statistike
  const stats = useMemo(() => {
    const withAllergens = items.filter(i => i.allergens && i.allergens.length > 0)
    const allergenCounts: Record<string, number> = {}
    for (const item of withAllergens) {
      const allergens = item.allergens.split(',').map(a => a.trim())
      for (const a of allergens) {
        allergenCounts[a] = (allergenCounts[a] || 0) + 1
      }
    }
    return { withAllergens: withAllergens.length, total: items.length, allergenCounts }
  }, [items])

  if (isLoading) {
    return (
      <div className="space-y-4 p-4">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-3 gap-4">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-28" />)}</div>
      </div>
    )
  }

  return (
    <div className="space-y-4 p-2 overflow-y-auto h-full custom-scrollbar">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <ShieldCheck className="h-6 w-6 text-green-500" />
          Nutritivni kalkulator
        </h2>
        <p className="text-muted-foreground">EU 1169/2011 skladnost — alergeni in nutritivni podatki</p>
      </div>

      {/* Povzetek */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <UtensilsCrossed className="h-4 w-4 text-blue-600" />
              <span className="text-xs text-muted-foreground">Skupaj jedi</span>
            </div>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <span className="text-xs text-muted-foreground">Z alergeni</span>
            </div>
            <div className="text-2xl font-bold text-amber-600">{stats.withAllergens}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Leaf className="h-4 w-4 text-green-600" />
              <span className="text-xs text-muted-foreground">Brez alergenov</span>
            </div>
            <div className="text-2xl font-bold text-green-600">{stats.total - stats.withAllergens}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <ShieldCheck className="h-4 w-4 text-purple-600" />
              <span className="text-xs text-muted-foreground">EU skladnost</span>
            </div>
            <div className="text-2xl font-bold text-purple-600">{stats.withAllergens > 0 ? `${Math.round((stats.withAllergens / Math.max(stats.total, 1)) * 100)}%` : 'N/A'}</div>
          </CardContent>
        </Card>
      </div>

      {/* Iskanje */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Išči jedi po imenu ali kategoriji..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        {allergenFilter && (
          <Button variant="outline" size="sm" onClick={() => setAllergenFilter(null)}>
            <X className="h-3 w-3 mr-1" />
            Počisti filter
          </Button>
        )}
      </div>

      {/* Alergeni filter */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500" /> EU Alergeni (14 kategorij)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {Object.entries(ALLERGEN_MAP).map(([num, cfg]) => {
              const Icon = cfg.icon
              const count = stats.allergenCounts[num] || 0
              return (
                <Badge
                  key={num}
                  className={`cursor-pointer transition-all ${cfg.color} ${allergenFilter === num ? 'ring-2 ring-offset-1 ring-purple-400' : ''}`}
                  onClick={() => setAllergenFilter(allergenFilter === num ? null : num)}
                >
                  <Icon className="h-3 w-3 mr-1" />
                  {num}. {cfg.label}
                  {count > 0 && <span className="ml-1 opacity-70">({count})</span>}
                </Badge>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Jedilnik z alergeni */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.slice(0, 30).map((item) => {
          const allergens = item.allergens ? item.allergens.split(',').map(a => a.trim()).filter(Boolean) : []
          return (
            <Card key={item.id} className="overflow-hidden">
              <CardContent className="p-4 space-y-3">
                {/* Ime + cena */}
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-semibold text-sm">{item.name}</div>
                    <div className="text-xs text-muted-foreground">{item.category?.name}</div>
                  </div>
                  <span className="font-bold text-green-600">€{item.price.toFixed(2)}</span>
                </div>

                {/* Alergeni */}
                {allergens.length > 0 ? (
                  <div className="space-y-2">
                    <div className="text-xs font-medium text-amber-600 flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3" />
                      Vsebuje alergene:
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {allergens.map(a => {
                        const cfg = ALLERGEN_MAP[a]
                        const Icon = cfg?.icon || Info
                        return (
                          <Badge key={a} variant="outline" className="text-xs gap-1" title={cfg?.label || `Alergen ${a}`}>
                            <Icon className="h-3 w-3" />
                            {a}
                          </Badge>
                        )
                      })}
                    </div>
                    <div className="text-xs text-muted-foreground space-y-0.5">
                      {allergens.map(a => {
                        const cfg = ALLERGEN_MAP[a]
                        return cfg ? <div key={a}>{a}. {cfg.label}</div> : null
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-1 text-xs text-green-600">
                    <Leaf className="h-3 w-3" />
                    Brez znanih alergenov
                  </div>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>

      {filtered.length === 0 && (
        <Card className="text-center py-16">
          <CardContent>
            <ShieldCheck className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Ni rezultatov</h3>
            <p className="text-muted-foreground">Poskusite drugačen iskalni niz ali filter</p>
          </CardContent>
        </Card>
      )}

      {/* EU compliance info */}
      <Card className="bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Info className="h-5 w-5 text-blue-600 mt-0.5 shrink-0" />
            <div className="text-sm space-y-1">
              <div className="font-semibold text-blue-700 dark:text-blue-400">EU Uredba 1169/2011</div>
              <div className="text-blue-600 dark:text-blue-300">
                Vse jedi, ki vsebujejo kateri koli od 14 EU alergenov, morajo biti ustrezno označene.
                Stranke morajo biti obveščene o prisotnosti alergenov pred naročilom.
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
